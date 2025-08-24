import { PostService, PostData } from './PostService';
import { PostModel } from '../models/Post';
import { SchedulerService } from './SchedulerService';
import { Platform, PostStatus } from '../types/database';
import { db } from '../database/connection';

export interface RecurringScheduleConfig {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number; // Every N days/weeks/months
  daysOfWeek?: number[]; // 0-6, Sunday = 0 (for weekly)
  dayOfMonth?: number; // 1-31 (for monthly)
  endDate?: Date;
  maxOccurrences?: number;
  timezone: string;
}

export interface BulkScheduleOperation {
  posts: Array<{
    content: string;
    images?: string[];
    hashtags?: string[];
    platforms: Platform[];
    scheduledTime: Date;
    categories?: string[];
    tags?: string[];
  }>;
  options?: {
    conflictResolution: 'skip' | 'reschedule' | 'override';
    rescheduleMinutes?: number;
  };
}

export interface OptimalTimeRecommendation {
  platform: Platform;
  dayOfWeek: number;
  hour: number;
  score: number;
  reason: string;
  historicalData: {
    avgEngagement: number;
    postCount: number;
    successRate: number;
  };
}

export interface SchedulingConflict {
  scheduledTime: Date;
  existingPosts: Array<{
    id: string;
    content: string;
    platforms: Platform[];
  }>;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
}

export class AdvancedSchedulingService {
  private static instance: AdvancedSchedulingService;

  private constructor() {}

  public static getInstance(): AdvancedSchedulingService {
    if (!AdvancedSchedulingService.instance) {
      AdvancedSchedulingService.instance = new AdvancedSchedulingService();
    }
    return AdvancedSchedulingService.instance;
  }

  /**
   * Create recurring posts based on schedule configuration
   */
  async createRecurringSchedule(
    userId: string,
    postData: PostData,
    scheduleConfig: RecurringScheduleConfig
  ): Promise<{
    success: boolean;
    createdPosts: string[];
    skippedDates: Date[];
    error?: string;
  }> {
    try {
      const scheduledDates = this.generateRecurringDates(scheduleConfig);
      const createdPosts: string[] = [];
      const skippedDates: Date[] = [];

      for (const scheduledDate of scheduledDates) {
        try {
          // Check for conflicts
          const conflicts = await this.detectSchedulingConflicts(userId, scheduledDate, postData.platforms);
          
          if (conflicts.length > 0 && conflicts.some(c => c.severity === 'high')) {
            skippedDates.push(scheduledDate);
            continue;
          }

          // Create the post
          const post = await PostService.createPost(userId, {
            ...postData,
            scheduledTime: scheduledDate
          });

          createdPosts.push(post.id);
        } catch (error) {
          console.error(`Error creating recurring post for ${scheduledDate}:`, error);
          skippedDates.push(scheduledDate);
        }
      }

      return {
        success: true,
        createdPosts,
        skippedDates
      };
    } catch (error) {
      console.error('Error creating recurring schedule:', error);
      return {
        success: false,
        createdPosts: [],
        skippedDates: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute bulk scheduling operation
   */
  async executeBulkScheduling(
    userId: string,
    operation: BulkScheduleOperation
  ): Promise<{
    success: boolean;
    createdPosts: string[];
    conflicts: SchedulingConflict[];
    errors: Array<{ index: number; error: string }>;
  }> {
    const createdPosts: string[] = [];
    const conflicts: SchedulingConflict[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < operation.posts.length; i++) {
      const postData = operation.posts[i];
      
      try {
        // Check for conflicts
        const postConflicts = await this.detectSchedulingConflicts(
          userId,
          postData.scheduledTime,
          postData.platforms
        );

        if (postConflicts.length > 0) {
          conflicts.push(...postConflicts);

          // Handle conflicts based on resolution strategy
          if (operation.options?.conflictResolution === 'skip') {
            continue;
          } else if (operation.options?.conflictResolution === 'reschedule') {
            const rescheduleMinutes = operation.options.rescheduleMinutes || 30;
            postData.scheduledTime = new Date(
              postData.scheduledTime.getTime() + rescheduleMinutes * 60 * 1000
            );
          }
          // 'override' continues with original time
        }

        // Create the post
        const post = await PostService.createPost(userId, {
          content: postData.content,
          images: postData.images,
          hashtags: postData.hashtags,
          platforms: postData.platforms,
          scheduledTime: postData.scheduledTime
        });

        createdPosts.push(post.id);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      success: errors.length === 0,
      createdPosts,
      conflicts,
      errors
    };
  }

  /**
   * Get optimal posting time recommendations
   */
  async getOptimalPostingTimes(
    userId: string,
    platforms: Platform[],
    timezone: string = 'UTC'
  ): Promise<OptimalTimeRecommendation[]> {
    const recommendations: OptimalTimeRecommendation[] = [];

    for (const platform of platforms) {
      const platformRecommendations = await this.getOptimalTimesForPlatform(
        userId,
        platform,
        timezone
      );
      recommendations.push(...platformRecommendations);
    }

    // Sort by score descending
    return recommendations.sort((a, b) => b.score - a.score);
  }

  /**
   * Detect scheduling conflicts
   */
  async detectSchedulingConflicts(
    userId: string,
    scheduledTime: Date,
    platforms: Platform[]
  ): Promise<SchedulingConflict[]> {
    const conflicts: SchedulingConflict[] = [];
    
    // Check for posts within 30 minutes of the scheduled time
    const timeWindow = 30 * 60 * 1000; // 30 minutes in milliseconds
    const startTime = new Date(scheduledTime.getTime() - timeWindow);
    const endTime = new Date(scheduledTime.getTime() + timeWindow);

    const query = `
      SELECT p.id, p.content, p.platforms, p.scheduled_time
      FROM posts p
      WHERE p.user_id = $1
        AND p.status = $2
        AND p.scheduled_time BETWEEN $3 AND $4
        AND p.platforms && $5
    `;

    const result = await db.query(query, [
      userId,
      PostStatus.SCHEDULED,
      startTime,
      endTime,
      platforms
    ]);

    if (result.rows.length > 0) {
      const severity = this.calculateConflictSeverity(result.rows.length, platforms);
      const recommendation = this.generateConflictRecommendation(severity, scheduledTime);

      conflicts.push({
        scheduledTime,
        existingPosts: result.rows.map(row => ({
          id: row.id,
          content: row.content,
          platforms: row.platforms
        })),
        severity,
        recommendation
      });
    }

    return conflicts;
  }

  /**
   * Get scheduling suggestions based on historical performance
   */
  async getSchedulingSuggestions(
    userId: string,
    platforms: Platform[],
    contentType?: string
  ): Promise<{
    optimalTimes: OptimalTimeRecommendation[];
    avoidTimes: Array<{
      dayOfWeek: number;
      hour: number;
      reason: string;
    }>;
    generalTips: string[];
  }> {
    const optimalTimes = await this.getOptimalPostingTimes(userId, platforms);
    
    // Get times to avoid based on poor performance
    const avoidTimes = await this.getTimesToAvoid(userId, platforms);
    
    // Generate general tips
    const generalTips = this.generateSchedulingTips(platforms, contentType);

    return {
      optimalTimes: optimalTimes.slice(0, 10), // Top 10 recommendations
      avoidTimes,
      generalTips
    };
  }

  /**
   * Generate recurring dates based on schedule configuration
   */
  private generateRecurringDates(config: RecurringScheduleConfig): Date[] {
    const dates: Date[] = [];
    const startDate = new Date();
    let currentDate = new Date(startDate);
    let occurrenceCount = 0;

    while (
      (!config.endDate || currentDate <= config.endDate) &&
      (!config.maxOccurrences || occurrenceCount < config.maxOccurrences)
    ) {
      if (this.isValidRecurringDate(currentDate, config)) {
        dates.push(new Date(currentDate));
        occurrenceCount++;
      }

      // Advance to next potential date
      switch (config.frequency) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + config.interval);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + (7 * config.interval));
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + config.interval);
          break;
      }

      // Safety check to prevent infinite loops
      if (dates.length > 1000) {
        break;
      }
    }

    return dates;
  }

  /**
   * Check if a date is valid for recurring schedule
   */
  private isValidRecurringDate(date: Date, config: RecurringScheduleConfig): boolean {
    switch (config.frequency) {
      case 'daily':
        return true;
      case 'weekly':
        return !config.daysOfWeek || config.daysOfWeek.includes(date.getDay());
      case 'monthly':
        return !config.dayOfMonth || date.getDate() === config.dayOfMonth;
      default:
        return false;
    }
  }

  /**
   * Get optimal times for a specific platform
   */
  private async getOptimalTimesForPlatform(
    userId: string,
    platform: Platform,
    timezone: string
  ): Promise<OptimalTimeRecommendation[]> {
    // Query historical performance data
    const query = `
      SELECT 
        EXTRACT(DOW FROM p.published_at) as day_of_week,
        EXTRACT(HOUR FROM p.published_at AT TIME ZONE $3) as hour,
        AVG(COALESCE(pa.metric_value, 0)) as avg_engagement,
        COUNT(p.id) as post_count,
        COUNT(CASE WHEN pa.metric_value > 0 THEN 1 END)::float / COUNT(p.id) as success_rate
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id AND pp.platform = $2
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id AND pa.metric_type = 'engagement_rate'
      WHERE p.user_id = $1
        AND p.status = 'published'
        AND p.published_at IS NOT NULL
        AND p.platforms @> ARRAY[$2]
        AND p.published_at > NOW() - INTERVAL '90 days'
      GROUP BY day_of_week, hour
      HAVING COUNT(p.id) >= 3
      ORDER BY avg_engagement DESC, success_rate DESC
    `;

    const result = await db.query(query, [userId, platform, timezone]);
    
    const recommendations: OptimalTimeRecommendation[] = result.rows.map(row => ({
      platform,
      dayOfWeek: parseInt(row.day_of_week),
      hour: parseInt(row.hour),
      score: this.calculateOptimalTimeScore(
        parseFloat(row.avg_engagement),
        parseInt(row.post_count),
        parseFloat(row.success_rate)
      ),
      reason: this.generateOptimalTimeReason(
        parseFloat(row.avg_engagement),
        parseInt(row.post_count),
        parseFloat(row.success_rate)
      ),
      historicalData: {
        avgEngagement: parseFloat(row.avg_engagement),
        postCount: parseInt(row.post_count),
        successRate: parseFloat(row.success_rate)
      }
    }));

    // Add default recommendations if no historical data
    if (recommendations.length === 0) {
      return this.getDefaultOptimalTimes(platform);
    }

    return recommendations;
  }

  /**
   * Calculate optimal time score
   */
  private calculateOptimalTimeScore(
    avgEngagement: number,
    postCount: number,
    successRate: number
  ): number {
    // Weighted score: 50% engagement, 30% success rate, 20% sample size
    const engagementScore = Math.min(avgEngagement / 100, 1); // Normalize to 0-1
    const sampleSizeScore = Math.min(postCount / 20, 1); // Normalize to 0-1
    
    return (engagementScore * 0.5) + (successRate * 0.3) + (sampleSizeScore * 0.2);
  }

  /**
   * Generate reason for optimal time recommendation
   */
  private generateOptimalTimeReason(
    avgEngagement: number,
    postCount: number,
    successRate: number
  ): string {
    if (avgEngagement > 50) {
      return `High engagement rate (${avgEngagement.toFixed(1)}%) based on ${postCount} posts`;
    } else if (successRate > 0.8) {
      return `High success rate (${(successRate * 100).toFixed(1)}%) with consistent performance`;
    } else {
      return `Moderate performance with ${postCount} historical posts`;
    }
  }

  /**
   * Get default optimal times for platform (when no historical data)
   */
  private getDefaultOptimalTimes(platform: Platform): OptimalTimeRecommendation[] {
    const defaults: Record<Platform, Array<{ dayOfWeek: number; hour: number; reason: string }>> = {
      [Platform.FACEBOOK]: [
        { dayOfWeek: 2, hour: 15, reason: 'Industry best practice: Tuesday 3 PM' },
        { dayOfWeek: 3, hour: 15, reason: 'Industry best practice: Wednesday 3 PM' },
        { dayOfWeek: 4, hour: 13, reason: 'Industry best practice: Thursday 1 PM' }
      ],
      [Platform.INSTAGRAM]: [
        { dayOfWeek: 2, hour: 11, reason: 'Industry best practice: Tuesday 11 AM' },
        { dayOfWeek: 3, hour: 14, reason: 'Industry best practice: Wednesday 2 PM' },
        { dayOfWeek: 4, hour: 17, reason: 'Industry best practice: Thursday 5 PM' }
      ],
      [Platform.X]: [
        { dayOfWeek: 2, hour: 9, reason: 'Industry best practice: Tuesday 9 AM' },
        { dayOfWeek: 3, hour: 12, reason: 'Industry best practice: Wednesday 12 PM' },
        { dayOfWeek: 4, hour: 17, reason: 'Industry best practice: Thursday 5 PM' }
      ],
      [Platform.PINTEREST]: [
        { dayOfWeek: 6, hour: 20, reason: 'Industry best practice: Saturday 8 PM' },
        { dayOfWeek: 0, hour: 14, reason: 'Industry best practice: Sunday 2 PM' },
        { dayOfWeek: 2, hour: 14, reason: 'Industry best practice: Tuesday 2 PM' }
      ]
    };

    return (defaults[platform] || []).map(time => ({
      platform,
      dayOfWeek: time.dayOfWeek,
      hour: time.hour,
      score: 0.5, // Default score
      reason: time.reason,
      historicalData: {
        avgEngagement: 0,
        postCount: 0,
        successRate: 0
      }
    }));
  }

  /**
   * Get times to avoid based on poor performance
   */
  private async getTimesToAvoid(
    userId: string,
    platforms: Platform[]
  ): Promise<Array<{ dayOfWeek: number; hour: number; reason: string }>> {
    const query = `
      SELECT 
        EXTRACT(DOW FROM p.published_at) as day_of_week,
        EXTRACT(HOUR FROM p.published_at) as hour,
        AVG(COALESCE(pa.metric_value, 0)) as avg_engagement,
        COUNT(p.id) as post_count
      FROM posts p
      LEFT JOIN platform_posts pp ON p.id = pp.post_id
      LEFT JOIN post_analytics pa ON pp.id = pa.platform_post_id AND pa.metric_type = 'engagement_rate'
      WHERE p.user_id = $1
        AND p.status = 'published'
        AND p.published_at IS NOT NULL
        AND p.platforms && $2
        AND p.published_at > NOW() - INTERVAL '90 days'
      GROUP BY day_of_week, hour
      HAVING COUNT(p.id) >= 3 AND AVG(COALESCE(pa.metric_value, 0)) < 5
      ORDER BY avg_engagement ASC
      LIMIT 5
    `;

    const result = await db.query(query, [userId, platforms]);
    
    return result.rows.map(row => ({
      dayOfWeek: parseInt(row.day_of_week),
      hour: parseInt(row.hour),
      reason: `Low engagement (${parseFloat(row.avg_engagement).toFixed(1)}%) based on ${row.post_count} posts`
    }));
  }

  /**
   * Calculate conflict severity
   */
  private calculateConflictSeverity(
    conflictCount: number,
    platforms: Platform[]
  ): 'low' | 'medium' | 'high' {
    if (conflictCount >= 3 || platforms.length >= 3) {
      return 'high';
    } else if (conflictCount >= 2 || platforms.length >= 2) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Generate conflict recommendation
   */
  private generateConflictRecommendation(
    severity: 'low' | 'medium' | 'high',
    scheduledTime: Date
  ): string {
    switch (severity) {
      case 'high':
        return `Consider rescheduling to avoid audience fatigue. Suggested times: ${this.suggestAlternativeTimes(scheduledTime)}`;
      case 'medium':
        return `Multiple posts scheduled close together. Consider spacing them 1-2 hours apart.`;
      case 'low':
        return `Minor scheduling overlap detected. Posts should perform normally.`;
    }
  }

  /**
   * Suggest alternative times
   */
  private suggestAlternativeTimes(originalTime: Date): string {
    const alternatives = [
      new Date(originalTime.getTime() + 2 * 60 * 60 * 1000), // +2 hours
      new Date(originalTime.getTime() - 2 * 60 * 60 * 1000), // -2 hours
      new Date(originalTime.getTime() + 24 * 60 * 60 * 1000) // +1 day
    ];

    return alternatives
      .map(time => time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      .join(', ');
  }

  /**
   * Generate scheduling tips
   */
  private generateSchedulingTips(platforms: Platform[], contentType?: string): string[] {
    const tips: string[] = [
      'Post consistently to maintain audience engagement',
      'Avoid scheduling too many posts within a short time frame',
      'Consider your audience\'s timezone when scheduling posts',
      'Monitor performance and adjust timing based on engagement data'
    ];

    // Platform-specific tips
    if (platforms.includes(Platform.INSTAGRAM)) {
      tips.push('Instagram Stories perform well during lunch hours and evenings');
    }
    if (platforms.includes(Platform.X)) {
      tips.push('Twitter engagement peaks during commute hours (7-9 AM, 5-7 PM)');
    }
    if (platforms.includes(Platform.FACEBOOK)) {
      tips.push('Facebook posts perform better on weekdays during business hours');
    }
    if (platforms.includes(Platform.PINTEREST)) {
      tips.push('Pinterest content performs well on weekends and evenings');
    }

    return tips;
  }
}

export const advancedSchedulingService = AdvancedSchedulingService.getInstance();