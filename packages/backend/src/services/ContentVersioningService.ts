import {
  PostVersionModel,
  ContentRevisionCommentModel,
  ContentABTestModel,
  ContentPerformanceMetricModel,
  CreatePostVersionInput,
  CreateABTestInput,
  PostVersionRow,
  ContentABTestRow,
  ContentABTestVariantRow,
  ContentPerformanceMetricRow
} from '../models/ContentVersioning';
import { loggerService } from './LoggerService';
import { NotificationService } from './NotificationService';

export interface VersionComparison {
  version1: PostVersionRow | null;
  version2: PostVersionRow | null;
  differences: {
    content: boolean;
    images: boolean;
    hashtags: boolean;
    platforms: boolean;
    scheduledTime: boolean;
  };
  changesSummary: string[];
}

export interface ABTestConfiguration {
  name: string;
  description?: string;
  testType: 'content' | 'timing' | 'platform' | 'hashtags';
  variants: {
    name: string;
    postId: string;
    trafficAllocation: number;
    isControl?: boolean;
  }[];
  duration: {
    startDate: Date;
    endDate: Date;
  };
  metrics: {
    primary: string;
    secondary?: string[];
  };
  sampleSize: number;
  confidenceLevel: number;
}

export interface ABTestResults {
  test: ContentABTestRow;
  variants: ContentABTestVariantRow[];
  results: any[];
  winner?: {
    variantId: string;
    variantName: string;
    improvement: number;
    significance: number;
    confidence: number;
  };
  insights: string[];
  recommendations: string[];
}

export class ContentVersioningService {
  private static instance: ContentVersioningService;
  private notificationService: NotificationService;

  private constructor() {
    this.notificationService = NotificationService.getInstance();
  }

  public static getInstance(): ContentVersioningService {
    if (!ContentVersioningService.instance) {
      ContentVersioningService.instance = new ContentVersioningService();
    }
    return ContentVersioningService.instance;
  }

  /**
   * Create a new version of a post
   */
  async createPostVersion(input: CreatePostVersionInput): Promise<PostVersionRow> {
    try {
      loggerService.info('Creating post version', {
        postId: input.post_id,
        changeType: input.change_type,
        changedBy: input.changed_by
      });

      const version = await PostVersionModel.create(input);

      // Notify collaborators if this is a significant change
      if (input.change_type === 'edit' && input.change_summary) {
        await this.notifyCollaborators(input.post_id, version, input.changed_by);
      }

      loggerService.info('Post version created', {
        versionId: version.id,
        versionNumber: version.version_number,
        postId: input.post_id
      });

      return version;
    } catch (error) {
      loggerService.error('Failed to create post version', error as Error, {
        postId: input.post_id,
        changeType: input.change_type
      });
      throw error;
    }
  }

  /**
   * Get version history for a post
   */
  async getVersionHistory(postId: string, limit?: number): Promise<{
    versions: PostVersionRow[];
    stats: {
      totalVersions: number;
      latestVersion: number;
      contributors: string[];
      changeTypes: Record<string, number>;
    };
  }> {
    try {
      const versions = await PostVersionModel.findByPostId(postId, limit);
      const stats = await PostVersionModel.getVersionStats(postId);

      return { versions, stats };
    } catch (error) {
      loggerService.error('Failed to get version history', error as Error, { postId });
      throw error;
    }
  }

  /**
   * Compare two versions of a post
   */
  async compareVersions(postId: string, version1: number, version2: number): Promise<VersionComparison> {
    try {
      loggerService.info('Comparing post versions', {
        postId,
        version1,
        version2
      });

      const comparison = await PostVersionModel.compareVersions(postId, version1, version2);
      
      // Generate changes summary
      const changesSummary: string[] = [];
      if (comparison.differences.content) {
        changesSummary.push('Content modified');
      }
      if (comparison.differences.images) {
        changesSummary.push('Images changed');
      }
      if (comparison.differences.hashtags) {
        changesSummary.push('Hashtags updated');
      }
      if (comparison.differences.platforms) {
        changesSummary.push('Target platforms modified');
      }
      if (comparison.differences.scheduledTime) {
        changesSummary.push('Scheduled time changed');
      }

      return {
        ...comparison,
        changesSummary
      };
    } catch (error) {
      loggerService.error('Failed to compare versions', error as Error, {
        postId,
        version1,
        version2
      });
      throw error;
    }
  }

  /**
   * Revert to a previous version
   */
  async revertToVersion(postId: string, versionNumber: number, userId: string): Promise<PostVersionRow> {
    try {
      loggerService.info('Reverting to previous version', {
        postId,
        versionNumber,
        userId
      });

      // Get the target version
      const targetVersion = await PostVersionModel.findByVersion(postId, versionNumber);
      if (!targetVersion) {
        throw new Error('Target version not found');
      }

      // Create a new version with the reverted content
      const revertedVersion = await this.createPostVersion({
        post_id: postId,
        content: targetVersion.content,
        images: targetVersion.images,
        hashtags: targetVersion.hashtags,
        platforms: targetVersion.platforms,
        platform_specific_content: targetVersion.platform_specific_content,
        scheduled_time: targetVersion.scheduled_time,
        metadata: { ...targetVersion.metadata, revertedFrom: versionNumber },
        change_summary: `Reverted to version ${versionNumber}`,
        changed_by: userId,
        change_type: 'edit'
      });

      loggerService.info('Successfully reverted to previous version', {
        postId,
        revertedToVersion: versionNumber,
        newVersionNumber: revertedVersion.version_number
      });

      return revertedVersion;
    } catch (error) {
      loggerService.error('Failed to revert to version', error as Error, {
        postId,
        versionNumber,
        userId
      });
      throw error;
    }
  }

  /**
   * Add a revision comment
   */
  async addRevisionComment(
    versionId: string,
    commenterId: string,
    commentText: string,
    commentType: 'general' | 'suggestion' | 'issue' | 'approval' = 'general'
  ): Promise<any> {
    try {
      const comment = await ContentRevisionCommentModel.create(
        versionId,
        commenterId,
        commentText,
        commentType
      );

      // Notify relevant users
      const version = await PostVersionModel.findById(versionId);
      if (version && version.changed_by !== commenterId) {
        await this.notificationService.sendNotification(
          version.changed_by,
          'revision_comment',
          'New comment on your post revision',
          {
            postId: version.post_id,
            versionId,
            commentType,
            commentText: commentText.substring(0, 100)
          }
        );
      }

      return comment;
    } catch (error) {
      loggerService.error('Failed to add revision comment', error as Error, {
        versionId,
        commenterId
      });
      throw error;
    }
  }

  /**
   * Create an A/B test
   */
  async createABTest(userId: string, config: ABTestConfiguration): Promise<ContentABTestRow> {
    try {
      loggerService.info('Creating A/B test', {
        userId,
        testName: config.name,
        testType: config.testType,
        variantsCount: config.variants.length
      });

      // Validate configuration
      this.validateABTestConfig(config);

      // Create the test
      const test = await ContentABTestModel.create({
        user_id: userId,
        name: config.name,
        description: config.description,
        test_type: config.testType,
        start_date: config.duration.startDate,
        end_date: config.duration.endDate,
        confidence_level: config.confidenceLevel,
        sample_size_per_variant: config.sampleSize,
        primary_metric: config.metrics.primary,
        metadata: {
          secondaryMetrics: config.metrics.secondary || [],
          configuration: config
        }
      });

      // Add variants
      for (const variant of config.variants) {
        await ContentABTestModel.addVariant(
          test.id,
          variant.name,
          variant.postId,
          variant.trafficAllocation,
          variant.isControl || false
        );
      }

      loggerService.info('A/B test created', {
        testId: test.id,
        userId,
        testName: config.name
      });

      return test;
    } catch (error) {
      loggerService.error('Failed to create A/B test', error as Error, {
        userId,
        testName: config.name
      });
      throw error;
    }
  }

  /**
   * Start an A/B test
   */
  async startABTest(testId: string, userId: string): Promise<ContentABTestRow> {
    try {
      loggerService.info('Starting A/B test', { testId, userId });

      const test = await ContentABTestModel.updateStatus(testId, 'running', userId);
      if (!test) {
        throw new Error('A/B test not found or access denied');
      }

      // Initialize tracking for all variants
      const variants = await ContentABTestModel.getVariants(testId);
      for (const variant of variants) {
        await ContentABTestModel.recordResult(
          testId,
          variant.id,
          'impressions',
          0,
          0
        );
      }

      loggerService.info('A/B test started', { testId });
      return test;
    } catch (error) {
      loggerService.error('Failed to start A/B test', error as Error, { testId, userId });
      throw error;
    }
  }

  /**
   * Record A/B test results
   */
  async recordABTestResult(
    testId: string,
    variantId: string,
    metricName: string,
    metricValue: number,
    sampleSize: number
  ): Promise<void> {
    try {
      await ContentABTestModel.recordResult(
        testId,
        variantId,
        metricName,
        metricValue,
        sampleSize
      );

      // Check if we have enough data to determine statistical significance
      await this.checkStatisticalSignificance(testId);
    } catch (error) {
      loggerService.error('Failed to record A/B test result', error as Error, {
        testId,
        variantId,
        metricName
      });
      throw error;
    }
  }

  /**
   * Get A/B test results with analysis
   */
  async getABTestResults(testId: string, userId: string): Promise<ABTestResults> {
    try {
      const summary = await ContentABTestModel.getTestSummary(testId);
      
      if (!summary.test || summary.test.user_id !== userId) {
        throw new Error('A/B test not found or access denied');
      }

      // Generate insights and recommendations
      const insights = this.generateTestInsights(summary);
      const recommendations = this.generateTestRecommendations(summary);

      return {
        test: summary.test,
        variants: summary.variants,
        results: summary.results,
        winner: summary.winner,
        insights,
        recommendations
      };
    } catch (error) {
      loggerService.error('Failed to get A/B test results', error as Error, { testId, userId });
      throw error;
    }
  }

  /**
   * Record performance metrics for content
   */
  async recordPerformanceMetric(
    postId: string,
    metricCategory: string,
    metricName: string,
    metricValue: number,
    options: {
      platformPostId?: string;
      metricUnit?: string;
      benchmarkValue?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<ContentPerformanceMetricRow> {
    try {
      // Calculate performance score if benchmark is available
      let performanceScore: number | undefined;
      if (options.benchmarkValue && options.benchmarkValue > 0) {
        performanceScore = Math.min(100, (metricValue / options.benchmarkValue) * 100);
      }

      const metric = await ContentPerformanceMetricModel.record(
        postId,
        metricCategory,
        metricName,
        metricValue,
        options.platformPostId,
        options.metricUnit,
        options.benchmarkValue,
        performanceScore,
        options.metadata
      );

      loggerService.info('Performance metric recorded', {
        postId,
        metricCategory,
        metricName,
        metricValue,
        performanceScore
      });

      return metric;
    } catch (error) {
      loggerService.error('Failed to record performance metric', error as Error, {
        postId,
        metricCategory,
        metricName
      });
      throw error;
    }
  }

  /**
   * Get performance summary for a post
   */
  async getPerformanceSummary(postId: string): Promise<{
    overallScore: number;
    categoryScores: Record<string, number>;
    topMetrics: ContentPerformanceMetricRow[];
    trends: Record<string, 'up' | 'down' | 'stable'>;
    recommendations: string[];
  }> {
    try {
      const summary = await ContentPerformanceMetricModel.getPerformanceSummary(postId);
      const recommendations = this.generatePerformanceRecommendations(summary);

      return {
        ...summary,
        recommendations
      };
    } catch (error) {
      loggerService.error('Failed to get performance summary', error as Error, { postId });
      throw error;
    }
  }

  // Private helper methods

  private async notifyCollaborators(postId: string, version: PostVersionRow, changedBy: string): Promise<void> {
    // This would integrate with team collaboration features
    // For now, we'll just log the notification
    loggerService.info('Notifying collaborators of post change', {
      postId,
      versionId: version.id,
      changedBy
    });
  }

  private validateABTestConfig(config: ABTestConfiguration): void {
    if (config.variants.length < 2) {
      throw new Error('A/B test must have at least 2 variants');
    }

    const totalAllocation = config.variants.reduce((sum, v) => sum + v.trafficAllocation, 0);
    if (Math.abs(totalAllocation - 1.0) > 0.01) {
      throw new Error('Traffic allocation must sum to 1.0 (100%)');
    }

    const controlVariants = config.variants.filter(v => v.isControl);
    if (controlVariants.length !== 1) {
      throw new Error('Exactly one variant must be marked as control');
    }

    if (config.duration.startDate >= config.duration.endDate) {
      throw new Error('End date must be after start date');
    }

    if (config.sampleSize < 100) {
      throw new Error('Sample size must be at least 100 per variant');
    }
  }

  private async checkStatisticalSignificance(testId: string): Promise<void> {
    // This would implement statistical significance testing
    // For now, we'll just log that we're checking
    loggerService.info('Checking statistical significance', { testId });
  }

  private generateTestInsights(summary: any): string[] {
    const insights: string[] = [];

    if (summary.winner) {
      insights.push(`${summary.winner.variantName} is the winning variant with ${summary.winner.improvement.toFixed(1)}% improvement`);
      insights.push(`Statistical significance: ${(summary.winner.significance * 100).toFixed(2)}%`);
    } else {
      insights.push('No statistically significant winner detected yet');
    }

    if (summary.results.length > 0) {
      const totalSamples = summary.results.reduce((sum: number, r: any) => sum + r.sample_size, 0);
      insights.push(`Total samples collected: ${totalSamples}`);
    }

    return insights;
  }

  private generateTestRecommendations(summary: any): string[] {
    const recommendations: string[] = [];

    if (summary.winner) {
      recommendations.push(`Implement ${summary.winner.variantName} as the default version`);
      recommendations.push('Consider running follow-up tests to optimize further');
    } else {
      recommendations.push('Continue running the test to gather more data');
      recommendations.push('Consider extending the test duration if needed');
    }

    return recommendations;
  }

  private generatePerformanceRecommendations(summary: any): string[] {
    const recommendations: string[] = [];

    if (summary.overallScore < 50) {
      recommendations.push('Overall performance is below average - consider content optimization');
    } else if (summary.overallScore > 80) {
      recommendations.push('Excellent performance! Consider using this as a template for future posts');
    }

    // Check trends
    const decliningMetrics = Object.entries(summary.trends)
      .filter(([_, trend]) => trend === 'down')
      .map(([metric, _]) => metric);

    if (decliningMetrics.length > 0) {
      recommendations.push(`Monitor declining metrics: ${decliningMetrics.join(', ')}`);
    }

    // Check category performance
    const lowPerformingCategories = Object.entries(summary.categoryScores)
      .filter(([_, score]) => (score as number) < 60)
      .map(([category, _]) => category);

    if (lowPerformingCategories.length > 0) {
      recommendations.push(`Focus on improving: ${lowPerformingCategories.join(', ')}`);
    }

    return recommendations;
  }
}