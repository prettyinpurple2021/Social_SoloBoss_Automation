import {
  TeamMemberModel,
  ContentApprovalWorkflowModel,
  ContentApprovalRequestModel,
  ContentApprovalActionModel,
  CreateTeamMemberInput,
  CreateApprovalWorkflowInput,
  CreateApprovalRequestInput,
  ApprovalStep,
  TeamMemberRow,
  ContentApprovalWorkflowRow,
  ContentApprovalRequestRow
} from '../models/ContentApproval';
import { NotificationService } from './NotificationService';
import { loggerService } from './LoggerService';

export interface ApprovalDecision {
  action: 'approve' | 'reject' | 'request_changes';
  comments?: string;
  skipToStep?: number;
}

export interface WorkflowProgress {
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  pendingApprovers: string[];
  canApprove: boolean;
  nextSteps: ApprovalStep[];
}

export class ContentApprovalService {
  private static instance: ContentApprovalService;
  private notificationService: NotificationService;

  private constructor() {
    this.notificationService = NotificationService.getInstance();
  }

  public static getInstance(): ContentApprovalService {
    if (!ContentApprovalService.instance) {
      ContentApprovalService.instance = new ContentApprovalService();
    }
    return ContentApprovalService.instance;
  }

  /**
   * Add a team member for collaboration
   */
  async addTeamMember(input: CreateTeamMemberInput): Promise<TeamMemberRow> {
    try {
      loggerService.info('Adding team member', {
        teamOwnerId: input.team_owner_id,
        userId: input.user_id,
        role: input.role
      });

      const teamMember = await TeamMemberModel.create(input);

      // Send invitation notification
      await this.notificationService.sendNotification(
        input.user_id,
        'team_invitation',
        'You have been invited to join a team',
        {
          teamOwnerId: input.team_owner_id,
          role: input.role,
          teamMemberId: teamMember.id
        }
      );

      return teamMember;
    } catch (error) {
      loggerService.error('Failed to add team member', error as Error, {
        teamOwnerId: input.team_owner_id,
        userId: input.user_id
      });
      throw error;
    }
  }

  /**
   * Create an approval workflow
   */
  async createApprovalWorkflow(input: CreateApprovalWorkflowInput): Promise<ContentApprovalWorkflowRow> {
    try {
      loggerService.info('Creating approval workflow', {
        userId: input.user_id,
        name: input.name,
        stepsCount: input.steps.length
      });

      // Validate workflow steps
      this.validateWorkflowSteps(input.steps);

      const workflow = await ContentApprovalWorkflowModel.create(input);

      loggerService.info('Approval workflow created', {
        workflowId: workflow.id,
        userId: input.user_id
      });

      return workflow;
    } catch (error) {
      loggerService.error('Failed to create approval workflow', error as Error, {
        userId: input.user_id,
        name: input.name
      });
      throw error;
    }
  }

  /**
   * Submit a post for approval
   */
  async submitForApproval(input: CreateApprovalRequestInput): Promise<ContentApprovalRequestRow> {
    try {
      loggerService.info('Submitting post for approval', {
        postId: input.post_id,
        workflowId: input.workflow_id,
        requesterId: input.requester_id
      });

      // Get workflow details
      const workflow = await ContentApprovalWorkflowModel.findById(input.workflow_id);
      if (!workflow) {
        throw new Error('Approval workflow not found');
      }

      // Create approval request
      const approvalRequest = await ContentApprovalRequestModel.create(input);

      // Notify approvers for the first step
      await this.notifyStepApprovers(approvalRequest, workflow, 0);

      loggerService.info('Post submitted for approval', {
        approvalRequestId: approvalRequest.id,
        postId: input.post_id
      });

      return approvalRequest;
    } catch (error) {
      loggerService.error('Failed to submit post for approval', error as Error, {
        postId: input.post_id,
        workflowId: input.workflow_id
      });
      throw error;
    }
  }

  /**
   * Process an approval decision
   */
  async processApprovalDecision(
    approvalRequestId: string,
    approverId: string,
    decision: ApprovalDecision
  ): Promise<{
    success: boolean;
    nextStep?: number;
    completed: boolean;
    finalStatus?: 'approved' | 'rejected';
  }> {
    try {
      loggerService.info('Processing approval decision', {
        approvalRequestId,
        approverId,
        action: decision.action
      });

      // Get approval request and workflow
      const approvalRequest = await ContentApprovalRequestModel.findByUserId(approverId);
      const request = approvalRequest.find(r => r.id === approvalRequestId);
      
      if (!request) {
        throw new Error('Approval request not found');
      }

      const workflow = await ContentApprovalWorkflowModel.findById(request.workflow_id);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      // Validate approver permissions
      await this.validateApproverPermissions(approverId, request, workflow);

      // Record the approval action
      await ContentApprovalActionModel.create(
        approvalRequestId,
        approverId,
        request.current_step,
        decision.action,
        decision.comments
      );

      let result = {
        success: true,
        completed: false,
        nextStep: request.current_step,
        finalStatus: undefined as 'approved' | 'rejected' | undefined
      };

      if (decision.action === 'reject') {
        // Rejection - workflow ends
        await ContentApprovalRequestModel.updateStatus(approvalRequestId, 'rejected');
        result.completed = true;
        result.finalStatus = 'rejected';

        // Notify requester of rejection
        await this.notificationService.sendNotification(
          request.requester_id,
          'approval_rejected',
          'Your post has been rejected',
          {
            approvalRequestId,
            comments: decision.comments,
            rejectedBy: approverId
          }
        );

      } else if (decision.action === 'request_changes') {
        // Request changes - send back to requester
        await ContentApprovalRequestModel.updateStatus(approvalRequestId, 'pending', 0);
        result.nextStep = 0;

        // Notify requester of requested changes
        await this.notificationService.sendNotification(
          request.requester_id,
          'changes_requested',
          'Changes have been requested for your post',
          {
            approvalRequestId,
            comments: decision.comments,
            requestedBy: approverId
          }
        );

      } else if (decision.action === 'approve') {
        // Check if this completes the current step
        const stepCompleted = await this.checkStepCompletion(request, workflow, request.current_step);
        
        if (stepCompleted) {
          const nextStep = request.current_step + 1;
          
          if (nextStep >= workflow.steps.length) {
            // Workflow completed - approve the post
            await ContentApprovalRequestModel.updateStatus(approvalRequestId, 'approved');
            result.completed = true;
            result.finalStatus = 'approved';

            // Notify requester of approval
            await this.notificationService.sendNotification(
              request.requester_id,
              'approval_completed',
              'Your post has been approved',
              {
                approvalRequestId,
                approvedBy: approverId
              }
            );

          } else {
            // Move to next step
            await ContentApprovalRequestModel.updateStatus(approvalRequestId, 'pending', nextStep);
            result.nextStep = nextStep;

            // Notify next step approvers
            await this.notifyStepApprovers(request, workflow, nextStep);
          }
        }
      }

      loggerService.info('Approval decision processed', {
        approvalRequestId,
        action: decision.action,
        completed: result.completed,
        finalStatus: result.finalStatus
      });

      return result;
    } catch (error) {
      loggerService.error('Failed to process approval decision', error as Error, {
        approvalRequestId,
        approverId,
        action: decision.action
      });
      throw error;
    }
  }

  /**
   * Get workflow progress for a request
   */
  async getWorkflowProgress(approvalRequestId: string, userId: string): Promise<WorkflowProgress> {
    try {
      const progress = await ContentApprovalActionModel.getApprovalProgress(approvalRequestId);
      
      // Get approval request details
      const requests = await ContentApprovalRequestModel.findByUserId(userId);
      const request = requests.find(r => r.id === approvalRequestId);
      
      if (!request) {
        throw new Error('Approval request not found');
      }

      const workflow = await ContentApprovalWorkflowModel.findById(request.workflow_id);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      // Determine pending approvers for current step
      const currentStep = workflow.steps[request.current_step];
      const pendingApprovers = await this.getPendingApprovers(request, workflow, request.current_step);

      // Check if current user can approve
      const canApprove = await this.canUserApprove(userId, request, workflow, request.current_step);

      // Get next steps
      const nextSteps = workflow.steps.slice(request.current_step + 1, request.current_step + 3);

      return {
        currentStep: request.current_step,
        totalSteps: workflow.steps.length,
        completedSteps: progress.completedSteps,
        pendingApprovers,
        canApprove,
        nextSteps
      };
    } catch (error) {
      loggerService.error('Failed to get workflow progress', error as Error, {
        approvalRequestId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovals(userId: string): Promise<ContentApprovalRequestRow[]> {
    try {
      return await ContentApprovalRequestModel.findPendingForApprover(userId);
    } catch (error) {
      loggerService.error('Failed to get pending approvals', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Cancel an approval request
   */
  async cancelApprovalRequest(approvalRequestId: string, userId: string): Promise<boolean> {
    try {
      loggerService.info('Cancelling approval request', { approvalRequestId, userId });

      const updated = await ContentApprovalRequestModel.updateStatus(approvalRequestId, 'cancelled');
      
      if (updated) {
        // Notify all involved parties
        const actions = await ContentApprovalActionModel.findByRequestId(approvalRequestId);
        const involvedUsers = [...new Set(actions.map(a => a.approver_id))];
        
        for (const involvedUserId of involvedUsers) {
          await this.notificationService.sendNotification(
            involvedUserId,
            'approval_cancelled',
            'An approval request has been cancelled',
            { approvalRequestId, cancelledBy: userId }
          );
        }
      }

      return !!updated;
    } catch (error) {
      loggerService.error('Failed to cancel approval request', error as Error, {
        approvalRequestId,
        userId
      });
      throw error;
    }
  }

  // Private helper methods

  private validateWorkflowSteps(steps: ApprovalStep[]): void {
    if (steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      if (step.stepNumber !== i) {
        throw new Error(`Step ${i} has incorrect step number: ${step.stepNumber}`);
      }

      if (!step.name || step.name.trim().length === 0) {
        throw new Error(`Step ${i} must have a name`);
      }

      if (step.requiredApprovers < 1) {
        throw new Error(`Step ${i} must require at least 1 approver`);
      }

      if (step.requiredRoles.length === 0) {
        throw new Error(`Step ${i} must specify required roles`);
      }
    }
  }

  private async validateApproverPermissions(
    approverId: string,
    request: ContentApprovalRequestRow,
    workflow: ContentApprovalWorkflowRow
  ): Promise<void> {
    const currentStep = workflow.steps[request.current_step];
    if (!currentStep) {
      throw new Error('Invalid workflow step');
    }

    // Check if user has required role
    const teamMembers = await TeamMemberModel.findByTeamOwner(request.requester_id);
    const approverMember = teamMembers.find(tm => tm.user_id === approverId);
    
    if (!approverMember) {
      throw new Error('User is not a team member');
    }

    if (!currentStep.requiredRoles.includes(approverMember.role)) {
      throw new Error('User does not have required role for this approval step');
    }

    // Check if self-approval is allowed
    if (!currentStep.allowSelfApproval && approverId === request.requester_id) {
      throw new Error('Self-approval is not allowed for this step');
    }

    // Check if user has already approved this step
    const existingActions = await ContentApprovalActionModel.findByRequestId(request.id);
    const userStepActions = existingActions.filter(
      a => a.approver_id === approverId && a.step_number === request.current_step
    );

    if (userStepActions.length > 0) {
      throw new Error('User has already acted on this step');
    }
  }

  private async checkStepCompletion(
    request: ContentApprovalRequestRow,
    workflow: ContentApprovalWorkflowRow,
    stepNumber: number
  ): Promise<boolean> {
    const step = workflow.steps[stepNumber];
    if (!step) {
      return false;
    }

    const actions = await ContentApprovalActionModel.findByRequestId(request.id);
    const stepApprovals = actions.filter(
      a => a.step_number === stepNumber && a.action === 'approve'
    );

    return stepApprovals.length >= step.requiredApprovers;
  }

  private async notifyStepApprovers(
    request: ContentApprovalRequestRow,
    workflow: ContentApprovalWorkflowRow,
    stepNumber: number
  ): Promise<void> {
    const step = workflow.steps[stepNumber];
    if (!step) {
      return;
    }

    // Get team members with required roles
    const teamMembers = await TeamMemberModel.findByTeamOwner(request.requester_id);
    const eligibleApprovers = teamMembers.filter(tm => 
      step.requiredRoles.includes(tm.role) && tm.is_active
    );

    // Send notifications
    for (const approver of eligibleApprovers) {
      await this.notificationService.sendNotification(
        approver.user_id,
        'approval_required',
        `Approval required: ${step.name}`,
        {
          approvalRequestId: request.id,
          postId: request.post_id,
          stepName: step.name,
          stepNumber,
          priority: request.priority,
          dueDate: request.due_date
        }
      );
    }
  }

  private async getPendingApprovers(
    request: ContentApprovalRequestRow,
    workflow: ContentApprovalWorkflowRow,
    stepNumber: number
  ): Promise<string[]> {
    const step = workflow.steps[stepNumber];
    if (!step) {
      return [];
    }

    const teamMembers = await TeamMemberModel.findByTeamOwner(request.requester_id);
    const eligibleApprovers = teamMembers.filter(tm => 
      step.requiredRoles.includes(tm.role) && tm.is_active
    );

    // Remove users who have already approved this step
    const actions = await ContentApprovalActionModel.findByRequestId(request.id);
    const approvedUsers = new Set(
      actions
        .filter(a => a.step_number === stepNumber && a.action === 'approve')
        .map(a => a.approver_id)
    );

    return eligibleApprovers
      .filter(approver => !approvedUsers.has(approver.user_id))
      .map(approver => approver.user_id);
  }

  private async canUserApprove(
    userId: string,
    request: ContentApprovalRequestRow,
    workflow: ContentApprovalWorkflowRow,
    stepNumber: number
  ): Promise<boolean> {
    try {
      await this.validateApproverPermissions(userId, request, workflow);
      return true;
    } catch {
      return false;
    }
  }
}