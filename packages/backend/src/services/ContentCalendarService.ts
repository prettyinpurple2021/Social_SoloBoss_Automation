import {
  ContentCalendarEventModel,
  ContentCalendarShareModel,
  ContentCampaignModel,
  EditorialWorkflowStateModel,
  ContentCollaborationCommentModel,
  CreateCalendarEventInput,
  CreateCampaignInput,
  ContentCalendarEventRow,
  ContentCampaignRow,
  EditorialWorkflowStateRow,
  PostWorkflowHistoryRow
} from '../models/ContentCalendar';
import { NotificationService } from './NotificationService';
import { loggerService } from './LoggerService';

export interface CalendarView {
  events: ContentCalendarEventRow[];
  campaigns: ContentCampaignRow[];
  sharedCalendars: any[];
  workflowStates: EditorialWorkflowStateRow[];
}

export interface CampaignAnalytics {
  campaign: ContentCampaignRow;
  posts: any[];
  performance: {
    totalPosts: number;
    publishedPosts: number;
    scheduledPosts: number;
    draftPosts: number;
    totalEngagement: number;
    averageEngagement: number;
    reachMetrics: Record<string, number>;
  };
  timeline: {
    date: Date;
    postsCount: number;
    engagement: number;
  }[];
  recommendations: string[];
}

export interface WorkflowTransition {
  fromState: string;
  toState: string;
  reason?: string;
  allowedRoles: string[];
  autoAssignTo?: string;
}

export class ContentCalendarService {
  private static instance: ContentCalendarService;
  private notificationService: NotificationService;

  private constructor() {
    this.notificationService = NotificationService.getInstance();
  }

  public static getInstance(): ContentCalendarService {
    if (!ContentCalendarService.instance) {
      ContentCalendarService.instance = new ContentCalendarService();
    }
    return ContentCalendarService.instance;
  }

  /**
   * Create a calendar event
   */
  async createCalendarEvent(input: CreateCalendarEventInput): Promise<ContentCalendarEventRow> {
    try {
      loggerService.info('Creating calendar event', {
        userId: input.user_id,
        title: input.title,
        eventType: input.event_type,
        startDate: input.start_date
      });

      const event = await ContentCalendarEventModel.create(input);

      // Notify assigned user if different from creator
      if (input.assigned_to && input.assigned_to !== input.user_id) {
        await this.notificationService.sendNotification(
          input.assigned_to,
          'task_assigned',
          `You have been assigned: ${input.title}`,
          {
            eventId: event.id,
            eventType: input.event_type,
            startDate: input.start_date,
            priority: input.priority
          }
        );
      }

      loggerService.info('Calendar event created', {
        eventId: event.id,
        userId: input.user_id
      });

      return event;
    } catch (error) {
      loggerService.error('Failed to create calendar event', error as Error, {
        userId: input.user_id,
        title: input.title
      });
      throw error;
    }
  }

  /**
   * Get calendar view for a user
   */
  async getCalendarView(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    includeShared: boolean = true
  ): Promise<CalendarView> {
    try {
      loggerService.info('Getting calendar view', {
        userId,
        startDate,
        endDate,
        includeShared
      });

      // Get user's own events
      const events = await ContentCalendarEventModel.findByUserId(userId, startDate, endDate);

      // Get shared calendar events if requested
      let sharedEvents: ContentCalendarEventRow[] = [];
      if (includeShared) {
        sharedEvents = await ContentCalendarEventModel.findSharedCalendarEvents(userId, startDate, endDate);
      }

      // Get campaigns
      const campaigns = await ContentCampaignModel.findByUserId(userId);

      // Get workflow states
      const workflowStates = await EditorialWorkflowStateModel.findByUserId(userId);

      // Get shared calendars info
      const sharedCalendars = await ContentCalendarShareModel.findSharedCalendars(userId);

      return {
        events: [...events, ...sharedEvents],
        campaigns,
        sharedCalendars,
        workflowStates
      };
    } catch (error) {
      loggerService.error('Failed to get calendar view', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Share calendar with another user
   */
  async shareCalendar(
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
  ): Promise<any> {
    try {
      loggerService.info('Sharing calendar', {
        calendarOwnerId,
        sharedWithId,
        permissionLevel
      });

      const share = await ContentCalendarShareModel.shareCalendar(
        calendarOwnerId,
        sharedWithId,
        permissionLevel,
        permissions,
        expiresAt
      );

      // Notify the user about calendar sharing
      await this.notificationService.sendNotification(
        sharedWithId,
        'calendar_shared',
        'A calendar has been shared with you',
        {
          calendarOwnerId,
          permissionLevel,
          permissions,
          shareId: share.id
        }
      );

      loggerService.info('Calendar shared successfully', {
        shareId: share.id,
        calendarOwnerId,
        sharedWithId
      });

      return share;
    } catch (error) {
      loggerService.error('Failed to share calendar', error as Error, {
        calendarOwnerId,
        sharedWithId
      });
      throw error;
    }
  }

  /**
   * Create a content campaign
   */
  async createCampaign(input: CreateCampaignInput): Promise<ContentCampaignRow> {
    try {
      loggerService.info('Creating content campaign', {
        userId: input.user_id,
        name: input.name,
        campaignType: input.campaign_type
      });

      const campaign = await ContentCampaignModel.create(input);

      loggerService.info('Content campaign created', {
        campaignId: campaign.id,
        userId: input.user_id
      });

      return campaign;
    } catch (error) {
      loggerService.error('Failed to create content campaign', error as Error, {
        userId: input.user_id,
        name: input.name
      });
      throw error;
    }
  }

  /**
   * Add post to campaign
   */
  async addPostToCampaign(
    campaignId: string,
    postId: string,
    postRole?: string,
    sequenceOrder?: number
  ): Promise<any> {
    try {
      loggerService.info('Adding post to campaign', {
        campaignId,
        postId,
        postRole,
        sequenceOrder
      });

      const campaignPost = await ContentCampaignModel.addPost(campaignId, postId, postRole, sequenceOrder);

      loggerService.info('Post added to campaign', {
        campaignPostId: campaignPost.id,
        campaignId,
        postId
      });

      return campaignPost;
    } catch (error) {
      loggerService.error('Failed to add post to campaign', error as Error, {
        campaignId,
        postId
      });
      throw error;
    }
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId: string, userId: string): Promise<CampaignAnalytics> {
    try {
      loggerService.info('Getting campaign analytics', { campaignId, userId });

      // Get campaign details
      const campaigns = await ContentCampaignModel.findByUserId(userId);
      const campaign = campaigns.find(c => c.id === campaignId);
      
      if (!campaign) {
        throw new Error('Campaign not found or access denied');
      }

      // Get campaign posts
      const posts = await ContentCampaignModel.getCampaignPosts(campaignId);

      // Calculate performance metrics
      const performance = {
        totalPosts: posts.length,
        publishedPosts: posts.filter(p => p.status === 'published').length,
        scheduledPosts: posts.filter(p => p.status === 'scheduled').length,
        draftPosts: posts.filter(p => p.status === 'draft').length,
        totalEngagement: 0, // Would be calculated from actual metrics
        averageEngagement: 0,
        reachMetrics: {} as Record<string, number>
      };

      // Generate timeline data (simplified)
      const timeline = this.generateCampaignTimeline(posts);

      // Generate recommendations
      const recommendations = this.generateCampaignRecommendations(campaign, posts, performance);

      return {
        campaign,
        posts,
        performance,
        timeline,
        recommendations
      };
    } catch (error) {
      loggerService.error('Failed to get campaign analytics', error as Error, {
        campaignId,
        userId
      });
      throw error;
    }
  }

  /**
   * Create editorial workflow state
   */
  async createWorkflowState(
    userId: string,
    name: string,
    description?: string,
    color: string = '#9E9E9E',
    isInitialState: boolean = false,
    isFinalState: boolean = false,
    allowedTransitions: string[] = [],
    requiredRoles: string[] = []
  ): Promise<EditorialWorkflowStateRow> {
    try {
      loggerService.info('Creating workflow state', {
        userId,
        name,
        isInitialState,
        isFinalState
      });

      const state = await EditorialWorkflowStateModel.create(
        userId,
        name,
        description,
        color,
        isInitialState,
        isFinalState,
        allowedTransitions,
        requiredRoles
      );

      loggerService.info('Workflow state created', {
        stateId: state.id,
        userId,
        name
      });

      return state;
    } catch (error) {
      loggerService.error('Failed to create workflow state', error as Error, {
        userId,
        name
      });
      throw error;
    }
  }

  /**
   * Transition post workflow state
   */
  async transitionPostWorkflow(
    postId: string,
    toStateId: string,
    changedBy: string,
    changeReason?: string
  ): Promise<PostWorkflowHistoryRow> {
    try {
      loggerService.info('Transitioning post workflow', {
        postId,
        toStateId,
        changedBy,
        changeReason
      });

      const transition = await EditorialWorkflowStateModel.transitionPost(
        postId,
        toStateId,
        changedBy,
        changeReason
      );

      // Get state details for notification
      const states = await EditorialWorkflowStateModel.findByUserId(changedBy);
      const toState = states.find(s => s.id === toStateId);

      if (toState?.auto_assign_to && toState.auto_assign_to !== changedBy) {
        await this.notificationService.sendNotification(
          toState.auto_assign_to,
          'workflow_transition',
          `Post moved to ${toState.name}`,
          {
            postId,
            stateName: toState.name,
            changedBy,
            changeReason
          }
        );
      }

      loggerService.info('Post workflow transitioned', {
        transitionId: transition.id,
        postId,
        toStateId
      });

      return transition;
    } catch (error) {
      loggerService.error('Failed to transition post workflow', error as Error, {
        postId,
        toStateId,
        changedBy
      });
      throw error;
    }
  }

  /**
   * Add collaboration comment
   */
  async addCollaborationComment(
    postId: string,
    commenterId: string,
    commentText: string,
    commentType: 'general' | 'suggestion' | 'question' | 'approval' | 'rejection' = 'general',
    isInternal: boolean = true,
    parentCommentId?: string,
    mentions: string[] = []
  ): Promise<any> {
    try {
      loggerService.info('Adding collaboration comment', {
        postId,
        commenterId,
        commentType,
        mentionsCount: mentions.length
      });

      const comment = await ContentCollaborationCommentModel.create(
        postId,
        commenterId,
        commentText,
        commentType,
        isInternal,
        parentCommentId,
        mentions
      );

      // Notify mentioned users
      for (const mentionedUserId of mentions) {
        if (mentionedUserId !== commenterId) {
          await this.notificationService.sendNotification(
            mentionedUserId,
            'comment_mention',
            'You were mentioned in a comment',
            {
              postId,
              commentId: comment.id,
              commentType,
              commentText: commentText.substring(0, 100)
            }
          );
        }
      }

      loggerService.info('Collaboration comment added', {
        commentId: comment.id,
        postId,
        commenterId
      });

      return comment;
    } catch (error) {
      loggerService.error('Failed to add collaboration comment', error as Error, {
        postId,
        commenterId
      });
      throw error;
    }
  }

  /**
   * Get post collaboration comments
   */
  async getPostComments(postId: string, includeResolved: boolean = true): Promise<any[]> {
    try {
      return await ContentCollaborationCommentModel.findByPostId(postId, includeResolved);
    } catch (error) {
      loggerService.error('Failed to get post comments', error as Error, { postId });
      throw error;
    }
  }

  /**
   * Resolve collaboration comment
   */
  async resolveComment(commentId: string, resolvedBy: string): Promise<any> {
    try {
      loggerService.info('Resolving collaboration comment', { commentId, resolvedBy });

      const comment = await ContentCollaborationCommentModel.resolve(commentId, resolvedBy);

      if (comment) {
        loggerService.info('Collaboration comment resolved', {
          commentId,
          resolvedBy
        });
      }

      return comment;
    } catch (error) {
      loggerService.error('Failed to resolve comment', error as Error, {
        commentId,
        resolvedBy
      });
      throw error;
    }
  }

  /**
   * Get workflow history for a post
   */
  async getPostWorkflowHistory(postId: string): Promise<PostWorkflowHistoryRow[]> {
    try {
      return await EditorialWorkflowStateModel.getPostWorkflowHistory(postId);
    } catch (error) {
      loggerService.error('Failed to get post workflow history', error as Error, { postId });
      throw error;
    }
  }

  /**
   * Update event status
   */
  async updateEventStatus(
    eventId: string,
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
    userId: string
  ): Promise<ContentCalendarEventRow | null> {
    try {
      loggerService.info('Updating event status', { eventId, status, userId });

      const event = await ContentCalendarEventModel.updateStatus(eventId, status, userId);

      if (event && event.assigned_to && event.assigned_to !== userId) {
        await this.notificationService.sendNotification(
          event.assigned_to,
          'event_status_updated',
          `Event status updated: ${event.title}`,
          {
            eventId,
            status,
            updatedBy: userId
          }
        );
      }

      return event;
    } catch (error) {
      loggerService.error('Failed to update event status', error as Error, {
        eventId,
        status,
        userId
      });
      throw error;
    }
  }

  // Private helper methods

  private generateCampaignTimeline(posts: any[]): {
    date: Date;
    postsCount: number;
    engagement: number;
  }[] {
    // Group posts by date and calculate metrics
    const timelineMap = new Map<string, { postsCount: number; engagement: number }>();

    posts.forEach(post => {
      if (post.scheduled_time) {
        const dateKey = post.scheduled_time.toISOString().split('T')[0];
        const existing = timelineMap.get(dateKey) || { postsCount: 0, engagement: 0 };
        existing.postsCount += 1;
        // engagement would be calculated from actual metrics
        timelineMap.set(dateKey, existing);
      }
    });

    return Array.from(timelineMap.entries()).map(([dateStr, data]) => ({
      date: new Date(dateStr),
      postsCount: data.postsCount,
      engagement: data.engagement
    })).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private generateCampaignRecommendations(
    campaign: ContentCampaignRow,
    posts: any[],
    performance: any
  ): string[] {
    const recommendations: string[] = [];

    // Check campaign progress
    if (performance.draftPosts > performance.publishedPosts) {
      recommendations.push('Consider scheduling more draft posts to maintain campaign momentum');
    }

    // Check campaign timeline
    if (campaign.end_date && new Date() > campaign.end_date) {
      recommendations.push('Campaign has ended - consider analyzing results and planning follow-up');
    }

    // Check post distribution
    if (performance.totalPosts < 5) {
      recommendations.push('Consider adding more posts to increase campaign reach');
    }

    // Check engagement
    if (performance.averageEngagement < 50) {
      recommendations.push('Review content strategy to improve engagement rates');
    }

    return recommendations;
  }
}