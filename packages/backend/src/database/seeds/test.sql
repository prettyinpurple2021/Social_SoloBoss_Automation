-- Test seed data for Social Media Automation Platform
-- This file contains minimal test data for automated testing

-- Insert test users for testing
INSERT INTO users (id, email, name, password_hash, email_verified, timezone) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'testuser1@test.com',
    'Test User 1',
    '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQq', -- password: 'password123'
    true,
    'UTC'
),
(
    '22222222-2222-2222-2222-222222222222',
    'testuser2@test.com',
    'Test User 2',
    '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQq', -- password: 'password123'
    false,
    'UTC'
)
ON CONFLICT (email) DO NOTHING;

-- Insert test platform connections
INSERT INTO platform_connections (id, user_id, platform, platform_user_id, platform_username, access_token, is_active) VALUES
(
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'facebook',
    'test_fb_123',
    'testuser1_fb',
    'test_encrypted_token_fb',
    true
),
(
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'instagram',
    'test_ig_456',
    'testuser1_ig',
    'test_encrypted_token_ig',
    true
)
ON CONFLICT (user_id, platform) DO NOTHING;

-- Insert test posts
INSERT INTO posts (id, user_id, content, platforms, status, source) VALUES
(
    '55555555-5555-5555-5555-555555555555',
    '11111111-1111-1111-1111-111111111111',
    'Test post content',
    ARRAY['facebook'],
    'draft',
    'manual'
),
(
    '66666666-6666-6666-6666-666666666666',
    '11111111-1111-1111-1111-111111111111',
    'Test scheduled post',
    ARRAY['facebook', 'instagram'],
    'scheduled',
    'manual'
)
ON CONFLICT (id) DO NOTHING;

-- Insert test platform posts
INSERT INTO platform_posts (id, post_id, platform, content, status) VALUES
(
    '77777777-7777-7777-7777-777777777777',
    '55555555-5555-5555-5555-555555555555',
    'facebook',
    'Test post content',
    'draft'
),
(
    '88888888-8888-8888-8888-888888888888',
    '66666666-6666-6666-6666-666666666666',
    'facebook',
    'Test scheduled post',
    'scheduled'
)
ON CONFLICT (post_id, platform) DO NOTHING;

COMMIT;