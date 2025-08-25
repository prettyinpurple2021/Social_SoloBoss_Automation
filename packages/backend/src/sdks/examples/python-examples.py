"""
Python SDK Examples

Comprehensive examples showing how to use the Social Media Automation Platform Python SDK
"""

import asyncio
from datetime import datetime, timedelta
from sma_sdk import (
    SocialMediaAutomationSDK,
    SMAConfig,
    SMAError,
    Platform,
    PostStatus,
    create_sma_client
)


def basic_authentication():
    """Example 1: Basic Authentication"""
    print("=== Basic Authentication ===")
    
    # Initialize the SDK
    config = SMAConfig(
        base_url="https://api.sma-platform.com/api",
        timeout=30,
        retry_attempts=3,
        debug=True
    )
    client = SocialMediaAutomationSDK(config)
    
    try:
        # Login with email and password
        result = client.login("user@example.com", "password")
        user = result["user"]
        tokens = result["tokens"]
        
        print(f"Welcome, {user.name}!")
        print(f"User ID: {user.id}")
        
        # The SDK automatically stores and manages tokens
        # You can also set tokens manually if you have them
        # client.set_tokens(tokens)
        
        return client
        
    except SMAError as error:
        print(f"Authentication failed: {error.message}")
        if error.code == "INVALID_TOKEN":
            print("Please check your credentials")
        return None


def create_posts(client):
    """Example 2: Creating Posts"""
    print("\n=== Creating Posts ===")
    
    if not client:
        print("No authenticated client available")
        return
    
    try:
        # Simple post
        simple_post = client.create_post({
            "content": "Hello from the Python SDK! 🐍",
            "platforms": ["facebook", "instagram"],
            "hashtags": ["#python", "#sdk", "#automation"]
        })
        
        print(f"Created post: {simple_post.id}")
        
        # Scheduled post
        scheduled_time = (datetime.now() + timedelta(hours=2)).isoformat() + "Z"
        scheduled_post = client.create_post({
            "content": "This post will be published later",
            "platforms": ["facebook"],
            "scheduled_time": scheduled_time,
            "images": ["https://example.com/image.jpg"]
        })
        
        print(f"Scheduled post: {scheduled_post.id} for {scheduled_post.scheduled_time}")
        
        # Platform-specific content
        platform_specific_post = client.create_post({
            "content": "Default content for all platforms",
            "platforms": ["facebook", "instagram", "x"],
            "platform_specific_content": {
                "facebook": {
                    "content": "Facebook-specific content with more details",
                    "hashtags": ["#facebook", "#detailed"]
                },
                "instagram": {
                    "content": "Instagram content with visual focus 📸",
                    "hashtags": ["#instagram", "#visual", "#photo"]
                },
                "x": {
                    "content": "Short and sweet for X! 🐦",
                    "hashtags": ["#x", "#twitter", "#short"]
                }
            }
        })
        
        print(f"Created platform-specific post: {platform_specific_post.id}")
        
    except SMAError as error:
        print(f"Post creation failed: {error.message}")
        
        if error.retryable:
            print(f"This error is retryable. Retry after {error.retry_after} seconds")
        
        if error.details:
            print(f"Error details: {error.details}")


def manage_posts(client):
    """Example 3: Managing Posts"""
    print("\n=== Managing Posts ===")
    
    if not client:
        print("No authenticated client available")
        return
    
    try:
        # Get all posts with pagination
        posts_response = client.get_posts(
            page=1,
            limit=20,
            status="published",
            sort="createdAt",
            order="desc"
        )
        
        total_count = posts_response["pagination"]["totalCount"]
        page = posts_response["pagination"]["page"]
        total_pages = posts_response["pagination"]["totalPages"]
        
        print(f"Found {total_count} posts")
        print(f"Page {page} of {total_pages}")
        
        posts = posts_response["data"]
        if posts:
            first_post = posts[0]
            print(f"Latest post: \"{first_post['content']}\" ({first_post['status']})")
            
            # Get specific post details
            post_details = client.get_post(first_post["id"])
            print(f"Post details: {post_details.content}")
            
            # Update the post (only if it's draft or scheduled)
            if post_details.status in ["draft", "scheduled"]:
                updated_post = client.update_post(first_post["id"], {
                    "content": "Updated content",
                    "hashtags": ["#updated", "#modified"]
                })
                
                print(f"Updated post: {updated_post.id}")
            
            # Publish immediately
            if post_details.status in ["draft", "scheduled"]:
                publish_result = client.publish_post(first_post["id"])
                print(f"Publish results: {publish_result['results']}")
        
    except SMAError as error:
        print(f"Post management failed: {error.message}")


def bulk_operations(client):
    """Example 4: Bulk Operations"""
    print("\n=== Bulk Operations ===")
    
    if not client:
        print("No authenticated client available")
        return
    
    try:
        posts_to_create = [
            {
                "content": "Bulk post 1: Morning motivation! ☀️",
                "platforms": ["facebook", "instagram"],
                "hashtags": ["#motivation", "#morning"]
            },
            {
                "content": "Bulk post 2: Afternoon productivity tips 💪",
                "platforms": ["facebook", "x"],
                "hashtags": ["#productivity", "#tips"]
            },
            {
                "content": "Bulk post 3: Evening reflection 🌙",
                "platforms": ["instagram"],
                "hashtags": ["#reflection", "#evening"]
            }
        ]
        
        bulk_result = client.create_bulk_posts(posts_to_create)
        
        scheduled_posts = bulk_result["scheduledPosts"]
        errors = bulk_result["errors"]
        
        print(f"Successfully created {len(scheduled_posts)} posts")
        
        if errors:
            print(f"{len(errors)} posts failed: {errors}")
        
    except SMAError as error:
        print(f"Bulk operation failed: {error.message}")


def get_analytics(client):
    """Example 5: Analytics"""
    print("\n=== Analytics ===")
    
    if not client:
        print("No authenticated client available")
        return
    
    try:
        # Get overall analytics
        analytics = client.get_analytics(
            start_date="2024-01-01",
            end_date="2024-01-31"
        )
        
        print("Analytics Summary:")
        print(f"Total Posts: {analytics.total_posts}")
        print(f"Published: {analytics.published_posts}")
        print(f"Failed: {analytics.failed_posts}")
        print(f"Success Rate: {analytics.success_rate:.2f}%")
        print(f"Average Posts/Day: {analytics.average_posts_per_day}")
        
        print("\nPlatform Breakdown:")
        for platform, count in analytics.platform_breakdown.items():
            print(f"  {platform}: {count} posts")
        
        # Get platform-specific analytics
        facebook_analytics = client.get_analytics(
            start_date="2024-01-01",
            end_date="2024-01-31",
            platform="facebook"
        )
        
        print(f"\nFacebook Analytics: {facebook_analytics.total_posts} posts")
        
    except SMAError as error:
        print(f"Analytics failed: {error.message}")


def manage_platform_connections(client):
    """Example 6: Platform Connections"""
    print("\n=== Platform Connections ===")
    
    if not client:
        print("No authenticated client available")
        return
    
    try:
        # Connect to Facebook (you would get the auth code from OAuth flow)
        facebook_connection = client.connect_platform(
            "facebook",
            "auth_code_from_facebook_oauth",
            "http://localhost:3000/oauth/callback"
        )
        
        print(f"Connected to Facebook as {facebook_connection.platform_username}")
        
        # Connect to Instagram
        instagram_connection = client.connect_platform(
            "instagram",
            "auth_code_from_instagram_oauth",
            "http://localhost:3000/oauth/callback"
        )
        
        print(f"Connected to Instagram as {instagram_connection.platform_username}")
        
        # Later, if you need to disconnect
        # client.disconnect_platform("facebook")
        # print("Disconnected from Facebook")
        
    except SMAError as error:
        print(f"Platform connection failed: {error.message}")
        
        if error.code == "OAUTH_ERROR":
            print("Please check your OAuth configuration and try again")


def error_handling_patterns():
    """Example 7: Error Handling Patterns"""
    print("\n=== Error Handling Patterns ===")
    
    client = create_sma_client(SMAConfig(debug=True))
    
    try:
        # This will likely fail for demonstration
        client.create_post({
            "content": "",  # Empty content should cause validation error
            "platforms": []  # Empty platforms should cause validation error
        })
        
    except SMAError as error:
        print("Handling SMA API Error:")
        print(f"Code: {error.code}")
        print(f"Message: {error.message}")
        print(f"Status: {error.status_code}")
        print(f"Retryable: {error.retryable}")
        
        if error.retry_after:
            print(f"Retry after: {error.retry_after} seconds")
        
        if error.details:
            print(f"Details: {error.details}")
        
        # Handle specific error types
        if error.code == "VALIDATION_ERROR":
            print("Fix validation errors and try again")
        elif error.code == "RATE_LIMIT_EXCEEDED":
            print(f"Rate limit exceeded. Wait {error.retry_after} seconds")
        elif error.code == "PLATFORM_API_ERROR":
            print("Platform API issue. Check platform status")
        elif error.code == "NETWORK_ERROR":
            if error.retryable:
                print("Network error. Retrying automatically...")
        else:
            print("Unexpected error occurred")
    
    except Exception as error:
        print(f"Non-SMA error: {error}")


def health_and_monitoring(client):
    """Example 8: Health Checks and Monitoring"""
    print("\n=== Health and Monitoring ===")
    
    if not client:
        print("No authenticated client available")
        return
    
    try:
        # Check API health
        health = client.check_health()
        print(f"API Status: {health['status']}")
        print(f"Services: {health['services']}")
        
        # Get current user info
        user = client.get_current_user()
        print(f"Current user: {user.name} ({user.email})")
        
    except SMAError as error:
        print(f"Health check failed: {error.message}")


def advanced_configuration():
    """Example 9: Advanced Configuration"""
    print("\n=== Advanced Configuration ===")
    
    # Custom configuration
    custom_config = SMAConfig(
        base_url="https://api.sma-platform.com/api",
        timeout=60,  # 60 seconds
        retry_attempts=5,
        retry_delay=2.0,  # 2 seconds base delay
        debug=True  # Enable debug logging
    )
    custom_client = SocialMediaAutomationSDK(custom_config)
    
    # Using API key instead of JWT
    api_key_config = SMAConfig(
        base_url="https://api.sma-platform.com/api",
        api_key="your-api-key-here"
    )
    api_key_client = SocialMediaAutomationSDK(api_key_config)
    
    # Sandbox environment
    sandbox_config = SMAConfig(
        base_url="https://api.sma-platform.com/sandbox",
        debug=True
    )
    sandbox_client = SocialMediaAutomationSDK(sandbox_config)
    
    print("Configured multiple SDK clients")
    
    return custom_client, api_key_client, sandbox_client


def complete_workflow():
    """Example 10: Complete Workflow"""
    print("\n=== Complete Workflow ===")
    
    config = SMAConfig(
        base_url="https://api.sma-platform.com/api",
        debug=True
    )
    client = SocialMediaAutomationSDK(config)
    
    try:
        print("Starting complete workflow...")
        
        # 1. Authenticate
        result = client.login("user@example.com", "password")
        user = result["user"]
        print(f"✓ Authenticated as {user.name}")
        
        # 2. Check health
        health = client.check_health()
        print(f"✓ API is {health['status']}")
        
        # 3. Create a post
        post = client.create_post({
            "content": "Complete workflow example post! 🎉",
            "platforms": ["facebook", "instagram"],
            "hashtags": ["#workflow", "#example", "#sdk"]
        })
        print(f"✓ Created post: {post.id}")
        
        # 4. Get analytics
        analytics = client.get_analytics()
        success_rate = analytics.success_rate
        total_posts = analytics.total_posts
        print(f"✓ Analytics: {total_posts} total posts, {success_rate:.1f}% success rate")
        
        # 5. Logout
        client.logout()
        print("✓ Logged out successfully")
        
        print("Complete workflow finished!")
        
    except SMAError as error:
        print(f"Workflow failed: {error.message}")


def sandbox_examples():
    """Example 11: Sandbox Environment"""
    print("\n=== Sandbox Environment ===")
    
    # Connect to sandbox
    sandbox_config = SMAConfig(
        base_url="https://api.sma-platform.com/sandbox",
        debug=True
    )
    sandbox_client = SocialMediaAutomationSDK(sandbox_config)
    
    try:
        # Login with test credentials
        result = sandbox_client.login("developer@example.com", "sandbox123")
        user = result["user"]
        print(f"✓ Logged into sandbox as {user.name}")
        
        # Create test post
        test_post = sandbox_client.create_post({
            "content": "Testing in sandbox environment! 🧪",
            "platforms": ["facebook", "instagram"],
            "hashtags": ["#sandbox", "#testing"]
        })
        print(f"✓ Created test post: {test_post.id}")
        
        # Test publishing (will be simulated)
        publish_result = sandbox_client.publish_post(test_post.id)
        print(f"✓ Simulated publishing: {len(publish_result['results'])} platforms")
        
        # Get sandbox analytics
        analytics = sandbox_client.get_analytics()
        print(f"✓ Sandbox analytics: {analytics.total_posts} posts")
        
        print("Sandbox testing completed!")
        
    except SMAError as error:
        print(f"Sandbox error: {error.message}")


def main():
    """Run all examples"""
    print("Running Python SDK Examples...\n")
    
    # Run basic examples
    client = basic_authentication()
    
    if client:
        create_posts(client)
        manage_posts(client)
        bulk_operations(client)
        get_analytics(client)
        manage_platform_connections(client)
        health_and_monitoring(client)
    
    # Run examples that don't need authentication
    error_handling_patterns()
    advanced_configuration()
    complete_workflow()
    sandbox_examples()
    
    print("\nAll examples completed!")


if __name__ == "__main__":
    main()