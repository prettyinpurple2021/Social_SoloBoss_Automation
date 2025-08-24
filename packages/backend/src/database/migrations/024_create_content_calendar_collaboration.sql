-- Create content calendar and collaboration features

-- Content calendar events
CREATE TABLE IF NOT EXISTS content_calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(20) DEFAULT 'post', -- post, campaign, deadline, meeting, review
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    all_day BOOLEAN DEFAULT FALSE,
    recurrence_rule TEXT, -- RRULE format for recurring events
    color VARCHAR(7) DEFAULT '#2196F3',
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    priority VARCHAR(10) DEFAULT 'normal', -- low, normal, high, urgent
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content calendar sharing and permissions
CREATE TABLE IF NOT EXISTS content_calendar_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_level VARCHAR(20) DEFAULT 'view', -- view, edit, admin
    can_create_events BOOLEAN DEFAULT FALSE,
    can_edit_events BOOLEAN DEFAULT FALSE,
    can_delete_events BOOLEAN DEFAULT FALSE,
    can_assign_tasks BOOLEAN DEFAULT FALSE,
    shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE(calendar_owner_id, shared_with_id)
);

-- Content campaigns for organizing related posts
CREATE TABLE IF NOT EXISTS content_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(50), -- product_launch, seasonal, awareness, etc.
    start_date DATE,
    end_date DATE,
    budget DECIMAL(10,2),
    target_audience TEXT,
    goals TEXT,
    kpis JSONB DEFAULT '{}', -- Key Performance Indicators
    status VARCHAR(20) DEFAULT 'planning', -- planning, active, paused, completed, cancelled
    color VARCHAR(7) DEFAULT '#4CAF50',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, name)
);

-- Link posts to campaigns
CREATE TABLE IF NOT EXISTS campaign_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES content_campaigns(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    post_role VARCHAR(50), -- hero, supporting, follow_up, etc.
    sequence_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(campaign_id, post_id)
);

-- Editorial workflow states
CREATE TABLE IF NOT EXISTS editorial_workflow_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#9E9E9E',
    is_initial_state BOOLEAN DEFAULT FALSE,
    is_final_state BOOLEAN DEFAULT FALSE,
    allowed_transitions TEXT[], -- Array of state names that can be transitioned to
    required_roles TEXT[], -- Roles that can transition to this state
    auto_assign_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, name)
);

-- Track editorial workflow state changes
CREATE TABLE IF NOT EXISTS post_workflow_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    from_state_id UUID REFERENCES editorial_workflow_states(id) ON DELETE SET NULL,
    to_state_id UUID NOT NULL REFERENCES editorial_workflow_states(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    change_reason TEXT,
    time_in_previous_state INTERVAL, -- How long the post was in the previous state
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content collaboration comments (different from revision comments)
CREATE TABLE IF NOT EXISTS content_collaboration_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    commenter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES content_collaboration_comments(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    comment_type VARCHAR(20) DEFAULT 'general', -- general, suggestion, question, approval, rejection
    is_internal BOOLEAN DEFAULT TRUE, -- Internal team comment vs client-facing
    mentions TEXT[], -- Array of user IDs mentioned in the comment
    attachments JSONB DEFAULT '{}',
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_content_calendar_events_user_id ON content_calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_content_calendar_events_dates ON content_calendar_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_content_calendar_events_type ON content_calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_content_calendar_events_status ON content_calendar_events(status);
CREATE INDEX IF NOT EXISTS idx_content_calendar_events_assigned_to ON content_calendar_events(assigned_to);
CREATE INDEX IF NOT EXISTS idx_content_calendar_events_post_id ON content_calendar_events(post_id);

CREATE INDEX IF NOT EXISTS idx_content_calendar_shares_owner ON content_calendar_shares(calendar_owner_id);
CREATE INDEX IF NOT EXISTS idx_content_calendar_shares_shared_with ON content_calendar_shares(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_content_calendar_shares_active ON content_calendar_shares(is_active);

CREATE INDEX IF NOT EXISTS idx_content_campaigns_user_id ON content_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_content_campaigns_status ON content_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_content_campaigns_dates ON content_campaigns(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_campaign_posts_campaign_id ON campaign_posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_posts_post_id ON campaign_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_campaign_posts_sequence ON campaign_posts(campaign_id, sequence_order);

CREATE INDEX IF NOT EXISTS idx_editorial_workflow_states_user_id ON editorial_workflow_states(user_id);
CREATE INDEX IF NOT EXISTS idx_editorial_workflow_states_initial ON editorial_workflow_states(is_initial_state);
CREATE INDEX IF NOT EXISTS idx_editorial_workflow_states_final ON editorial_workflow_states(is_final_state);

CREATE INDEX IF NOT EXISTS idx_post_workflow_history_post_id ON post_workflow_history(post_id);
CREATE INDEX IF NOT EXISTS idx_post_workflow_history_states ON post_workflow_history(from_state_id, to_state_id);
CREATE INDEX IF NOT EXISTS idx_post_workflow_history_changed_by ON post_workflow_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_post_workflow_history_created_at ON post_workflow_history(created_at);

CREATE INDEX IF NOT EXISTS idx_content_collaboration_comments_post_id ON content_collaboration_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_content_collaboration_comments_commenter_id ON content_collaboration_comments(commenter_id);
CREATE INDEX IF NOT EXISTS idx_content_collaboration_comments_parent ON content_collaboration_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_content_collaboration_comments_resolved ON content_collaboration_comments(is_resolved);
CREATE INDEX IF NOT EXISTS idx_content_collaboration_comments_mentions ON content_collaboration_comments USING GIN(mentions);

-- Create triggers for updated_at
CREATE TRIGGER update_content_calendar_events_updated_at BEFORE UPDATE ON content_calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_campaigns_updated_at BEFORE UPDATE ON content_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_editorial_workflow_states_updated_at BEFORE UPDATE ON editorial_workflow_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_collaboration_comments_updated_at BEFORE UPDATE ON content_collaboration_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE content_calendar_events IS 'Calendar events for content planning and scheduling';
COMMENT ON TABLE content_calendar_shares IS 'Calendar sharing permissions for team collaboration';
COMMENT ON TABLE content_campaigns IS 'Content campaigns for organizing related posts and tracking goals';
COMMENT ON TABLE campaign_posts IS 'Links posts to campaigns with role and sequence information';
COMMENT ON TABLE editorial_workflow_states IS 'Configurable workflow states for editorial process';
COMMENT ON TABLE post_workflow_history IS 'History of workflow state changes for posts';
COMMENT ON TABLE content_collaboration_comments IS 'Team collaboration comments on posts';