-- Create post_analytics table for storing performance metrics
CREATE TABLE IF NOT EXISTS post_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_post_id UUID NOT NULL REFERENCES platform_posts(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_value INTEGER NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure valid metric types
    CONSTRAINT post_analytics_metric_type_check CHECK (
        metric_type IN ('likes', 'shares', 'comments', 'views', 'impressions', 'reach', 'clicks', 'saves', 'engagement_rate')
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_analytics_platform_post_id ON post_analytics(platform_post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_metric_type ON post_analytics(metric_type);
CREATE INDEX IF NOT EXISTS idx_post_analytics_recorded_at ON post_analytics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_post_analytics_metadata ON post_analytics USING GIN(metadata);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_post_analytics_platform_metric ON post_analytics(platform_post_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_post_analytics_metric_recorded ON post_analytics(metric_type, recorded_at);

-- Add comments for documentation
COMMENT ON TABLE post_analytics IS 'Performance metrics for published posts';
COMMENT ON COLUMN post_analytics.metric_type IS 'Type of metric (likes, shares, comments, etc.)';
COMMENT ON COLUMN post_analytics.metric_value IS 'Numeric value of the metric';
COMMENT ON COLUMN post_analytics.recorded_at IS 'When the metric was recorded';
COMMENT ON COLUMN post_analytics.metadata IS 'Additional metric context and platform-specific data';