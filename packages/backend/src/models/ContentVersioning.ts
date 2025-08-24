import { db } from '../database';

export interface PostVersionRow {
  id: string;
  post_id: string;
  version_number: number;
  content: string;
  images: string[];
  hashtags: string[];
  platforms: string[];
  platform_specific_content: Record<string, any>;
  scheduled_time?: Date;
  metadata: Record<string, any>;
  change_summary?: string;
  changed_by: string;
  change_type: 'create' | 'edit' | 'schedule' | 'publish' | 'archive';
  created_at: Date;
}

export interface ContentRevisionCommentRow {
  id: string;
  post_version_id: string;
  commenter_id: string;
  comment_text: string;
  comment_type: 'general' | 'suggestion' | 'issue' | 'approval';
  is_resolved: boolean;
  resolved_by?: string;
  resolved_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ContentABTestRow {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  test_type: 'content' | 'timing' | 'platform' | 'hashtags';
  status: 'draft' | 'running' | 'completed' | 'cancelled';
  start_date?: Date;
  end_date?: Date;
  confidence_level: number;
  sample_size_per_variant: number;
  primary_metric: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface ContentABTestVariantRow {
  id: string;
  ab_test_id: string;
  variant_name: string;
  post_id: string;
  traffic_allocation: number;
  is_control: boolean;
  created_at: Date;
}

export interface ContentABTestResultRow {
  id: string;
  ab_test_id: string;
  variant_id: string;
  metric_name: string;
  metric_value: number;
  sample_size: number;
  confidence_interval_lower?: number;
  confidence_interval_upper?: number;
  statistical_significance?: number;
  recorded_at: Date;
}

export interface ContentPerformanceMetricRow {
  id: string;
  post_id: string;
  platform_post_id?: string;
  metric_category: string;
  metric_name: string;
  metric_value: number;
  metric_unit?: string;
  benchmark_value?: number;
  performance_score?: number;
  recorded_at: Date;
  metadata: Record<string, any>;
}

export interface CreatePostVersionInput {
  post_id: string;
  content: string;
  images?: string[];
  hashtags?: string[];
  platforms: string[];
  platform_specific_content?: Record<string, any>;
  scheduled_time?: Date;
  metadata?: Record<string, any>;
  change_summary?: string;
  changed_by: string;
  change_type: 'create' | 'edit' | 'schedule' | 'publish' | 'archive';
}

export interface CreateABTestInput {
  user_id: string;
  name: string;
  description?: string;
  test_type: 'content' | 'timing' | 'platform' | 'hashtags';
  start_date?: Date;
  end_date?: Date;
  confidence_level?: number;
  sample_size_per_variant?: number;
  primary_metric?: string;
  metadata?: Record<string, any>;
}

export class PostVersionModel {
  static async create(input: CreatePostVersionInput): Promise<PostVersionRow> {
    // Get the next version number
    const versionQuery = `
      SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
      FROM post_versions
      WHERE post_id = $1
    `;
    
    const versionResult = await db.query(versionQuery, [input.post_id]);
    const nextVersion = versionResult.rows[0].next_version;

    const query = `
      INSERT INTO post_versions (
        post_id, version_number, content, images, hashtags, platforms,
        platform_specific_content, scheduled_time, metadata, change_summary,
        changed_by, change_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    
    const values = [
      input.post_id,
      nextVersion,
      input.content,
      input.images || [],
      input.hashtags || [],
      input.platforms,
      input.platform_specific_content || {},
      input.scheduled_time || null,
      input.metadata || {},
      input.change_summary || null,
      input.changed_by,
      input.change_type
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByPostId(postId: string, limit?: number): Promise<PostVersionRow[]> {
    let query = `
      SELECT pv.*, u.name as changed_by_name, u.email as changed_by_email
      FROM post_versions pv
      JOIN users u ON pv.changed_by = u.id
      WHERE pv.post_id = $1
      ORDER BY pv.version_number DESC
    `;
    
    const values = [postId];
    
    if (limit) {
      query += ` LIMIT $2`;
      values.push(limit.toString());
    }

    const result = await db.query(query, values);
    return result.rows;
  }

  static async findById(id: string): Promise<PostVersionRow | null> {
    const query = `
      SELECT pv.*, u.name as changed_by_name, u.email as changed_by_email
      FROM post_versions pv
      JOIN users u ON pv.changed_by = u.id
      WHERE pv.id = $1
    `;
    
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByVersion(postId: string, versionNumber: number): Promise<PostVersionRow | null> {
    const query = `
      SELECT pv.*, u.name as changed_by_name, u.email as changed_by_email
      FROM post_versions pv
      JOIN users u ON pv.changed_by = u.id
      WHERE pv.post_id = $1 AND pv.version_number = $2
    `;
    
    const result = await db.query(query, [postId, versionNumber]);
    return result.rows[0] || null;
  }

  static async getVersionStats(postId: string): Promise<{
    totalVersions: number;
    latestVersion: number;
    contributors: string[];
    changeTypes: Record<string, number>;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_versions,
        MAX(version_number) as latest_version,
        array_agg(DISTINCT changed_by) as contributors,
        json_object_agg(change_type, type_count) as change_types
      FROM (
        SELECT 
          changed_by,
          change_type,
          COUNT(*) as type_count
        FROM post_versions
        WHERE post_id = $1
        GROUP BY changed_by, change_type
      ) subquery
    `;
    
    const result = await db.query(query, [postId]);
    const row = result.rows[0];
    
    return {
      totalVersions: parseInt(row.total_versions) || 0,
      latestVersion: parseInt(row.latest_version) || 0,
      contributors: row.contributors || [],
      changeTypes: row.change_types || {}
    };
  }

  static async compareVersions(postId: string, version1: number, version2: number): Promise<{
    version1: PostVersionRow | null;
    version2: PostVersionRow | null;
    differences: {
      content: boolean;
      images: boolean;
      hashtags: boolean;
      platforms: boolean;
      scheduledTime: boolean;
    };
  }> {
    const v1 = await this.findByVersion(postId, version1);
    const v2 = await this.findByVersion(postId, version2);
    
    const differences = {
      content: v1?.content !== v2?.content,
      images: JSON.stringify(v1?.images) !== JSON.stringify(v2?.images),
      hashtags: JSON.stringify(v1?.hashtags) !== JSON.stringify(v2?.hashtags),
      platforms: JSON.stringify(v1?.platforms) !== JSON.stringify(v2?.platforms),
      scheduledTime: v1?.scheduled_time?.getTime() !== v2?.scheduled_time?.getTime()
    };

    return {
      version1: v1,
      version2: v2,
      differences
    };
  }
}

export class ContentRevisionCommentModel {
  static async create(
    postVersionId: string,
    commenterId: string,
    commentText: string,
    commentType: 'general' | 'suggestion' | 'issue' | 'approval' = 'general'
  ): Promise<ContentRevisionCommentRow> {
    const query = `
      INSERT INTO content_revision_comments (
        post_version_id, commenter_id, comment_text, comment_type
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [postVersionId, commenterId, commentText, commentType];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByVersionId(versionId: string): Promise<ContentRevisionCommentRow[]> {
    const query = `
      SELECT crc.*, u.name as commenter_name, u.email as commenter_email,
             ru.name as resolved_by_name
      FROM content_revision_comments crc
      JOIN users u ON crc.commenter_id = u.id
      LEFT JOIN users ru ON crc.resolved_by = ru.id
      WHERE crc.post_version_id = $1
      ORDER BY crc.created_at ASC
    `;
    
    const result = await db.query(query, [versionId]);
    return result.rows;
  }

  static async resolve(id: string, resolvedBy: string): Promise<ContentRevisionCommentRow | null> {
    const query = `
      UPDATE content_revision_comments 
      SET is_resolved = true, resolved_by = $1, resolved_at = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await db.query(query, [resolvedBy, id]);
    return result.rows[0] || null;
  }
}

export class ContentABTestModel {
  static async create(input: CreateABTestInput): Promise<ContentABTestRow> {
    const query = `
      INSERT INTO content_ab_tests (
        user_id, name, description, test_type, start_date, end_date,
        confidence_level, sample_size_per_variant, primary_metric, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const values = [
      input.user_id,
      input.name,
      input.description || null,
      input.test_type,
      input.start_date || null,
      input.end_date || null,
      input.confidence_level || 0.95,
      input.sample_size_per_variant || 100,
      input.primary_metric || 'engagement_rate',
      input.metadata || {}
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByUserId(userId: string, status?: string): Promise<ContentABTestRow[]> {
    let query = 'SELECT * FROM content_ab_tests WHERE user_id = $1';
    const values = [userId];
    
    if (status) {
      query += ' AND status = $2';
      values.push(status);
    }
    
    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, values);
    return result.rows;
  }

  static async findById(id: string, userId?: string): Promise<ContentABTestRow | null> {
    let query = 'SELECT * FROM content_ab_tests WHERE id = $1';
    const values = [id];
    
    if (userId) {
      query += ' AND user_id = $2';
      values.push(userId);
    }

    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  static async updateStatus(id: string, status: string, userId?: string): Promise<ContentABTestRow | null> {
    let query = 'UPDATE content_ab_tests SET status = $1, updated_at = NOW() WHERE id = $2';
    const values = [status, id];
    
    if (userId) {
      query += ' AND user_id = $3';
      values.push(userId);
    }
    
    query += ' RETURNING *';

    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  static async addVariant(
    abTestId: string,
    variantName: string,
    postId: string,
    trafficAllocation: number,
    isControl: boolean = false
  ): Promise<ContentABTestVariantRow> {
    const query = `
      INSERT INTO content_ab_test_variants (
        ab_test_id, variant_name, post_id, traffic_allocation, is_control
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const values = [abTestId, variantName, postId, trafficAllocation, isControl];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async getVariants(abTestId: string): Promise<ContentABTestVariantRow[]> {
    const query = `
      SELECT catv.*, p.content, p.platforms
      FROM content_ab_test_variants catv
      JOIN posts p ON catv.post_id = p.id
      WHERE catv.ab_test_id = $1
      ORDER BY catv.is_control DESC, catv.created_at ASC
    `;
    
    const result = await db.query(query, [abTestId]);
    return result.rows;
  }

  static async recordResult(
    abTestId: string,
    variantId: string,
    metricName: string,
    metricValue: number,
    sampleSize: number,
    confidenceIntervalLower?: number,
    confidenceIntervalUpper?: number,
    statisticalSignificance?: number
  ): Promise<ContentABTestResultRow> {
    const query = `
      INSERT INTO content_ab_test_results (
        ab_test_id, variant_id, metric_name, metric_value, sample_size,
        confidence_interval_lower, confidence_interval_upper, statistical_significance
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      abTestId, variantId, metricName, metricValue, sampleSize,
      confidenceIntervalLower || null,
      confidenceIntervalUpper || null,
      statisticalSignificance || null
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async getResults(abTestId: string): Promise<ContentABTestResultRow[]> {
    const query = `
      SELECT catr.*, catv.variant_name, catv.is_control
      FROM content_ab_test_results catr
      JOIN content_ab_test_variants catv ON catr.variant_id = catv.id
      WHERE catr.ab_test_id = $1
      ORDER BY catv.is_control DESC, catr.recorded_at DESC
    `;
    
    const result = await db.query(query, [abTestId]);
    return result.rows;
  }

  static async getTestSummary(abTestId: string): Promise<{
    test: ContentABTestRow | null;
    variants: ContentABTestVariantRow[];
    results: ContentABTestResultRow[];
    winner?: {
      variantId: string;
      variantName: string;
      improvement: number;
      significance: number;
    };
  }> {
    const test = await this.findById(abTestId);
    const variants = await this.getVariants(abTestId);
    const results = await this.getResults(abTestId);

    // Calculate winner (simplified)
    let winner;
    if (results.length > 0 && test?.primary_metric) {
      const metricResults = results.filter(r => r.metric_name === test.primary_metric);
      const controlResult = metricResults.find(r => r.is_control);
      
      if (controlResult) {
        const bestVariant = metricResults
          .filter(r => !r.is_control)
          .sort((a, b) => b.metric_value - a.metric_value)[0];
        
        if (bestVariant && bestVariant.statistical_significance && bestVariant.statistical_significance < 0.05) {
          const improvement = ((bestVariant.metric_value - controlResult.metric_value) / controlResult.metric_value) * 100;
          winner = {
            variantId: bestVariant.variant_id,
            variantName: bestVariant.variant_name,
            improvement,
            significance: bestVariant.statistical_significance
          };
        }
      }
    }

    return { test, variants, results, winner };
  }
}

export class ContentPerformanceMetricModel {
  static async record(
    postId: string,
    metricCategory: string,
    metricName: string,
    metricValue: number,
    platformPostId?: string,
    metricUnit?: string,
    benchmarkValue?: number,
    performanceScore?: number,
    metadata?: Record<string, any>
  ): Promise<ContentPerformanceMetricRow> {
    const query = `
      INSERT INTO content_performance_metrics (
        post_id, platform_post_id, metric_category, metric_name, metric_value,
        metric_unit, benchmark_value, performance_score, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      postId,
      platformPostId || null,
      metricCategory,
      metricName,
      metricValue,
      metricUnit || null,
      benchmarkValue || null,
      performanceScore || null,
      metadata || {}
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByPostId(postId: string, category?: string): Promise<ContentPerformanceMetricRow[]> {
    let query = 'SELECT * FROM content_performance_metrics WHERE post_id = $1';
    const values = [postId];
    
    if (category) {
      query += ' AND metric_category = $2';
      values.push(category);
    }
    
    query += ' ORDER BY recorded_at DESC';

    const result = await db.query(query, values);
    return result.rows;
  }

  static async getPerformanceSummary(postId: string): Promise<{
    overallScore: number;
    categoryScores: Record<string, number>;
    topMetrics: ContentPerformanceMetricRow[];
    trends: Record<string, 'up' | 'down' | 'stable'>;
  }> {
    const metrics = await this.findByPostId(postId);
    
    // Calculate overall score (average of all performance scores)
    const scoresWithValues = metrics.filter(m => m.performance_score !== null);
    const overallScore = scoresWithValues.length > 0
      ? scoresWithValues.reduce((sum, m) => sum + (m.performance_score || 0), 0) / scoresWithValues.length
      : 0;

    // Calculate category scores
    const categoryScores: Record<string, number> = {};
    const categories = [...new Set(metrics.map(m => m.metric_category))];
    
    for (const category of categories) {
      const categoryMetrics = metrics.filter(m => m.metric_category === category && m.performance_score !== null);
      if (categoryMetrics.length > 0) {
        categoryScores[category] = categoryMetrics.reduce((sum, m) => sum + (m.performance_score || 0), 0) / categoryMetrics.length;
      }
    }

    // Get top performing metrics
    const topMetrics = metrics
      .filter(m => m.performance_score !== null)
      .sort((a, b) => (b.performance_score || 0) - (a.performance_score || 0))
      .slice(0, 5);

    // Calculate trends (simplified - compare latest vs previous)
    const trends: Record<string, 'up' | 'down' | 'stable'> = {};
    const metricNames = [...new Set(metrics.map(m => m.metric_name))];
    
    for (const metricName of metricNames) {
      const metricHistory = metrics
        .filter(m => m.metric_name === metricName)
        .sort((a, b) => b.recorded_at.getTime() - a.recorded_at.getTime());
      
      if (metricHistory.length >= 2) {
        const latest = metricHistory[0].metric_value;
        const previous = metricHistory[1].metric_value;
        const change = ((latest - previous) / previous) * 100;
        
        if (Math.abs(change) < 5) {
          trends[metricName] = 'stable';
        } else if (change > 0) {
          trends[metricName] = 'up';
        } else {
          trends[metricName] = 'down';
        }
      }
    }

    return {
      overallScore,
      categoryScores,
      topMetrics,
      trends
    };
  }
}