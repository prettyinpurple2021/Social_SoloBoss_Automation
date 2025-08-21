# Social Media Automation Platform - User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Platform Setup](#platform-setup)
3. [Creating and Scheduling Posts](#creating-and-scheduling-posts)
4. [Blogger Integration](#blogger-integration)
5. [SoloBoss AI Content Planner Integration](#soloboss-ai-content-planner-integration)
6. [Dashboard and Analytics](#dashboard-and-analytics)
7. [Settings and Preferences](#settings-and-preferences)
8. [Troubleshooting](#troubleshooting)

## Getting Started

### Account Registration

1. **Visit the Platform**: Navigate to the Social Media Automation Platform website
2. **Create Account**: Click "Sign Up" and provide:
   - Full name
   - Email address
   - Secure password (minimum 8 characters with uppercase, lowercase, numbers, and symbols)
3. **Email Verification**: Check your email and click the verification link
4. **Login**: Use your credentials to access the dashboard

### First Login

After logging in for the first time, you'll see the main dashboard with:
- Welcome message
- Quick setup guide
- Platform connection options
- Recent activity (empty initially)

## Platform Setup

### Connecting Social Media Accounts

The platform supports four major social media platforms. Each requires OAuth authentication for secure access.

#### Facebook Business Page

1. **Navigate to Settings** → **Platform Connections**
2. **Click "Connect Facebook"**
3. **OAuth Flow**:
   - You'll be redirected to Facebook
   - Login to your Facebook account
   - Select the Business Page you want to manage
   - Grant necessary permissions:
     - Manage and publish content
     - Read page insights
     - Manage page settings
4. **Confirmation**: You'll be redirected back with a success message

**Required Permissions:**
- `pages_manage_posts` - To publish posts
- `pages_read_engagement` - To read post metrics
- `pages_show_list` - To list available pages

#### Instagram Business Account

1. **Prerequisites**: 
   - Instagram Business or Creator account
   - Connected to a Facebook Business Page
2. **Connect via Facebook**: Instagram connections are managed through Facebook
3. **Select Instagram Account**: Choose which Instagram account to connect
4. **Grant Permissions**:
   - Publish photos and videos
   - Read account information
   - Access insights

**Note**: Personal Instagram accounts are not supported. You must have a Business or Creator account.

#### Pinterest Business Account

1. **Navigate to Platform Connections**
2. **Click "Connect Pinterest"**
3. **OAuth Authentication**:
   - Login to Pinterest
   - Select your business account
   - Grant permissions for:
     - Creating pins
     - Managing boards
     - Reading account information
4. **Board Selection**: Choose default boards for posting

#### X (formerly Twitter)

1. **Prerequisites**: X Premium account (required for API access)
2. **Connect Account**:
   - Click "Connect X"
   - Authenticate with X
   - Grant permissions for:
     - Reading and writing tweets
     - Accessing account information
3. **API Limits**: Be aware of X's posting limits and rate restrictions

### Platform-Specific Settings

#### Content Optimization Settings

Each platform has specific content requirements and best practices:

**Facebook:**
- Character limit: 63,206 characters
- Image formats: JPG, PNG, GIF
- Video formats: MP4, MOV, AVI
- Optimal image size: 1200x630 pixels

**Instagram:**
- Character limit: 2,200 characters
- Image formats: JPG, PNG
- Video formats: MP4, MOV
- Optimal image size: 1080x1080 pixels (square) or 1080x1350 pixels (portrait)
- Hashtag limit: 30 per post

**Pinterest:**
- Character limit: 500 characters
- Image formats: JPG, PNG
- Optimal image size: 1000x1500 pixels (2:3 aspect ratio)
- Board organization required

**X:**
- Character limit: 280 characters
- Image formats: JPG, PNG, GIF, WebP
- Video formats: MP4, MOV
- Optimal image size: 1200x675 pixels

## Creating and Scheduling Posts

### Basic Post Creation

1. **Access Post Creator**: Click "Create Post" from the dashboard
2. **Content Input**:
   - **Text Content**: Enter your post text (platform limits will be shown)
   - **Images**: Upload up to 10 images (platform-specific limits apply)
   - **Hashtags**: Add relevant hashtags (# symbol will be added automatically)
3. **Platform Selection**: Choose which platforms to post to
4. **Scheduling Options**:
   - **Post Now**: Immediate publishing
   - **Schedule**: Select date and time for future posting
5. **Preview**: Review how your post will appear on each platform
6. **Publish/Schedule**: Confirm your post

### Advanced Post Features

#### Platform-Specific Content

Create different content for each platform:

1. **Enable Platform-Specific Content** in the post creator
2. **Customize for Each Platform**:
   - Different text content
   - Platform-optimized hashtags
   - Different images or cropping
3. **Preview Each Version** before publishing

#### Bulk Post Scheduling

For scheduling multiple posts at once:

1. **Navigate to Bulk Scheduler**
2. **Upload CSV** with post data or use the form interface
3. **Map Fields**: Content, platforms, schedule times, hashtags
4. **Review and Confirm**: Check all posts before scheduling
5. **Schedule All**: Posts will be queued for publishing

**CSV Format Example:**
```csv
content,platforms,scheduledTime,hashtags,imageUrl
"Check out our new product!","facebook,instagram","2024-01-20 15:30:00","#product #launch #new","https://example.com/image1.jpg"
"Behind the scenes content","instagram,pinterest","2024-01-21 10:00:00","#bts #process #work","https://example.com/image2.jpg"
```

### Post Management

#### Editing Scheduled Posts

1. **Dashboard View**: See all scheduled posts
2. **Edit Options**: Click on any scheduled post
3. **Modify Content**: Change text, images, hashtags, or schedule time
4. **Platform Changes**: Add or remove platforms
5. **Save Changes**: Updates will be applied to the scheduled post

**Note**: Only posts with "Draft" or "Scheduled" status can be edited.

#### Post Status Tracking

Posts have several status states:
- **Draft**: Saved but not scheduled
- **Scheduled**: Queued for future publishing
- **Publishing**: Currently being posted to platforms
- **Published**: Successfully posted to all platforms
- **Failed**: Encountered errors during publishing

## Blogger Integration

### Setting Up Blogger Integration

1. **Navigate to Settings** → **Integrations** → **Blogger**
2. **Enter Blog Information**:
   - Blog URL (e.g., `https://yourblog.blogspot.com`)
   - RSS feed URL (usually `https://yourblog.blogspot.com/feeds/posts/default`)
3. **Authentication**: 
   - Login to your Google account
   - Grant permissions to access your Blogger account
4. **Configuration Options**:
   - **Auto-approval**: Automatically schedule generated posts
   - **Review required**: Manual approval for each generated post
   - **Posting delay**: Time delay between blog post and social media sharing

### How Blogger Integration Works

1. **Monitoring**: The system checks your blog every 5 minutes for new posts
2. **Content Analysis**: When a new post is detected:
   - Extracts title and content
   - Generates social media-friendly summary
   - Creates platform-specific content
   - Suggests relevant hashtags
3. **Post Generation**: Creates social media posts with:
   - Engaging summary of blog content
   - Link back to full blog post
   - Relevant hashtags
   - Featured image (if available)

### Managing Auto-Generated Posts

#### Review Process

If auto-approval is disabled:

1. **Notification**: You'll receive a notification about new generated posts
2. **Review Interface**: Access pending posts from the dashboard
3. **Edit Options**: Modify content, hashtags, or scheduling
4. **Approval**: Approve or reject each generated post
5. **Scheduling**: Approved posts are automatically scheduled

#### Customization Options

- **Content Templates**: Customize how blog content is transformed
- **Hashtag Rules**: Set default hashtags for blog-generated posts
- **Platform Selection**: Choose which platforms receive blog posts
- **Timing**: Set preferred posting times for blog content

## SoloBoss AI Content Planner Integration

### Setting Up SoloBoss Integration

1. **Prerequisites**: Active SoloBoss AI Content Planner account
2. **API Key Setup**:
   - Login to your SoloBoss account
   - Navigate to API settings
   - Generate a new API key
   - Copy the API key
3. **Platform Configuration**:
   - Go to Settings → Integrations → SoloBoss
   - Enter your API key
   - Test the connection
   - Configure webhook URL (provided by the platform)

### SoloBoss Workflow

1. **Content Creation in SoloBoss**: Create and finalize blog posts in SoloBoss
2. **Automatic Transfer**: When you mark content as "final" in SoloBoss:
   - Content is automatically sent to the social media platform
   - SEO suggestions are included
   - Social media text is pre-generated
   - Images are transferred
3. **Review and Customize**: 
   - Review the imported content
   - Make any necessary adjustments
   - Customize for different platforms
4. **Schedule and Publish**: Schedule the posts across your connected platforms

### SoloBoss Content Features

#### AI-Generated Social Content

SoloBoss provides:
- **Optimized Social Text**: AI-generated social media captions
- **SEO Keywords**: Relevant keywords for hashtag generation
- **Content Variations**: Different versions for different platforms
- **Image Suggestions**: AI-recommended images and graphics

#### Content Customization

After receiving SoloBoss content:
- **Edit AI Text**: Modify the generated social media text
- **Add Personal Touch**: Include your brand voice and style
- **Platform Optimization**: Adjust content for each platform's best practices
- **Hashtag Enhancement**: Add or modify hashtags based on your strategy

## Dashboard and Analytics

### Dashboard Overview

The main dashboard provides:

#### Recent Activity
- Latest published posts
- Upcoming scheduled posts
- Recent platform connections
- Integration notifications

#### Quick Stats
- Total posts this month
- Success rate
- Platform breakdown
- Engagement overview

#### Calendar View
- Visual representation of scheduled posts
- Monthly, weekly, and daily views
- Drag-and-drop rescheduling
- Color-coded by platform

### Analytics and Reporting

#### Post Performance Metrics

**Individual Post Analytics:**
- Reach and impressions
- Engagement rates (likes, comments, shares)
- Click-through rates (for posts with links)
- Platform-specific metrics

**Aggregate Analytics:**
- Monthly posting frequency
- Success rates by platform
- Best performing content types
- Optimal posting times

#### Export Options

- **CSV Export**: Download analytics data
- **PDF Reports**: Generate monthly reports
- **API Access**: Programmatic access to analytics data

### Calendar Management

#### Calendar Views

1. **Month View**: Overview of all scheduled posts
2. **Week View**: Detailed weekly schedule
3. **Day View**: Hourly breakdown of posting schedule

#### Calendar Features

- **Drag-and-Drop**: Reschedule posts by dragging
- **Color Coding**: Different colors for each platform
- **Quick Edit**: Click posts to edit directly from calendar
- **Bulk Operations**: Select multiple posts for bulk actions

## Settings and Preferences

### User Profile Settings

#### Basic Information
- **Name**: Display name for the account
- **Email**: Contact email (used for notifications)
- **Password**: Change account password
- **Timezone**: Set your local timezone for scheduling

#### Notification Preferences

**Email Notifications:**
- Post publishing confirmations
- Failed post alerts
- Weekly performance reports
- Integration notifications

**In-App Notifications:**
- Real-time posting status
- Platform connection issues
- System maintenance alerts

### Platform Preferences

#### Default Settings
- **Default Platforms**: Automatically select preferred platforms for new posts
- **Default Hashtags**: Add these hashtags to all posts
- **Default Posting Times**: Preferred times for scheduling
- **Content Templates**: Save frequently used post templates

#### Content Optimization
- **Auto-Hashtag Generation**: Automatically suggest hashtags based on content
- **Content Warnings**: Alert for platform-specific content issues
- **Image Optimization**: Automatically resize images for each platform
- **Link Shortening**: Automatically shorten URLs in posts

### Integration Settings

#### Blogger Configuration
- **Blog Monitoring**: Enable/disable blog monitoring
- **Auto-Approval**: Automatically approve generated posts
- **Content Filtering**: Keywords to include/exclude from blog posts
- **Posting Delay**: Time between blog publication and social sharing

#### SoloBoss Configuration
- **API Settings**: Manage API key and connection
- **Content Processing**: How to handle incoming SoloBoss content
- **Auto-Scheduling**: Automatically schedule SoloBoss content
- **Content Review**: Require manual review before posting

### Security Settings

#### Account Security
- **Two-Factor Authentication**: Enable 2FA for additional security
- **Login History**: View recent login attempts
- **Active Sessions**: Manage active login sessions
- **API Access**: Manage API keys and access tokens

#### Platform Security
- **Token Management**: View and refresh platform access tokens
- **Permission Review**: Review granted permissions for each platform
- **Connection Audit**: Log of platform connection activities

## Troubleshooting

### Common Issues

#### Authentication Problems

**Issue**: "Invalid token" or "Authentication failed" errors

**Solutions:**
1. **Refresh Platform Connections**: Go to Settings → Platform Connections → Refresh
2. **Re-authenticate**: Disconnect and reconnect the problematic platform
3. **Check Permissions**: Ensure all required permissions are granted
4. **Clear Browser Cache**: Clear cookies and cache, then login again

**Issue**: Posts failing to publish

**Solutions:**
1. **Check Platform Status**: Verify the social media platform is operational
2. **Review Content**: Ensure content meets platform guidelines
3. **Token Refresh**: Platform tokens may have expired
4. **Retry Failed Posts**: Use the retry queue to republish failed posts

#### Content Issues

**Issue**: Images not uploading or displaying incorrectly

**Solutions:**
1. **File Format**: Ensure images are in supported formats (JPG, PNG)
2. **File Size**: Check file size limits (usually 10MB max)
3. **Image Dimensions**: Verify images meet platform requirements
4. **Network Connection**: Ensure stable internet connection during upload

**Issue**: Hashtags not working properly

**Solutions:**
1. **Format Check**: Ensure hashtags start with # and contain no spaces
2. **Platform Limits**: Check hashtag limits for each platform
3. **Character Restrictions**: Some platforms have hashtag character limits
4. **Banned Hashtags**: Some hashtags may be restricted on certain platforms

#### Scheduling Problems

**Issue**: Posts not publishing at scheduled time

**Solutions:**
1. **Timezone Settings**: Verify your timezone is set correctly
2. **Platform Delays**: Some platforms may have publishing delays
3. **System Status**: Check if the scheduling system is operational
4. **Queue Status**: Review the publishing queue for any issues

### Getting Help

#### Support Channels

1. **Help Center**: Access built-in help documentation
2. **Email Support**: Contact support@sma-platform.com
3. **Live Chat**: Available during business hours
4. **Community Forum**: Connect with other users

#### Reporting Issues

When reporting issues, please include:
- **Account Information**: Your username or email
- **Platform Details**: Which social media platforms are affected
- **Error Messages**: Exact error messages received
- **Steps to Reproduce**: What you were doing when the issue occurred
- **Screenshots**: Visual evidence of the problem

#### System Status

Check the system status page for:
- **Platform Connectivity**: Status of connections to social media platforms
- **Scheduled Maintenance**: Planned system updates
- **Known Issues**: Current problems and their resolution status
- **Performance Metrics**: System performance and uptime statistics

### Best Practices

#### Content Strategy

1. **Consistent Posting**: Maintain regular posting schedule
2. **Platform Optimization**: Tailor content for each platform's audience
3. **Engagement Timing**: Post when your audience is most active
4. **Content Variety**: Mix different types of content (text, images, videos)
5. **Hashtag Strategy**: Use relevant, trending hashtags appropriately

#### Account Management

1. **Regular Monitoring**: Check post performance and engagement
2. **Token Maintenance**: Refresh platform connections regularly
3. **Content Review**: Review auto-generated content before publishing
4. **Backup Strategy**: Keep copies of important content
5. **Security Updates**: Keep account credentials secure and updated

This user guide provides comprehensive information for using the Social Media Automation Platform effectively. For additional support or questions not covered in this guide, please contact our support team.