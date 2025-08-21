-- Create SoloBoss integrations table
CREATE TABLE IF NOT EXISTS soloboss_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key TEXT NOT NULL, -- encrypted
    webhook_secret TEXT NOT NULL, -- encrypted
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure one active integration per user
    UNIQUE(user_id, is_active) WHERE is_active = true
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_soloboss_integrations_user_id ON soloboss_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_soloboss_integrations_active ON soloboss_integrations(user_id, is_active);