-- Development seed data for Social Media Automation Platform
-- This file contains test data for development and testing environments

-- Insert test users
INSERT INTO users (id, email, name, password_hash, email_verified, timezone, settings) VALUES
(
    '550e8400-e29b-41d4-a716-446655440001',
    'test@example.com',
    'Test User',
    '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQq', -- password: 'password123'
    true,
    'America/New_York',
    '{"theme": "light", "notifications": true}'
),
(
    '550e8400-e29b-41d4-a716-446655440002',
    'blogger@example.com',
    'Blogger User',
    '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQq', -- password: 'password123'
    true,
    'Europe/London',
    '{"theme": "dark", "notifications": false}'
),
(
    '550e8400-e29b-41d4-a716-446655440003',
    'soloboss@example.com',
    'SoloBoss User',
    '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQq', -- password: 'password123'
    true,
    'Asia/Tokyo',
    '{"theme": "light", "notifications": true, "auto_schedule": true}'
)
ON CONFLICT (email) DO NOTHING;

-- Insert test platform connections
INSERT INTO platform_connections (id, user_id, platform, platform_user_id, platform_username, access_token, refresh_token, token_expires_at, scopes, is_active, metadata) VALUES
(
    '660e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    'facebook',
    'fb_123456789',
    'testuser_fb',
    'encrypted_access_token_fb',
    'encrypted_refresh_token_fb',
    NOW() + INTERVAL '60 days',
    ARRAY['pages_manage_posts', 'pages_read_engagement'],
    true,
    '{"page_id": "123456789", "page_name": "Test Page"}'
),
(
    '660e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001',
    'instagram',
    'ig_987654321',
    'testuser_ig',
    'encrypted_access_token_ig',
    'encrypted_refresh_token_ig',
    NOW() + INTERVAL '60 days',
    ARRAY['instagram_basic', 'instagram_content_publish'],
    true,
    '{"account_type": "business", "followers_count": 1500}'
),
(
    '660e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440002',
    'pinterest',
    'pin_456789123',
    'blogger_pinterest',
    'encrypted_access_token_pin',
    NULL,
    NOW() + INTERVAL '30 days',
    ARRAY['boards:read', 'pins:write'],
    true,
    '{"board_count": 25, "monthly_views": 50000}'
)
ON CONFLICT (user_id, platform) DO NOTHING;

-- Insert test posts
INSERT INTO posts (id, user_id, content, images, hashtags, platforms, platform_specific_content, scheduled_time, status, source, metadata) VALUES
(
    '770e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    'This is a test post for multiple platforms! 🚀',
    ARRAY['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    ARRAY['#test', '#socialmedia', '#automation'],
    ARRAY['facebook', 'instagram'],
    '{"facebook": {"content": "This is a test post for Facebook! 🚀"}, "instagram": {"content": "Test post for IG! 🚀 #insta"}}',
    NOW() + INTERVAL '2 hours',
    'scheduled',
    'manual',
    '{"campaign": "test_campaign", "priority": "normal"}'
),
(
    '770e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440002',
    'New blog post is live! Check out my latest thoughts on social media automation.',
    ARRAY['https://example.com/blog-image.jpg'],
    ARRAY['#blog', '#automation', '#productivity'],
    ARRAY['facebook', 'pinterest'],
    '{"facebook": {"content": "New blog post is live! Check it out: https://blog.example.com/post1"}, "pinterest": {"content": "Social Media Automation Tips", "board_id": "123456"}}',
    NOW() - INTERVAL '1 hour',
    'published',
    'blogger',
    '{"blog_url": "https://blog.example.com/post1", "auto_generated": true}'
),
(
    '770e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440003',
    'AI-generated content from SoloBoss: The future of content creation is here!',
    ARRAY[],
    ARRAY['#ai', '#content', '#soloboss', '#future'],
    ARRAY['facebook', 'instagram'],
    '{}',
    NOW() + INTERVAL '6 hours',
    'scheduled',
    'soloboss',
    '{"soloboss_id": "sb_12345", "ai_confidence": 0.95, "optimization_score": 8.7}'
)
ON CONFLICT (id) DO NOTHING;

-- Insert test platform posts
INSERT INTO platform_posts (id, post_id, platform, platform_post_id, content, status, published_at, error_message, retry_count, metadata) VALUES
(
    '880e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440002',
    'facebook',
    'fb_post_123456',
    'New blog post is live! Check it out: https://blog.example.com/post1',
    'published',
    NOW() - INTERVAL '1 hour',
    NULL,
    0,
    '{"fb_post_id": "123456789_987654321", "reach": 1250, "engagement": 85}'
),
(
    '880e8400-e29b-41d4-a716-446655440002',
    '770e8400-e29b-41d4-a716-446655440002',
    'pinterest',
    'pin_789123456',
    'Social Media Automation Tips',
    'published',
    NOW() - INTERVAL '1 hour',
    NULL,
    0,
    '{"pin_id": "789123456", "board_id": "123456", "impressions": 2500, "saves": 45}'
),
(
    '880e8400-e29b-41d4-a716-446655440003',
    '770e8400-e29b-41d4-a716-446655440001',
    'facebook',
    NULL,
    'This is a test post for Facebook! 🚀',
    'scheduled',
    NULL,
    NULL,
    0,
    '{"scheduled_for": "2024-01-15T14:00:00Z"}'
)
ON CONFLICT (post_id, platform) DO NOTHING;

-- Insert test analytics data
INSERT INTO post_analytics (platform_post_id, metric_type, metric_value, recorded_at, metadata) VALUES
('880e8400-e29b-41d4-a716-446655440001', 'likes', 45, NOW() - INTERVAL '30 minutes', '{}'),
('880e8400-e29b-41d4-a716-446655440001', 'shares', 12, NOW() - INTERVAL '30 minutes', '{}'),
('880e8400-e29b-41d4-a716-446655440001', 'comments', 8, NOW() - INTERVAL '30 minutes', '{}'),
('880e8400-e29b-41d4-a716-446655440001', 'reach', 1250, NOW() - INTERVAL '30 minutes', '{}'),
('880e8400-e29b-41d4-a716-446655440002', 'saves', 45, NOW() - INTERVAL '30 minutes', '{}'),
('880e8400-e29b-41d4-a716-446655440002', 'impressions', 2500, NOW() - INTERVAL '30 minutes', '{}'),
('880e8400-e29b-41d4-a716-446655440002', 'clicks', 125, NOW() - INTERVAL '30 minutes', '{}');

-- Insert test integrations
INSERT INTO integrations (user_id, integration_type, configuration, is_active) VALUES
(
    '550e8400-e29b-41d4-a716-446655440002',
    'blogger',
    '{"blog_url": "https://blog.example.com", "rss_feed": "https://blog.example.com/feeds/posts/default", "auto_approve": false, "default_platforms": ["facebook", "pinterest"], "custom_hashtags": ["#blog", "#automation"]}',
    true
),
(
    '550e8400-e29b-41d4-a716-446655440003',
    'soloboss',
    '{"api_key": "encrypted_soloboss_api_key", "webhook_secret": "encrypted_webhook_secret", "auto_schedule": true, "optimization_level": "high"}',
    true
)
ON CONFLICT (user_id, integration_type) DO NOTHING;

-- Insert test content templates
INSERT INTO content_templates (user_id, name, description, template_content, platforms, hashtags, variables, usage_count) VALUES
(
    '550e8400-e29b-41d4-a716-446655440001',
    'Blog Post Promotion',
    'Template for promoting new blog posts',
    'New blog post is live! {{title}} - Check it out: {{url}} {{custom_message}}',
    ARRAY['facebook', 'pinterest'],
    ARRAY['#blog', '#newpost'],
    '{"title": "", "url": "", "custom_message": ""}',
    5
),
(
    '550e8400-e29b-41d4-a716-446655440001',
    'Product Launch',
    'Template for product launch announcements',
    '🚀 Exciting news! We''re launching {{product_name}}! {{description}} Get it now: {{link}} #launch #{{product_name}}',
    ARRAY['facebook', 'instagram'],
    ARRAY['#launch', '#product', '#exciting'],
    '{"product_name": "", "description": "", "link": ""}',
    2
)
ON CONFLICT (user_id, name) DO NOTHING;

-- Insert test audit logs
INSERT INTO audit_logs (user_id, action, resource, resource_id, details, ip_address, user_agent, success) VALUES
(
    '550e8400-e29b-41d4-a716-446655440001',
    'login',
    'user',
    '550e8400-e29b-41d4-a716-446655440001',
    '{"method": "email_password", "remember_me": true}',
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    true
),
(
    '550e8400-e29b-41d4-a716-446655440001',
    'post_created',
    'post',
    '770e8400-e29b-41d4-a716-446655440001',
    '{"platforms": ["facebook", "instagram"], "scheduled": true}',
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    true
),
(
    '550e8400-e29b-41d4-a716-446655440002',
    'platform_connected',
    'platform_connection',
    '660e8400-e29b-41d4-a716-446655440003',
    '{"platform": "pinterest", "scopes": ["boards:read", "pins:write"]}',
    '192.168.1.101',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    true
);

-- Insert test security events
INSERT INTO security_events (type, severity, user_id, action, details, ip_address, user_agent) VALUES
(
    'authentication',
    'low',
    '550e8400-e29b-41d4-a716-446655440001',
    'successful_login',
    '{"method": "email_password", "session_duration": "24h"}',
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
),
(
    'token_management',
    'medium',
    '550e8400-e29b-41d4-a716-446655440001',
    'token_refresh',
    '{"token_type": "access_token", "expires_in": 900}',
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
);

COMMIT;