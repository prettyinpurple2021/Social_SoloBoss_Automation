import { db } from '../database';

export interface ContentCalendarEventRow {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  event_type: 'post' | 'campaign' | 'deadline' | 'meeting' | 'review';
  start_date: Date;
  end_date?: Date;
  all_day: boolean;
  recurrence_rule?: string;
  color: string;
  post_id?: string;
  assigned_to?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface ContentCalendarShareRow {
  id: string;
  calendar_owner_id: string;
  shared_with_id: string;
  permission_level: 'view' | 'edit' | 'admin';
  can_create_events: boolean;
  can_edit_events: boolean;
  can_delete_events: boolean;
  can_assign_tasks: boolean;
  shared_at: Date;
  expires_at?: Date;
  is_active: boolean;
}

export interface ContentCampaignRow {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  campaign_type?: string;
  start_date?: Date;
  end_date?: Date;
  budget?: number;
  target_audience?: string;
  goals?: string;
  kpis: Record<string, any>;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';
  color: string;
  created_at: Date;
  updated_at: Date;
}

export interface CampaignPostRow {
  id: string;
  campaign_id: string;
  post_id: string;
  post_role?: string;
  sequence_order?: number;
  created_at: Date;
}

export interface EditorialWorkflowStateRow {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  color: string;
  is_initial_state: boolean;
  is_final_state: boolean;
  allowed_transitions: string[];
  required_roles: string[];
  auto_assign_to?: string;
  created_at: Date;
  updated_at: Date;
}

export interface PostWorkflowHistoryRow {
  id: string;
  post_id: string;
  from_state_id?: string;
  to_state_id: string;
  changed_by: string;
  change_reason?: string;
  time_in_previous_state?: string; // PostgreSQL interval
  created_at: Date;
}

export interface ContentCollaborationCommentRow {
  id: string;
  post_id: string;
  commenter_id: string;
  parent_comment_id?: string;
  comment_text: string;
  comment_type: 'general' | 'suggestion' | 'question' | 'approval' | 'rejection';
  is_internal: boolean;
  mentions: string[];
  attachments: Record<string, any>;
  is_resolved: boolean;
  resolved_by?: string;
  resolved_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCalendarEventInput {
  user_id: string;
  title: string;
  description?: string;
  event_type: 'post' | 'campaign' | 'deadline' | 'meeting' | 'review';
  start_date: Date;
  end_date?: Date;
  all_day?: boolean;
  recurrence_rule?: string;
  color?: string;
  post_id?: string;
  assigned_to?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>;
}

export interface CreateCampaignInput {
  user_id: string;
  name: string;
  description?: string;
  campaign_type?: string;
  start_date?: Date;
  end_date?: Date;
  budget?: number;
  target_audience?: string;
  goals?: string;
  kpis?: Record<string, any>;
  color?: string;
}

export class ContentCalendarEventModel {
  static async create(input: CreateCalendarEventInput): Promise<ContentCalendarEventRow> {
    const query = `
      INSERT INTO content_calendar_events (
        user_id, title, description, event_type, start_date, end_date,
        all_day, recurrence_rule, color, post_id, assigned_to, priority, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const values = [
      input.user_id,
      input.title,
      input.description || null,
      input.event_type,
      input.start_date,
      input.end_date || null,
      input.all_day || false,
      input.recurrence_rule || null,
      input.color || '#2196F3',
      input.post_id || null,
      input.assigned_to || null,
      input.priority || 'normal',
      input.metadata || {}
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByUserId(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    eventType?: string
  ): Promise<ContentCalendarEventRow[]> {
    let query = `
      SELECT cce.*, u.name as assigned_to_name, p.content as post_content
      FROM content_calendar_events cce
      LEFT JOIN users u ON cce.assigned_to = u.id
      LEFT JOIN posts p ON cce.post_id = p.id
      WHERE cce.user_id = $1
    `;
    const values = [userId];
    let paramCount = 2;

    if (startDate) {
      query += ` AND cce.start_date >= $${paramCount}`;
      values.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND cce.start_date <= $${paramCount}`;
      values.push(endDate);
      paramCount++;
    }

    if (eventType) {
      query += ` AND cce.event_type = $${paramCount}`;
      values.push(eventType);
      paramCount++;
    }

    query += ' ORDER BY cce.start_date ASC';

    const result = await db.query(query, values);
    return result.rows;
  }

  static async findSharedCalendarEvents(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ContentCalendarEventRow[]> {
    let query = `
      SELECT cce.*, u.name as assigned_to_name, p.content as post_content,
             owner.name as calendar_owner_name, ccs.permission_level
      FROM content_calendar_events cce
      JOIN content_calendar_shares ccs ON cce.user_id = ccs.calendar_owner_id
      JOIN users owner ON cce.user_id = owner.id
      LEFT JOIN users u ON cce.assigned_to = u.id
      LEFT JOIN posts p ON cce.post_id = p.id
      WHERE ccs.shared_with_id = $1 AND ccs.is_active = true
    `;
    const values = [userId];
    let paramCount = 2;

    if (startDate) {
      query += ` AND cce.start_date >= $${paramCount}`;
      values.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND cce.start_date <= $${paramCount}`;
      values.push(endDate);
      paramCount++;
    }

    query += ' ORDER BY cce.start_date ASC';

    const result = await db.query(query, values);
    return result.rows;
  }

  static async updateStatus(
    id: string,
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
    userId: string
  ): Promise<ContentCalendarEventRow | null> {
    const query = `
      UPDATE content_calendar_events 
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING *
    `;
    
    const result = await db.query(query, [status, id, userId]);
    return result.rows[0] || null;
  }

  static async delete(id: string, userId: string): Promise<boolean> {
    const query = 'DELETE FROM content_calendar_events WHERE id = $1 AND user_id = $2';
    const result = await db.query(query, [id, userId]);
    return (result.rowCount || 0) > 0;
  }
}

export class ContentCalendarShareModel {
  static async shareCalendar(
    calendarOwnerId: string,
    sharedWithId: string,
    permissionLevel: 'view' | 'edit' | 'admin',
    permissions: {
      canCreateEvents?: boolean;
      canEditEvents?: boolean;
      canDeleteEvents?: boolean;
      canAssignTasks?: boolean;
    } = {},
    expiresAt?: Date
  ): Promise<ContentCalendarShareRow> {
    const query = `
      INSERT INTO content_calendar_shares (
        calendar_owner_id, shared_with_id, permission_level,
        can_create_events, can_edit_events, can_delete_events, can_assign_tasks,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (calendar_owner_id, shared_with_id)
      DO UPDATE SET
        permission_level = EXCLUDED.permission_level,
        can_create_events = EXCLUDED.can_create_events,
        can_edit_events = EXCLUDED.can_edit_events,
        can_delete_events = EXCLUDED.can_delete_events,
        can_assign_tasks = EXCLUDED.can_assign_tasks,
        expires_at = EXCLUDED.expires_at,
        is_active = true
      RETURNING *
    `;
    
    const values = [
      calendarOwnerId,
      sharedWithId,
      permissionLevel,
      permissions.canCreateEvents || false,
      permissions.canEditEvents || false,
      permissions.canDeleteEvents || false,
      permissions.canAssignTasks || false,
      expiresAt || null
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findSharedCalendars(userId: string): Promise<ContentCalendarShareRow[]> {
    const query = `
      SELECT ccs.*, u.name as calendar_owner_name, u.email as calendar_owner_email
      FROM content_calendar_shares ccs
      JOIN users u ON ccs.calendar_owner_id = u.id
      WHERE ccs.shared_with_id = $1 AND ccs.is_active = true
      ORDER BY ccs.shared_at DESC
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  static async revokeAccess(calendarOwnerId: string, sharedWithId: string): Promise<boolean> {
    const query = `
      UPDATE content_calendar_shares 
      SET is_active = false
      WHERE calendar_owner_id = $1 AND shared_with_id = $2
    `;
    
    const result = await db.query(query, [calendarOwnerId, sharedWithId]);
    return (result.rowCount || 0) > 0;
  }
}

export class ContentCampaignModel {
  static async create(input: CreateCampaignInput): Promise<ContentCampaignRow> {
    const query = `
      INSERT INTO content_campaigns (
        user_id, name, description, campaign_type, start_date, end_date,
        budget, target_audience, goals, kpis, color
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const values = [
      input.user_id,
      input.name,
      input.description || null,
      input.campaign_type || null,
      input.start_date || null,
      input.end_date || null,
      input.budget || null,
      input.target_audience || null,
      input.goals || null,
      input.kpis || {},
      input.color || '#4CAF50'
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByUserId(userId: string, status?: string): Promise<ContentCampaignRow[]> {
    let query = 'SELECT * FROM content_campaigns WHERE user_id = $1';
    const values = [userId];
    
    if (status) {
      query += ' AND status = $2';
      values.push(status);
    }
    
    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, values);
    return result.rows;
  }

  static async addPost(campaignId: string, postId: string, postRole?: string, sequenceOrder?: number): Promise<CampaignPostRow> {
    const query = `
      INSERT INTO campaign_posts (campaign_id, post_id, post_role, sequence_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [campaignId, postId, postRole || null, sequenceOrder || null];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async getCampaignPosts(campaignId: string): Promise<CampaignPostRow[]> {
    const query = `
      SELECT cp.*, p.content, p.platforms, p.scheduled_time, p.status
      FROM campaign_posts cp
      JOIN posts p ON cp.post_id = p.id
      WHERE cp.campaign_id = $1
      ORDER BY cp.sequence_order ASC, cp.created_at ASC
    `;
    
    const result = await db.query(query, [campaignId]);
    return result.rows;
  }

  static async updateStatus(id: string, status: string, userId: string): Promise<ContentCampaignRow | null> {
    const query = `
      UPDATE content_campaigns 
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING *
    `;
    
    const result = await db.query(query, [status, id, userId]);
    return result.rows[0] || null;
  }
}

export class EditorialWorkflowStateModel {
  static async create(
    userId: string,
    name: string,
    description?: string,
    color: string = '#9E9E9E',
    isInitialState: boolean = false,
    isFinalState: boolean = false,
    allowedTransitions: string[] = [],
    requiredRoles: string[] = [],
    autoAssignTo?: string
  ): Promise<EditorialWorkflowStateRow> {
    const query = `
      INSERT INTO editorial_workflow_states (
        user_id, name, description, color, is_initial_state, is_final_state,
        allowed_transitions, required_roles, auto_assign_to
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      userId, name, description || null, color, isInitialState, isFinalState,
      allowedTransitions, requiredRoles, autoAssignTo || null
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByUserId(userId: string): Promise<EditorialWorkflowStateRow[]> {
    const query = `
      SELECT * FROM editorial_workflow_states 
      WHERE user_id = $1
      ORDER BY is_initial_state DESC, name ASC
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  static async transitionPost(
    postId: string,
    toStateId: string,
    changedBy: string,
    changeReason?: string
  ): Promise<PostWorkflowHistoryRow> {
    // Get current state
    const currentStateQuery = `
      SELECT to_state_id, created_at
      FROM post_workflow_history
      WHERE post_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const currentStateResult = await db.query(currentStateQuery, [postId]);
    const currentState = currentStateResult.rows[0];
    
    // Calculate time in previous state
    let timeInPreviousState = null;
    if (currentState) {
      const timeDiff = new Date().getTime() - currentState.created_at.getTime();
      timeInPreviousState = `${Math.floor(timeDiff / (1000 * 60 * 60))} hours`;
    }

    const query = `
      INSERT INTO post_workflow_history (
        post_id, from_state_id, to_state_id, changed_by, change_reason, time_in_previous_state
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      postId,
      currentState?.to_state_id || null,
      toStateId,
      changedBy,
      changeReason || null,
      timeInPreviousState
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async getPostWorkflowHistory(postId: string): Promise<PostWorkflowHistoryRow[]> {
    const query = `
      SELECT pwh.*, 
             fs.name as from_state_name, fs.color as from_state_color,
             ts.name as to_state_name, ts.color as to_state_color,
             u.name as changed_by_name
      FROM post_workflow_history pwh
      LEFT JOIN editorial_workflow_states fs ON pwh.from_state_id = fs.id
      JOIN editorial_workflow_states ts ON pwh.to_state_id = ts.id
      JOIN users u ON pwh.changed_by = u.id
      WHERE pwh.post_id = $1
      ORDER BY pwh.created_at ASC
    `;
    
    const result = await db.query(query, [postId]);
    return result.rows;
  }
}

export class ContentCollaborationCommentModel {
  static async create(
    postId: string,
    commenterId: string,
    commentText: string,
    commentType: 'general' | 'suggestion' | 'question' | 'approval' | 'rejection' = 'general',
    isInternal: boolean = true,
    parentCommentId?: string,
    mentions: string[] = [],
    attachments: Record<string, any> = {}
  ): Promise<ContentCollaborationCommentRow> {
    const query = `
      INSERT INTO content_collaboration_comments (
        post_id, commenter_id, comment_text, comment_type, is_internal,
        parent_comment_id, mentions, attachments
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      postId, commenterId, commentText, commentType, isInternal,
      parentCommentId || null, mentions, attachments
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByPostId(postId: string, includeResolved: boolean = true): Promise<ContentCollaborationCommentRow[]> {
    let query = `
      SELECT ccc.*, u.name as commenter_name, u.email as commenter_email,
             ru.name as resolved_by_name
      FROM content_collaboration_comments ccc
      JOIN users u ON ccc.commenter_id = u.id
      LEFT JOIN users ru ON ccc.resolved_by = ru.id
      WHERE ccc.post_id = $1
    `;
    
    if (!includeResolved) {
      query += ' AND ccc.is_resolved = false';
    }
    
    query += ' ORDER BY ccc.created_at ASC';

    const result = await db.query(query, [postId]);
    return result.rows;
  }

  static async resolve(id: string, resolvedBy: string): Promise<ContentCollaborationCommentRow | null> {
    const query = `
      UPDATE content_collaboration_comments 
      SET is_resolved = true, resolved_by = $1, resolved_at = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await db.query(query, [resolvedBy, id]);
    return result.rows[0] || null;
  }

  static async getCommentThread(parentCommentId: string): Promise<ContentCollaborationCommentRow[]> {
    const query = `
      WITH RECURSIVE comment_thread AS (
        SELECT * FROM content_collaboration_comments WHERE id = $1
        UNION ALL
        SELECT ccc.* FROM content_collaboration_comments ccc
        JOIN comment_thread ct ON ccc.parent_comment_id = ct.id
      )
      SELECT ct.*, u.name as commenter_name, u.email as commenter_email
      FROM comment_thread ct
      JOIN users u ON ct.commenter_id = u.id
      ORDER BY ct.created_at ASC
    `;
    
    const result = await db.query(query, [parentCommentId]);
    return result.rows;
  }
}