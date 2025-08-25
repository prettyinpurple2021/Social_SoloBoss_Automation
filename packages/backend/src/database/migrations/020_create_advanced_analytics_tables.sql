-- Create tables for advanced analytics features

-- Custom Dashboards table
CREATE TABLE IF NOT EXISTS custom_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    widgets JSONB NOT NULL DEFAULT '[]',
    is_default BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KPI Definitions table
CREATE TABLE IF NOT EXISTS kpi_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    formula TEXT NOT NULL,
    target DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('engagement', 'reach', 'conversion', 'growth', 'efficiency')),
    platforms TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report Templates table
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('executive_summary', 'detailed_analytics', 'performance_report', 'custom')),
    sections JSONB NOT NULL DEFAULT '[]',
    schedule JSONB NOT NULL DEFAULT '{}',
    recipients TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated Reports table
CREATE TABLE IF NOT EXISTS generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content JSONB NOT NULL DEFAULT '{}',
    format VARCHAR(10) NOT NULL CHECK (format IN ('html', 'pdf', 'json')),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    recipients TEXT[] DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'sent', 'failed')),
    error_message TEXT
);

-- Competitor Profiles table
CREATE TABLE IF NOT EXISTS competitor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    industry VARCHAR(100) NOT NULL,
    platforms JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competitive Metrics table
CREATE TABLE IF NOT EXISTS competitive_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES competitor_profiles(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    followers INTEGER NOT NULL DEFAULT 0,
    following INTEGER NOT NULL DEFAULT 0,
    posts INTEGER NOT NULL DEFAULT 0,
    avg_engagement_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    avg_likes INTEGER NOT NULL DEFAULT 0,
    avg_comments INTEGER NOT NULL DEFAULT 0,
    avg_shares INTEGER NOT NULL DEFAULT 0,
    post_frequency DECIMAL(5,2) NOT NULL DEFAULT 0,
    top_hashtags TEXT[] DEFAULT '{}',
    content_types JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(competitor_id, platform, date)
);

-- Industry Benchmarks table
CREATE TABLE IF NOT EXISTS industry_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry VARCHAR(100) NOT NULL,
    platform VARCHAR(20) NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}',
    sample_size INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(industry, platform)
);

-- Conversion Goals table
CREATE TABLE IF NOT EXISTS conversion_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('website_visit', 'signup', 'purchase', 'download', 'contact', 'custom')),
    value DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    tracking_method VARCHAR(50) NOT NULL CHECK (tracking_method IN ('utm_parameters', 'pixel_tracking', 'api_integration', 'manual')),
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversion Events table
CREATE TABLE IF NOT EXISTS conversion_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES conversion_goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    platform VARCHAR(20),
    session_id VARCHAR(255),
    visitor_id VARCHAR(255),
    value DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    attribution_data JSONB NOT NULL DEFAULT '{}',
    event_data JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    budget DECIMAL(10,2),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    goals TEXT[] DEFAULT '{}',
    posts TEXT[] DEFAULT '{}',
    platforms TEXT[] DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Predictive Models table
CREATE TABLE IF NOT EXISTS predictive_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('optimal_timing', 'content_performance', 'engagement_prediction', 'hashtag_recommendation')),
    algorithm VARCHAR(50) NOT NULL CHECK (algorithm IN ('linear_regression', 'random_forest', 'neural_network', 'time_series')),
    features TEXT[] DEFAULT '{}',
    accuracy DECIMAL(5,4) NOT NULL DEFAULT 0,
    last_trained TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_dashboards_user_id ON custom_dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_dashboards_is_public ON custom_dashboards(is_public) WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_kpi_definitions_user_id ON kpi_definitions(user_id);
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_category ON kpi_definitions(category);
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_is_active ON kpi_definitions(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_report_templates_user_id ON report_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_is_active ON report_templates(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_generated_reports_user_id ON generated_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_template_id ON generated_reports(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_generated_at ON generated_reports(generated_at);

CREATE INDEX IF NOT EXISTS idx_competitor_profiles_user_id ON competitor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_competitor_profiles_industry ON competitor_profiles(industry);

CREATE INDEX IF NOT EXISTS idx_competitive_metrics_competitor_id ON competitive_metrics(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitive_metrics_platform ON competitive_metrics(platform);
CREATE INDEX IF NOT EXISTS idx_competitive_metrics_date ON competitive_metrics(date);

CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_industry ON industry_benchmarks(industry);
CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_platform ON industry_benchmarks(platform);

CREATE INDEX IF NOT EXISTS idx_conversion_goals_user_id ON conversion_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_goals_type ON conversion_goals(type);
CREATE INDEX IF NOT EXISTS idx_conversion_goals_is_active ON conversion_goals(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_conversion_events_goal_id ON conversion_events(goal_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_user_id ON conversion_events(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_post_id ON conversion_events(post_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_timestamp ON conversion_events(timestamp);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_start_date ON campaigns(start_date);

CREATE INDEX IF NOT EXISTS idx_predictive_models_user_id ON predictive_models(user_id);
CREATE INDEX IF NOT EXISTS idx_predictive_models_type ON predictive_models(type);
CREATE INDEX IF NOT EXISTS idx_predictive_models_is_active ON predictive_models(is_active) WHERE is_active = true;

-- Add comments for documentation
COMMENT ON TABLE custom_dashboards IS 'User-created custom analytics dashboards with configurable widgets';
COMMENT ON TABLE kpi_definitions IS 'User-defined KPIs with formulas and targets';
COMMENT ON TABLE report_templates IS 'Templates for automated report generation';
COMMENT ON TABLE generated_reports IS 'Generated reports from templates';
COMMENT ON TABLE competitor_profiles IS 'Competitor profiles for competitive analysis';
COMMENT ON TABLE competitive_metrics IS 'Historical metrics data for competitors';
COMMENT ON TABLE industry_benchmarks IS 'Industry benchmark data for comparison';
COMMENT ON TABLE conversion_goals IS 'Conversion goals for ROI tracking';
COMMENT ON TABLE conversion_events IS 'Tracked conversion events with attribution data';
COMMENT ON TABLE campaigns IS 'Marketing campaigns for ROI analysis';
COMMENT ON TABLE predictive_models IS 'Machine learning models for predictive analytics';