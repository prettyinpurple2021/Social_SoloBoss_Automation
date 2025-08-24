-- Create content versioning and revision history tables

-- Post versions for revision history
CREATE TABLE IF NOT EXISTS post_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    images TEXT[] DEFAULT '{}',
    hashtags TEXT[] DEFAULT '{}',
    platforms TEXT[] NOT NULL,
    platform_specific_content JSONB DEFAULT '{}',
    scheduled_time TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    change_summary TEXT,
    changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    change_type VARCHAR(20) DEFAULT 'edit', -- create, edit, schedule, publish, archive
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(post_id, version_number)
);

-- Content revision comments
CREATE TABLE IF NOT EXISTS content_revision_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_version_id UUID NOT NULL REFERENCES post_versions(id) ON DELETE CASCADE,
    commenter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    comment_type VARCHAR(20) DEFAULT 'general', -- general, suggestion, issue, approval
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content comparison snapshots for A/B testing
CREATE TABLE IF NOT EXISTS content_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    test_type VARCHAR(20) DEFAULT 'content', -- content, timing, platform, hashtags
    status VARCHAR(20) DEFAULT 'draft', -- draft, running, completed, cancelled
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    confidence_level DECIMAL(3,2) DEFAULT 0.95,
    sample_size_per_variant INTEGER DEFAULT 100,
    primary_metric VARCHAR(50) DEFAULT 'engagement_rate', -- engagement_rate, clicks, shares, etc.
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, name)
);

-- A/B test variants
CREATE TABLE IF NOT EXISTS content_ab_test_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ab_test_id UUID NOT NULL REFERENCES content_ab_tests(id) ON DELETE CASCADE,
    variant_name VARCHAR(100) NOT NULL, -- control, variant_a, variant_b, etc.
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    traffic_allocation DECIMAL(3,2) DEFAULT 0.50, -- Percentage of traffic (0.0 to 1.0)
    is_control BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B test results
CREATE TABLE IF NOT EXISTS content_ab_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ab_test_id UUID NOT NULL REFERENCES content_ab_tests(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES content_ab_test_variants(id) ON DELETE CASCADE,
    metric_name VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    sample_size INTEGER NOT NULL,
    confidence_interval_lower DECIMAL(10,4),
    confidence_interval_upper DECIMAL(10,4),
    statistical_significance DECIMAL(5,4), -- p-value
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(ab_test_id, variant_id, metric_name, recorded_at)
);

-- Content performance tracking (enhanced)
CREATE TABLE IF NOT EXISTS content_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    platform_post_id UUID REFERENCES platform_posts(id) ON DELETE CASCADE,
    metric_category VARCHAR(50) NOT NULL, -- engagement, reach, conversion, sentiment
    metric_name VARCHAR(50) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(20), -- count, percentage, rate, score
    benchmark_value DECIMAL(15,4), -- Industry or historical benchmark
    performance_score DECIMAL(5,2), -- Calculated performance score (0-100)
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_post_versions_post_id ON post_versions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_versions_version_number ON post_versions(post_id, version_number);
CREATE INDEX IF NOT EXISTS idx_post_versions_changed_by ON post_versions(changed_by);
CREATE INDEX IF NOT EXISTS idx_post_versions_change_type ON post_versions(change_type);
CREATE INDEX IF NOT EXISTS idx_post_versions_created_at ON post_versions(created_at);

CREATE INDEX IF NOT EXISTS idx_content_revision_comments_post_version_id ON content_revision_comments(post_version_id);
CREATE INDEX IF NOT EXISTS idx_content_revision_comments_commenter_id ON content_revision_comments(commenter_id);
CREATE INDEX IF NOT EXISTS idx_content_revision_comments_resolved ON content_revision_comments(is_resolved);

CREATE INDEX IF NOT EXISTS idx_content_ab_tests_user_id ON content_ab_tests(user_id);
CREATE INDEX IF NOT EXISTS idx_content_ab_tests_status ON content_ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_content_ab_tests_dates ON content_ab_tests(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_content_ab_test_variants_ab_test_id ON content_ab_test_variants(ab_test_id);
CREATE INDEX IF NOT EXISTS idx_content_ab_test_variants_post_id ON content_ab_test_variants(post_id);

CREATE INDEX IF NOT EXISTS idx_content_ab_test_results_ab_test_id ON content_ab_test_results(ab_test_id);
CREATE INDEX IF NOT EXISTS idx_content_ab_test_results_variant_id ON content_ab_test_results(variant_id);
CREATE INDEX IF NOT EXISTS idx_content_ab_test_results_recorded_at ON content_ab_test_results(recorded_at);

CREATE INDEX IF NOT EXISTS idx_content_performance_metrics_post_id ON content_performance_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_content_performance_metrics_platform_post_id ON content_performance_metrics(platform_post_id);
CREATE INDEX IF NOT EXISTS idx_content_performance_metrics_category ON content_performance_metrics(metric_category);
CREATE INDEX IF NOT EXISTS idx_content_performance_metrics_recorded_at ON content_performance_metrics(recorded_at);

-- Create triggers for updated_at
CREATE TRIGGER update_content_revision_comments_updated_at BEFORE UPDATE ON content_revision_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_ab_tests_updated_at BEFORE UPDATE ON content_ab_tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE post_versions IS 'Version history for posts with change tracking';
COMMENT ON TABLE content_revision_comments IS 'Comments and feedback on specific post versions';
COMMENT ON TABLE content_ab_tests IS 'A/B testing configurations for content optimization';
COMMENT ON TABLE content_ab_test_variants IS 'Different variants being tested in A/B tests';
COMMENT ON TABLE content_ab_test_results IS 'Statistical results from A/B tests';
COMMENT ON TABLE content_performance_metrics IS 'Detailed performance metrics for content analysis';