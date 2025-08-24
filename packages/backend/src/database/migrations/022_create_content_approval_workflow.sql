-- Create content approval workflow tables

-- Team members table for collaboration
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member', -- owner, admin, editor, viewer
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, team_owner_id)
);

-- Content approval workflows
CREATE TABLE IF NOT EXISTS content_approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    steps JSONB NOT NULL, -- Array of approval steps with roles and requirements
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, name)
);

-- Content approval requests
CREATE TABLE IF NOT EXISTS content_approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES content_approval_workflows(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_step INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, cancelled
    priority VARCHAR(10) DEFAULT 'normal', -- low, normal, high, urgent
    due_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual approval actions
CREATE TABLE IF NOT EXISTS content_approval_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_request_id UUID NOT NULL REFERENCES content_approval_requests(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL, -- approve, reject, request_changes
    comments TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_owner_id ON team_members(team_owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);

CREATE INDEX IF NOT EXISTS idx_content_approval_workflows_user_id ON content_approval_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_content_approval_workflows_active ON content_approval_workflows(is_active);

CREATE INDEX IF NOT EXISTS idx_content_approval_requests_post_id ON content_approval_requests(post_id);
CREATE INDEX IF NOT EXISTS idx_content_approval_requests_workflow_id ON content_approval_requests(workflow_id);
CREATE INDEX IF NOT EXISTS idx_content_approval_requests_requester_id ON content_approval_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_content_approval_requests_status ON content_approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_content_approval_requests_due_date ON content_approval_requests(due_date);

CREATE INDEX IF NOT EXISTS idx_content_approval_actions_request_id ON content_approval_actions(approval_request_id);
CREATE INDEX IF NOT EXISTS idx_content_approval_actions_approver_id ON content_approval_actions(approver_id);

-- Create triggers for updated_at
CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON team_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_approval_workflows_updated_at BEFORE UPDATE ON content_approval_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_approval_requests_updated_at BEFORE UPDATE ON content_approval_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE team_members IS 'Team collaboration members and their roles';
COMMENT ON TABLE content_approval_workflows IS 'Configurable approval workflows for content review';
COMMENT ON TABLE content_approval_requests IS 'Active approval requests for posts';
COMMENT ON TABLE content_approval_actions IS 'Individual approval/rejection actions by team members';