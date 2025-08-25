import { db } from '../database';

export interface TeamMemberRow {
  id: string;
  user_id: string;
  team_owner_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  permissions: Record<string, any>;
  is_active: boolean;
  invited_at: Date;
  joined_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ContentApprovalWorkflowRow {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  steps: ApprovalStep[];
  is_active: boolean;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ApprovalStep {
  stepNumber: number;
  name: string;
  description?: string;
  requiredRoles: string[];
  requiredApprovers: number;
  allowSelfApproval: boolean;
  autoApprove?: boolean;
  timeoutHours?: number;
}

export interface ContentApprovalRequestRow {
  id: string;
  post_id: string;
  workflow_id: string;
  requester_id: string;
  current_step: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: Date;
  notes?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface ContentApprovalActionRow {
  id: string;
  approval_request_id: string;
  approver_id: string;
  step_number: number;
  action: 'approve' | 'reject' | 'request_changes';
  comments?: string;
  approved_at?: Date;
  created_at: Date;
}

export interface CreateTeamMemberInput {
  user_id: string;
  team_owner_id: string;
  role: 'admin' | 'editor' | 'viewer';
  permissions?: Record<string, any>;
}

export interface CreateApprovalWorkflowInput {
  user_id: string;
  name: string;
  description?: string;
  steps: ApprovalStep[];
  is_default?: boolean;
}

export interface CreateApprovalRequestInput {
  post_id: string;
  workflow_id: string;
  requester_id: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: Date;
  notes?: string;
}

export class TeamMemberModel {
  static async create(input: CreateTeamMemberInput): Promise<TeamMemberRow> {
    const query = `
      INSERT INTO team_members (user_id, team_owner_id, role, permissions)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      input.user_id,
      input.team_owner_id,
      input.role,
      input.permissions || {}
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByTeamOwner(teamOwnerId: string): Promise<TeamMemberRow[]> {
    const query = `
      SELECT tm.*, u.name as user_name, u.email as user_email
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_owner_id = $1 AND tm.is_active = true
      ORDER BY tm.created_at DESC
    `;
    
    const result = await db.query(query, [teamOwnerId]);
    return result.rows;
  }

  static async findByUserId(userId: string): Promise<TeamMemberRow[]> {
    const query = `
      SELECT tm.*, u.name as team_owner_name, u.email as team_owner_email
      FROM team_members tm
      JOIN users u ON tm.team_owner_id = u.id
      WHERE tm.user_id = $1 AND tm.is_active = true
      ORDER BY tm.created_at DESC
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  static async updateRole(id: string, teamOwnerId: string, role: string, permissions?: Record<string, any>): Promise<TeamMemberRow | null> {
    const query = `
      UPDATE team_members 
      SET role = $1, permissions = $2, updated_at = NOW()
      WHERE id = $3 AND team_owner_id = $4
      RETURNING *
    `;
    
    const result = await db.query(query, [role, permissions || {}, id, teamOwnerId]);
    return result.rows[0] || null;
  }

  static async remove(id: string, teamOwnerId: string): Promise<boolean> {
    const query = `
      UPDATE team_members 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND team_owner_id = $2
    `;
    
    const result = await db.query(query, [id, teamOwnerId]);
    return (result.rowCount || 0) > 0;
  }
}

export class ContentApprovalWorkflowModel {
  static async create(input: CreateApprovalWorkflowInput): Promise<ContentApprovalWorkflowRow> {
    const query = `
      INSERT INTO content_approval_workflows (user_id, name, description, steps, is_default)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const values = [
      input.user_id,
      input.name,
      input.description || null,
      JSON.stringify(input.steps),
      input.is_default || false
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByUserId(userId: string): Promise<ContentApprovalWorkflowRow[]> {
    const query = `
      SELECT * FROM content_approval_workflows 
      WHERE user_id = $1 AND is_active = true
      ORDER BY is_default DESC, created_at DESC
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  static async findById(id: string, userId?: string): Promise<ContentApprovalWorkflowRow | null> {
    let query = 'SELECT * FROM content_approval_workflows WHERE id = $1';
    const values = [id];
    
    if (userId) {
      query += ' AND user_id = $2';
      values.push(userId);
    }

    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  static async setDefault(id: string, userId: string): Promise<boolean> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Remove default from all workflows
      await client.query(
        'UPDATE content_approval_workflows SET is_default = false WHERE user_id = $1',
        [userId]
      );
      
      // Set new default
      const result = await client.query(
        'UPDATE content_approval_workflows SET is_default = true WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      
      await client.query('COMMIT');
      return (result.rowCount || 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async delete(id: string, userId: string): Promise<boolean> {
    const query = `
      UPDATE content_approval_workflows 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
    `;
    
    const result = await db.query(query, [id, userId]);
    return (result.rowCount || 0) > 0;
  }
}

export class ContentApprovalRequestModel {
  static async create(input: CreateApprovalRequestInput): Promise<ContentApprovalRequestRow> {
    const query = `
      INSERT INTO content_approval_requests (
        post_id, workflow_id, requester_id, priority, due_date, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      input.post_id,
      input.workflow_id,
      input.requester_id,
      input.priority || 'normal',
      input.due_date || null,
      input.notes || null
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByUserId(userId: string, status?: string): Promise<ContentApprovalRequestRow[]> {
    let query = `
      SELECT car.*, p.content as post_content, p.platforms, caw.name as workflow_name
      FROM content_approval_requests car
      JOIN posts p ON car.post_id = p.id
      JOIN content_approval_workflows caw ON car.workflow_id = caw.id
      WHERE car.requester_id = $1
    `;
    const values = [userId];
    
    if (status) {
      query += ' AND car.status = $2';
      values.push(status);
    }
    
    query += ' ORDER BY car.created_at DESC';

    const result = await db.query(query, values);
    return result.rows;
  }

  static async findPendingForApprover(approverId: string): Promise<ContentApprovalRequestRow[]> {
    const query = `
      SELECT DISTINCT car.*, p.content as post_content, p.platforms, caw.name as workflow_name, caw.steps
      FROM content_approval_requests car
      JOIN posts p ON car.post_id = p.id
      JOIN content_approval_workflows caw ON car.workflow_id = caw.id
      JOIN team_members tm ON tm.team_owner_id = p.user_id
      WHERE car.status = 'pending' 
        AND tm.user_id = $1 
        AND tm.is_active = true
      ORDER BY car.priority DESC, car.created_at ASC
    `;
    
    const result = await db.query(query, [approverId]);
    return result.rows;
  }

  static async updateStatus(id: string, status: string, currentStep?: number): Promise<ContentApprovalRequestRow | null> {
    let query = 'UPDATE content_approval_requests SET status = $1, updated_at = NOW()';
    const values = [status];
    let paramCount = 2;

    if (currentStep !== undefined) {
      query += `, current_step = $${paramCount}`;
      values.push(currentStep.toString());
      paramCount++;
    }

    query += ` WHERE id = $${paramCount} RETURNING *`;
    values.push(id);

    const result = await db.query(query, values);
    return result.rows[0] || null;
  }
}

export class ContentApprovalActionModel {
  static async create(
    approvalRequestId: string,
    approverId: string,
    stepNumber: number,
    action: 'approve' | 'reject' | 'request_changes',
    comments?: string
  ): Promise<ContentApprovalActionRow> {
    const query = `
      INSERT INTO content_approval_actions (
        approval_request_id, approver_id, step_number, action, comments, approved_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      approvalRequestId,
      approverId,
      stepNumber,
      action,
      comments || null,
      action === 'approve' ? new Date() : null
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByRequestId(requestId: string): Promise<ContentApprovalActionRow[]> {
    const query = `
      SELECT caa.*, u.name as approver_name, u.email as approver_email
      FROM content_approval_actions caa
      JOIN users u ON caa.approver_id = u.id
      WHERE caa.approval_request_id = $1
      ORDER BY caa.step_number, caa.created_at
    `;
    
    const result = await db.query(query, [requestId]);
    return result.rows;
  }

  static async getApprovalProgress(requestId: string): Promise<{
    totalSteps: number;
    completedSteps: number;
    currentStep: number;
    actions: ContentApprovalActionRow[];
  }> {
    // Get workflow steps count
    const workflowQuery = `
      SELECT caw.steps
      FROM content_approval_requests car
      JOIN content_approval_workflows caw ON car.workflow_id = caw.id
      WHERE car.id = $1
    `;
    
    const workflowResult = await db.query(workflowQuery, [requestId]);
    const steps = workflowResult.rows[0]?.steps || [];
    const totalSteps = Array.isArray(steps) ? steps.length : 0;

    // Get current step and actions
    const requestQuery = `
      SELECT current_step FROM content_approval_requests WHERE id = $1
    `;
    
    const requestResult = await db.query(requestQuery, [requestId]);
    const currentStep = requestResult.rows[0]?.current_step || 0;

    // Get all actions
    const actions = await ContentApprovalActionModel.findByRequestId(requestId);
    
    // Count completed steps (steps with approve actions)
    const completedSteps = new Set(
      actions.filter(action => action.action === 'approve').map(action => action.step_number)
    ).size;

    return {
      totalSteps,
      completedSteps,
      currentStep,
      actions
    };
  }
}