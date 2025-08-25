/**
 * TypeScript/JavaScript SDK Examples
 * 
 * Comprehensive examples showing how to use the Social Media Automation Platform SDK
 */

import { SocialMediaAutomationSDK, SMAError } from '../typescript/index';

// Initialize the SDK
const client = new SocialMediaAutomationSDK({
  baseURL: 'https://api.sma-platform.com/api',
  timeout: 30000,
  retryAttempts: 3,
  debug: process.env.NODE_ENV === 'development'
});

/**
 * Example 1: Basic Authentication
 */
async function basicAuthentication() {
  try {
    // Login with email and password
    const { user, tokens } = await client.login('user@example.com', 'password');
    console.log(`Welcome, ${user.name}!`);
    console.log(`User ID: ${user.id}`);
    
    // The SDK automatically stores and manages tokens
    // You can also set tokens manually if you have them
    // client.setTokens(tokens);
    
  } catch (error) {
    if (error instanceof SMAError) {
      console.error(`Authentication failed: ${error.message}`);
      if (error.code === 'INVALID_TOKEN') {
        console.log('Please check your credentials');
      }
    }
  }
}

/**
 * Example 2: Creating Posts
 */
async function createPosts() {
  try {
    // Simple post
    const simplePost = await client.createPost({
      content: 'Hello from the TypeScript SDK! 🚀',
      platforms: ['facebook', 'instagram'],
      hashtags: ['#typescript', '#sdk', '#automation']
    });
    
    console.log(`Created post: ${simplePost.id}`);
    
    // Scheduled post
    const scheduledPost = await client.createPost({
      content: 'This post will be published later',
      platforms: ['facebook'],
      scheduledTime: '2024-02-01T15:30:00Z',
      images: ['https://example.com/image.jpg']
    });
    
    console.log(`Scheduled post: ${scheduledPost.id} for ${scheduledPost.scheduledTime}`);
    
    // Platform-specific content
    const platformSpecificPost = await client.createPost({
      content: 'Default content for all platforms',
      platforms: ['facebook', 'instagram', 'x'],
      platformSpecificContent: {
        facebook: {
          content: 'Facebook-specific content with more details',
          hashtags: ['#facebook', '#detailed']
        },
        instagram: {
          content: 'Instagram content with visual focus 📸',
          hashtags: ['#instagram', '#visual', '#photo']
        },
        x: {
          content: 'Short and sweet for X! 🐦',
          hashtags: ['#x', '#twitter', '#short']
        }
      }
    });
    
    console.log(`Created platform-specific post: ${platformSpecificPost.id}`);
    
  } catch (error) {
    if (error instanceof SMAError) {
      console.error(`Post creation failed: ${error.message}`);
      
      if (error.retryable) {
        console.log(`This error is retryable. Retry after ${error.retryAfter} seconds`);
      }
      
      if (error.details) {
        console.log('Error details:', error.details);
      }
    }
  }
}

/**
 * Example 3: Managing Posts
 */
async function managePosts() {
  try {
    // Get all posts with pagination
    const postsResponse = await client.getPosts({
      page: 1,
      limit: 20,
      status: 'published',
      sort: 'createdAt',
      order: 'desc'
    });
    
    console.log(`Found ${postsResponse.pagination.totalCount} posts`);
    console.log(`Page ${postsResponse.pagination.page} of ${postsResponse.pagination.totalPages}`);
    
    if (postsResponse.data && postsResponse.data.length > 0) {
      const firstPost = postsResponse.data[0];
      console.log(`Latest post: "${firstPost.content}" (${firstPost.status})`);
      
      // Get specific post details
      const postDetails = await client.getPost(firstPost.id);
      console.log(`Post details:`, postDetails);
      
      // Update the post (only if it's draft or scheduled)
      if (postDetails.status === 'draft' || postDetails.status === 'scheduled') {
        const updatedPost = await client.updatePost(firstPost.id, {
          content: 'Updated content',
          hashtags: ['#updated', '#modified']
        });
        
        console.log(`Updated post: ${updatedPost.id}`);
      }
      
      // Publish immediately
      if (postDetails.status === 'draft' || postDetails.status === 'scheduled') {
        const publishResult = await client.publishPost(firstPost.id);
        console.log('Publish results:', publishResult.results);
      }
    }
    
  } catch (error) {
    if (error instanceof SMAError) {
      console.error(`Post management failed: ${error.message}`);
    }
  }
}

/**
 * Example 4: Bulk Operations
 */
async function bulkOperations() {
  try {
    const postsToCreate = [
      {
        content: 'Bulk post 1: Morning motivation! ☀️',
        platforms: ['facebook', 'instagram'],
        hashtags: ['#motivation', '#morning']
      },
      {
        content: 'Bulk post 2: Afternoon productivity tips 💪',
        platforms: ['facebook', 'x'],
        hashtags: ['#productivity', '#tips']
      },
      {
        content: 'Bulk post 3: Evening reflection 🌙',
        platforms: ['instagram'],
        hashtags: ['#reflection', '#evening']
      }
    ];
    
    const bulkResult = await client.createBulkPosts(postsToCreate);
    
    console.log(`Successfully created ${bulkResult.scheduledPosts.length} posts`);
    
    if (bulkResult.errors.length > 0) {
      console.log(`${bulkResult.errors.length} posts failed:`, bulkResult.errors);
    }
    
  } catch (error) {
    if (error instanceof SMAError) {
      console.error(`Bulk operation failed: ${error.message}`);
    }
  }
}

/**
 * Example 5: Analytics
 */
async function getAnalytics() {
  try {
    // Get overall analytics
    const analytics = await client.getAnalytics({
      startDate: '2024-01-01',
      endDate: '2024-01-31'
    });
    
    console.log('Analytics Summary:');
    console.log(`Total Posts: ${analytics.totalPosts}`);
    console.log(`Published: ${analytics.publishedPosts}`);
    console.log(`Failed: ${analytics.failedPosts}`);
    console.log(`Success Rate: ${analytics.successRate.toFixed(2)}%`);
    console.log(`Average Posts/Day: ${analytics.averagePostsPerDay}`);
    
    console.log('\nPlatform Breakdown:');
    Object.entries(analytics.platformBreakdown).forEach(([platform, count]) => {
      console.log(`  ${platform}: ${count} posts`);
    });
    
    // Get platform-specific analytics
    const facebookAnalytics = await client.getAnalytics({
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      platform: 'facebook'
    });
    
    console.log(`\nFacebook Analytics: ${facebookAnalytics.totalPosts} posts`);
    
  } catch (error) {
    if (error instanceof SMAError) {
      console.error(`Analytics failed: ${error.message}`);
    }
  }
}

/**
 * Example 6: Platform Connections
 */
async function managePlatformConnections() {
  try {
    // Connect to Facebook (you would get the auth code from OAuth flow)
    const facebookConnection = await client.connectPlatform(
      'facebook',
      'auth_code_from_facebook_oauth',
      'http://localhost:3000/oauth/callback'
    );
    
    console.log(`Connected to Facebook as ${facebookConnection.platformUsername}`);
    
    // Connect to Instagram
    const instagramConnection = await client.connectPlatform(
      'instagram',
      'auth_code_from_instagram_oauth',
      'http://localhost:3000/oauth/callback'
    );
    
    console.log(`Connected to Instagram as ${instagramConnection.platformUsername}`);
    
    // Later, if you need to disconnect
    // await client.disconnectPlatform('facebook');
    // console.log('Disconnected from Facebook');
    
  } catch (error) {
    if (error instanceof SMAError) {
      console.error(`Platform connection failed: ${error.message}`);
      
      if (error.code === 'OAUTH_ERROR') {
        console.log('Please check your OAuth configuration and try again');
      }
    }
  }
}

/**
 * Example 7: Error Handling Patterns
 */
async function errorHandlingPatterns() {
  try {
    // This will likely fail for demonstration
    await client.createPost({
      content: '', // Empty content should cause validation error
      platforms: [] // Empty platforms should cause validation error
    });
    
  } catch (error) {
    if (error instanceof SMAError) {
      console.log('Handling SMA API Error:');
      console.log(`Code: ${error.code}`);
      console.log(`Message: ${error.message}`);
      console.log(`Status: ${error.statusCode}`);
      console.log(`Retryable: ${error.retryable}`);
      
      if (error.retryAfter) {
        console.log(`Retry after: ${error.retryAfter} seconds`);
      }
      
      if (error.details) {
        console.log('Details:', error.details);
      }
      
      // Handle specific error types
      switch (error.code) {
        case 'VALIDATION_ERROR':
          console.log('Fix validation errors and try again');
          break;
        case 'RATE_LIMIT_EXCEEDED':
          console.log(`Rate limit exceeded. Wait ${error.retryAfter} seconds`);
          break;
        case 'PLATFORM_API_ERROR':
          console.log('Platform API issue. Check platform status');
          break;
        case 'NETWORK_ERROR':
          if (error.retryable) {
            console.log('Network error. Retrying automatically...');
          }
          break;
        default:
          console.log('Unexpected error occurred');
      }
    } else {
      console.error('Non-SMA error:', error);
    }
  }
}

/**
 * Example 8: Health Checks and Monitoring
 */
async function healthAndMonitoring() {
  try {
    // Check API health
    const health = await client.checkHealth();
    console.log(`API Status: ${health.status}`);
    console.log('Services:', health.services);
    
    // Get current user info
    const user = await client.getCurrentUser();
    console.log(`Current user: ${user.name} (${user.email})`);
    
  } catch (error) {
    if (error instanceof SMAError) {
      console.error(`Health check failed: ${error.message}`);
    }
  }
}

/**
 * Example 9: Advanced Configuration
 */
function advancedConfiguration() {
  // Custom configuration
  const customClient = new SocialMediaAutomationSDK({
    baseURL: 'https://api.sma-platform.com/api',
    timeout: 60000, // 60 seconds
    retryAttempts: 5,
    retryDelay: 2000, // 2 seconds base delay
    debug: true // Enable debug logging
  });
  
  // Using API key instead of JWT
  const apiKeyClient = new SocialMediaAutomationSDK({
    baseURL: 'https://api.sma-platform.com/api',
    apiKey: 'your-api-key-here'
  });
  
  // Sandbox environment
  const sandboxClient = new SocialMediaAutomationSDK({
    baseURL: 'https://api.sma-platform.com/sandbox',
    debug: true
  });
  
  console.log('Configured multiple SDK clients');
}

/**
 * Example 10: Complete Workflow
 */
async function completeWorkflow() {
  try {
    console.log('Starting complete workflow...');
    
    // 1. Authenticate
    const { user } = await client.login('user@example.com', 'password');
    console.log(`✓ Authenticated as ${user.name}`);
    
    // 2. Check health
    const health = await client.checkHealth();
    console.log(`✓ API is ${health.status}`);
    
    // 3. Create a post
    const post = await client.createPost({
      content: 'Complete workflow example post! 🎉',
      platforms: ['facebook', 'instagram'],
      hashtags: ['#workflow', '#example', '#sdk']
    });
    console.log(`✓ Created post: ${post.id}`);
    
    // 4. Get analytics
    const analytics = await client.getAnalytics();
    console.log(`✓ Analytics: ${analytics.totalPosts} total posts, ${analytics.successRate.toFixed(1)}% success rate`);
    
    // 5. Logout
    await client.logout();
    console.log('✓ Logged out successfully');
    
    console.log('Complete workflow finished!');
    
  } catch (error) {
    if (error instanceof SMAError) {
      console.error(`Workflow failed: ${error.message}`);
    }
  }
}

// Export examples for use in other files
export {
  basicAuthentication,
  createPosts,
  managePosts,
  bulkOperations,
  getAnalytics,
  managePlatformConnections,
  errorHandlingPatterns,
  healthAndMonitoring,
  advancedConfiguration,
  completeWorkflow
};

// Run examples if this file is executed directly
if (require.main === module) {
  (async () => {
    console.log('Running TypeScript SDK Examples...\n');
    
    await basicAuthentication();
    await createPosts();
    await managePosts();
    await bulkOperations();
    await getAnalytics();
    await managePlatformConnections();
    await errorHandlingPatterns();
    await healthAndMonitoring();
    advancedConfiguration();
    await completeWorkflow();
    
    console.log('\nAll examples completed!');
  })().catch(console.error);
}