# Real-World Examples

This guide shows you how to build common features using our API. Each example includes complete, working code that you can copy and modify.

## Table of Contents

1. [Simple Post Scheduler](#simple-post-scheduler)
2. [Content Calendar](#content-calendar)
3. [Analytics Dashboard](#analytics-dashboard)
4. [Bulk Post Creator](#bulk-post-creator)
5. [Platform Manager](#platform-manager)
6. [Error Handler](#error-handler)
7. [Rate Limit Manager](#rate-limit-manager)

---

## Simple Post Scheduler

**What it does**: Creates and schedules posts for different times and platforms.

### JavaScript Version

```javascript
const { SocialMediaAutomationSDK } = require('@sma/sdk');

class PostScheduler {
  constructor() {
    this.client = new SocialMediaAutomationSDK({
      baseURL: 'http://localhost:3001/api',
      debug: true
    });
  }

  async login(email, password) {
    try {
      const result = await this.client.login(email, password);
      console.log(`✓ Logged in as ${result.user.name}`);
      return true;
    } catch (error) {
      console.error('Login failed:', error.message);
      return false;
    }
  }

  async schedulePost(content, platforms, scheduleTime, hashtags = []) {
    try {
      const post = await this.client.createPost({
        content,
        platforms,
        hashtags,
        scheduledTime: scheduleTime
      });

      console.log(`✓ Scheduled post "${content.substring(0, 50)}..." for ${scheduleTime}`);
      console.log(`  Platforms: ${platforms.join(', ')}`);
      console.log(`  Post ID: ${post.id}`);
      
      return post;
    } catch (error) {
      console.error('Failed to schedule post:', error.message);
      throw error;
    }
  }

  async scheduleWeeklyPosts() {
    const posts = [
      {
        content: "Monday Motivation: Start your week strong! 💪",
        platforms: ['facebook', 'instagram'],
        hashtags: ['#MondayMotivation', '#WeekStart'],
        day: 'monday',
        time: '09:00'
      },
      {
        content: "Wednesday Wisdom: Keep pushing forward! 🌟",
        platforms: ['facebook', 'x'],
        hashtags: ['#WednesdayWisdom', '#Inspiration'],
        day: 'wednesday',
        time: '14:00'
      },
      {
        content: "Friday Feeling: Weekend is almost here! 🎉",
        platforms: ['instagram', 'pinterest'],
        hashtags: ['#FridayFeeling', '#Weekend'],
        day: 'friday',
        time: '17:00'
      }
    ];

    for (const postData of posts) {
      const scheduleTime = this.getNextScheduleTime(postData.day, postData.time);
      await this.schedulePost(
        postData.content,
        postData.platforms,
        scheduleTime,
        postData.hashtags
      );
    }
  }

  getNextScheduleTime(dayName, time) {
    const days = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
      'friday': 5, 'saturday': 6, 'sunday': 0
    };

    const now = new Date();
    const targetDay = days[dayName.toLowerCase()];
    const [hours, minutes] = time.split(':').map(Number);

    const scheduleDate = new Date();
    scheduleDate.setHours(hours, minutes, 0, 0);

    // Calculate days until target day
    const currentDay = now.getDay();
    let daysUntilTarget = targetDay - currentDay;
    
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7; // Next week
    }

    scheduleDate.setDate(now.getDate() + daysUntilTarget);
    return scheduleDate.toISOString();
  }
}

// Usage
async function main() {
  const scheduler = new PostScheduler();
  
  if (await scheduler.login('developer@example.com', 'sandbox123')) {
    await scheduler.scheduleWeeklyPosts();
    console.log('✓ All posts scheduled successfully!');
  }
}

main().catch(console.error);
```

### Python Version

```python
from datetime import datetime, timedelta
from sma_sdk import SocialMediaAutomationSDK, SMAConfig, SMAError

class PostScheduler:
    def __init__(self):
        config = SMAConfig(
            base_url="http://localhost:3001/api",
            debug=True
        )
        self.client = SocialMediaAutomationSDK(config)

    def login(self, email, password):
        try:
            result = self.client.login(email, password)
            print(f"✓ Logged in as {result['user'].name}")
            return True
        except SMAError as error:
            print(f"Login failed: {error.message}")
            return False

    def schedule_post(self, content, platforms, schedule_time, hashtags=None):
        try:
            post = self.client.create_post({
                "content": content,
                "platforms": platforms,
                "hashtags": hashtags or [],
                "scheduled_time": schedule_time
            })

            print(f"✓ Scheduled post \"{content[:50]}...\" for {schedule_time}")
            print(f"  Platforms: {', '.join(platforms)}")
            print(f"  Post ID: {post.id}")
            
            return post
        except SMAError as error:
            print(f"Failed to schedule post: {error.message}")
            raise

    def schedule_weekly_posts(self):
        posts = [
            {
                "content": "Monday Motivation: Start your week strong! 💪",
                "platforms": ["facebook", "instagram"],
                "hashtags": ["#MondayMotivation", "#WeekStart"],
                "day": "monday",
                "time": "09:00"
            },
            {
                "content": "Wednesday Wisdom: Keep pushing forward! 🌟",
                "platforms": ["facebook", "x"],
                "hashtags": ["#WednesdayWisdom", "#Inspiration"],
                "day": "wednesday",
                "time": "14:00"
            },
            {
                "content": "Friday Feeling: Weekend is almost here! 🎉",
                "platforms": ["instagram", "pinterest"],
                "hashtags": ["#FridayFeeling", "#Weekend"],
                "day": "friday",
                "time": "17:00"
            }
        ]

        for post_data in posts:
            schedule_time = self.get_next_schedule_time(post_data["day"], post_data["time"])
            self.schedule_post(
                post_data["content"],
                post_data["platforms"],
                schedule_time,
                post_data["hashtags"]
            )

    def get_next_schedule_time(self, day_name, time_str):
        days = {
            'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
            'friday': 4, 'saturday': 5, 'sunday': 6
        }

        now = datetime.now()
        target_day = days[day_name.lower()]
        hours, minutes = map(int, time_str.split(':'))

        # Calculate days until target day
        current_day = now.weekday()
        days_until_target = target_day - current_day
        
        if days_until_target <= 0:
            days_until_target += 7  # Next week

        schedule_date = now + timedelta(days=days_until_target)
        schedule_date = schedule_date.replace(hour=hours, minute=minutes, second=0, microsecond=0)
        
        return schedule_date.isoformat() + "Z"

# Usage
def main():
    scheduler = PostScheduler()
    
    if scheduler.login("developer@example.com", "sandbox123"):
        scheduler.schedule_weekly_posts()
        print("✓ All posts scheduled successfully!")

if __name__ == "__main__":
    main()
```

---

## Content Calendar

**What it does**: Creates a visual calendar showing when posts are scheduled.

### JavaScript Version

```javascript
const { SocialMediaAutomationSDK } = require('@sma/sdk');

class ContentCalendar {
  constructor() {
    this.client = new SocialMediaAutomationSDK({
      baseURL: 'http://localhost:3001/api',
      debug: true
    });
  }

  async login(email, password) {
    const result = await this.client.login(email, password);
    console.log(`✓ Logged in as ${result.user.name}`);
  }

  async getCalendar(startDate, endDate) {
    try {
      // Get all posts in date range
      const posts = await this.client.getPosts({
        limit: 100,
        sort: 'scheduledTime',
        order: 'asc'
      });

      // Filter by date range and group by date
      const calendar = {};
      
      posts.data.forEach(post => {
        if (post.scheduledTime) {
          const date = post.scheduledTime.split('T')[0]; // Get just the date part
          
          if (!calendar[date]) {
            calendar[date] = [];
          }
          
          calendar[date].push({
            id: post.id,
            content: post.content.substring(0, 50) + '...',
            time: post.scheduledTime.split('T')[1].substring(0, 5), // Get time HH:MM
            platforms: post.platforms,
            status: post.status
          });
        }
      });

      return calendar;
    } catch (error) {
      console.error('Failed to get calendar:', error.message);
      throw error;
    }
  }

  displayCalendar(calendar) {
    console.log('\n📅 CONTENT CALENDAR');
    console.log('='.repeat(80));

    const sortedDates = Object.keys(calendar).sort();
    
    if (sortedDates.length === 0) {
      console.log('No scheduled posts found.');
      return;
    }

    sortedDates.forEach(date => {
      console.log(`\n📆 ${this.formatDate(date)}`);
      console.log('-'.repeat(40));
      
      calendar[date].forEach(post => {
        const statusIcon = this.getStatusIcon(post.status);
        const platformIcons = post.platforms.map(p => this.getPlatformIcon(p)).join(' ');
        
        console.log(`  ${statusIcon} ${post.time} - ${post.content}`);
        console.log(`    ${platformIcons} (${post.platforms.join(', ')})`);
        console.log(`    ID: ${post.id}`);
        console.log('');
      });
    });
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getStatusIcon(status) {
    const icons = {
      'draft': '📝',
      'scheduled': '⏰',
      'published': '✅',
      'failed': '❌'
    };
    return icons[status] || '❓';
  }

  getPlatformIcon(platform) {
    const icons = {
      'facebook': '📘',
      'instagram': '📷',
      'x': '🐦',
      'pinterest': '📌'
    };
    return icons[platform] || '📱';
  }

  async generateWeeklyReport() {
    const calendar = await this.getCalendar();
    const stats = this.calculateStats(calendar);
    
    console.log('\n📊 WEEKLY REPORT');
    console.log('='.repeat(40));
    console.log(`Total scheduled posts: ${stats.total}`);
    console.log(`Posts per platform:`);
    
    Object.entries(stats.platforms).forEach(([platform, count]) => {
      console.log(`  ${this.getPlatformIcon(platform)} ${platform}: ${count}`);
    });
    
    console.log(`\nBusiest day: ${stats.busiestDay} (${stats.busiestDayCount} posts)`);
    console.log(`Average posts per day: ${stats.averagePerDay.toFixed(1)}`);
  }

  calculateStats(calendar) {
    let total = 0;
    const platforms = {};
    const dailyCounts = {};

    Object.entries(calendar).forEach(([date, posts]) => {
      total += posts.length;
      dailyCounts[date] = posts.length;
      
      posts.forEach(post => {
        post.platforms.forEach(platform => {
          platforms[platform] = (platforms[platform] || 0) + 1;
        });
      });
    });

    const busiestDay = Object.entries(dailyCounts)
      .sort(([,a], [,b]) => b - a)[0];

    return {
      total,
      platforms,
      busiestDay: busiestDay ? this.formatDate(busiestDay[0]) : 'None',
      busiestDayCount: busiestDay ? busiestDay[1] : 0,
      averagePerDay: Object.keys(calendar).length > 0 ? total / Object.keys(calendar).length : 0
    };
  }
}

// Usage
async function main() {
  const calendar = new ContentCalendar();
  
  await calendar.login('developer@example.com', 'sandbox123');
  
  const calendarData = await calendar.getCalendar();
  calendar.displayCalendar(calendarData);
  
  await calendar.generateWeeklyReport();
}

main().catch(console.error);
```

---

## Analytics Dashboard

**What it does**: Shows performance metrics and insights about your posts.

### JavaScript Version

```javascript
const { SocialMediaAutomationSDK } = require('@sma/sdk');

class AnalyticsDashboard {
  constructor() {
    this.client = new SocialMediaAutomationSDK({
      baseURL: 'http://localhost:3001/api',
      debug: true
    });
  }

  async login(email, password) {
    const result = await this.client.login(email, password);
    console.log(`✓ Logged in as ${result.user.name}`);
  }

  async showDashboard() {
    try {
      console.log('\n📊 ANALYTICS DASHBOARD');
      console.log('='.repeat(60));

      // Get overall analytics
      const analytics = await this.client.getAnalytics();
      
      this.displayOverview(analytics);
      await this.displayPlatformBreakdown(analytics);
      await this.displayRecentPosts();
      
    } catch (error) {
      console.error('Failed to load dashboard:', error.message);
    }
  }

  displayOverview(analytics) {
    console.log('\n📈 OVERVIEW');
    console.log('-'.repeat(30));
    console.log(`Total Posts: ${analytics.totalPosts}`);
    console.log(`Published: ${analytics.publishedPosts} ✅`);
    console.log(`Failed: ${analytics.failedPosts} ❌`);
    console.log(`Scheduled: ${analytics.scheduledPosts} ⏰`);
    console.log(`Success Rate: ${analytics.successRate.toFixed(1)}%`);
    console.log(`Avg Posts/Day: ${analytics.averagePostsPerDay.toFixed(1)}`);
  }

  displayPlatformBreakdown(analytics) {
    console.log('\n🌐 PLATFORM BREAKDOWN');
    console.log('-'.repeat(30));
    
    const platforms = Object.entries(analytics.platformBreakdown)
      .sort(([,a], [,b]) => b - a);

    platforms.forEach(([platform, count]) => {
      const percentage = ((count / analytics.totalPosts) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(percentage / 5));
      const icon = this.getPlatformIcon(platform);
      
      console.log(`${icon} ${platform.padEnd(10)} ${count.toString().padStart(3)} posts (${percentage}%) ${bar}`);
    });
  }

  async displayRecentPosts() {
    console.log('\n📝 RECENT POSTS');
    console.log('-'.repeat(30));

    const posts = await this.client.getPosts({
      limit: 5,
      sort: 'createdAt',
      order: 'desc'
    });

    posts.data.forEach(post => {
      const statusIcon = this.getStatusIcon(post.status);
      const date = new Date(post.createdAt).toLocaleDateString();
      const platforms = post.platforms.map(p => this.getPlatformIcon(p)).join(' ');
      
      console.log(`${statusIcon} ${date} - ${post.content.substring(0, 40)}...`);
      console.log(`   ${platforms} ${post.platforms.join(', ')}`);
      console.log('');
    });
  }

  async generateReport(days = 7) {
    console.log(`\n📋 ${days}-DAY REPORT`);
    console.log('='.repeat(40));

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const analytics = await this.client.getAnalytics({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });

    console.log(`📅 Period: ${startDate.toDateString()} to ${endDate.toDateString()}`);
    console.log(`📊 Total Posts: ${analytics.totalPosts}`);
    console.log(`✅ Success Rate: ${analytics.successRate.toFixed(1)}%`);
    
    if (analytics.totalPosts > 0) {
      console.log(`📈 Daily Average: ${(analytics.totalPosts / days).toFixed(1)} posts`);
      
      const bestPlatform = Object.entries(analytics.platformBreakdown)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (bestPlatform) {
        console.log(`🏆 Top Platform: ${bestPlatform[0]} (${bestPlatform[1]} posts)`);
      }
    }

    // Recommendations
    this.generateRecommendations(analytics);
  }

  generateRecommendations(analytics) {
    console.log('\n💡 RECOMMENDATIONS');
    console.log('-'.repeat(30));

    if (analytics.successRate < 80) {
      console.log('⚠️  Success rate is low. Check platform connections.');
    }

    if (analytics.averagePostsPerDay < 1) {
      console.log('📈 Consider posting more frequently for better engagement.');
    }

    const platforms = Object.keys(analytics.platformBreakdown);
    if (platforms.length < 2) {
      console.log('🌐 Try posting to multiple platforms to reach more audience.');
    }

    if (analytics.scheduledPosts === 0) {
      console.log('⏰ Schedule posts in advance for consistent presence.');
    }

    console.log('✨ Keep up the great work!');
  }

  getPlatformIcon(platform) {
    const icons = {
      'facebook': '📘',
      'instagram': '📷',
      'x': '🐦',
      'pinterest': '📌'
    };
    return icons[platform] || '📱';
  }

  getStatusIcon(status) {
    const icons = {
      'draft': '📝',
      'scheduled': '⏰',
      'published': '✅',
      'failed': '❌'
    };
    return icons[status] || '❓';
  }
}

// Usage
async function main() {
  const dashboard = new AnalyticsDashboard();
  
  await dashboard.login('developer@example.com', 'sandbox123');
  await dashboard.showDashboard();
  await dashboard.generateReport(7);
}

main().catch(console.error);
```

---

## Bulk Post Creator

**What it does**: Creates multiple posts at once from a list or CSV file.

### JavaScript Version

```javascript
const { SocialMediaAutomationSDK } = require('@sma/sdk');
const fs = require('fs');

class BulkPostCreator {
  constructor() {
    this.client = new SocialMediaAutomationSDK({
      baseURL: 'http://localhost:3001/api',
      debug: true
    });
  }

  async login(email, password) {
    const result = await this.client.login(email, password);
    console.log(`✓ Logged in as ${result.user.name}`);
  }

  async createFromArray(postsData) {
    console.log(`\n📝 Creating ${postsData.length} posts...`);
    
    try {
      const result = await this.client.createBulkPosts(postsData);
      
      console.log(`✅ Successfully created: ${result.scheduledPosts.length} posts`);
      
      if (result.errors.length > 0) {
        console.log(`❌ Failed to create: ${result.errors.length} posts`);
        result.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.message}`);
        });
      }

      return result;
    } catch (error) {
      console.error('Bulk creation failed:', error.message);
      throw error;
    }
  }

  async createFromCSV(filePath) {
    try {
      const csvData = fs.readFileSync(filePath, 'utf8');
      const posts = this.parseCSV(csvData);
      
      console.log(`📄 Loaded ${posts.length} posts from ${filePath}`);
      
      return await this.createFromArray(posts);
    } catch (error) {
      console.error('Failed to create from CSV:', error.message);
      throw error;
    }
  }

  parseCSV(csvData) {
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const posts = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const post = {};
      
      headers.forEach((header, index) => {
        if (values[index]) {
          switch (header.toLowerCase()) {
            case 'content':
              post.content = values[index];
              break;
            case 'platforms':
              post.platforms = values[index].split(';').map(p => p.trim());
              break;
            case 'hashtags':
              post.hashtags = values[index].split(';').map(h => h.trim());
              break;
            case 'scheduledtime':
              post.scheduledTime = values[index];
              break;
          }
        }
      });
      
      if (post.content && post.platforms) {
        posts.push(post);
      }
    }
    
    return posts;
  }

  async createContentSeries(theme, count = 5) {
    const templates = {
      motivation: [
        "Monday Motivation: {message} 💪 #MondayMotivation #Inspiration",
        "Midweek Boost: {message} 🌟 #WednesdayWisdom #Motivation",
        "Friday Focus: {message} 🎯 #FridayFocus #Goals",
        "Weekend Reflection: {message} 🤔 #WeekendThoughts #Growth",
        "Sunday Prep: {message} 📋 #SundayPrep #Planning"
      ],
      tips: [
        "Pro Tip: {message} 💡 #ProTip #Advice",
        "Quick Tip: {message} ⚡ #QuickTip #Helpful",
        "Daily Tip: {message} 📝 #DailyTip #Learning",
        "Expert Tip: {message} 🎓 #ExpertTip #Knowledge",
        "Bonus Tip: {message} 🎁 #BonusTip #Extra"
      ],
      facts: [
        "Did you know? {message} 🤓 #DidYouKnow #Facts",
        "Fun Fact: {message} 🎉 #FunFact #Interesting",
        "Amazing Fact: {message} 😲 #AmazingFact #Wow",
        "Quick Fact: {message} ⚡ #QuickFact #Knowledge",
        "Daily Fact: {message} 📚 #DailyFact #Learning"
      ]
    };

    const messages = [
      "Success comes to those who dare to begin",
      "Every expert was once a beginner",
      "Progress, not perfection, is the goal",
      "Small steps lead to big changes",
      "Believe in yourself and all that you are"
    ];

    const themeTemplates = templates[theme.toLowerCase()] || templates.motivation;
    const posts = [];

    for (let i = 0; i < Math.min(count, themeTemplates.length); i++) {
      const content = themeTemplates[i].replace('{message}', messages[i % messages.length]);
      
      posts.push({
        content,
        platforms: ['facebook', 'instagram'],
        hashtags: this.extractHashtags(content)
      });
    }

    console.log(`\n🎨 Creating ${theme} content series (${posts.length} posts)...`);
    return await this.createFromArray(posts);
  }

  extractHashtags(content) {
    const hashtags = content.match(/#\w+/g) || [];
    return hashtags;
  }

  async scheduleWeeklyBatch(postsData, startDate) {
    const scheduledPosts = postsData.map((post, index) => {
      const scheduleDate = new Date(startDate);
      scheduleDate.setDate(scheduleDate.getDate() + index);
      scheduleDate.setHours(9, 0, 0, 0); // 9 AM each day
      
      return {
        ...post,
        scheduledTime: scheduleDate.toISOString()
      };
    });

    console.log(`\n📅 Scheduling ${scheduledPosts.length} posts over the next week...`);
    return await this.createFromArray(scheduledPosts);
  }

  generateSampleCSV(filePath) {
    const sampleData = `content,platforms,hashtags,scheduledTime
"Good morning! Start your day with positivity 🌅",facebook;instagram,#GoodMorning;#Positivity,2024-02-01T09:00:00Z
"Midweek motivation: You're doing great! 💪",facebook;x,#Motivation;#MidweekBoost,2024-02-02T14:00:00Z
"Friday feeling: Weekend is almost here! 🎉",instagram;pinterest,#FridayFeeling;#Weekend,2024-02-03T17:00:00Z
"Sunday reflection: What did you learn this week? 🤔",facebook;instagram;x,#SundayReflection;#Learning,2024-02-04T19:00:00Z`;

    fs.writeFileSync(filePath, sampleData);
    console.log(`✅ Sample CSV created at ${filePath}`);
  }
}

// Usage
async function main() {
  const bulkCreator = new BulkPostCreator();
  
  await bulkCreator.login('developer@example.com', 'sandbox123');
  
  // Example 1: Create from array
  const posts = [
    {
      content: "Hello from bulk creator! 👋",
      platforms: ['facebook', 'instagram'],
      hashtags: ['#bulk', '#test']
    },
    {
      content: "Second post in the batch 📝",
      platforms: ['x'],
      hashtags: ['#batch', '#automation']
    }
  ];
  
  await bulkCreator.createFromArray(posts);
  
  // Example 2: Create content series
  await bulkCreator.createContentSeries('motivation', 3);
  
  // Example 3: Generate sample CSV
  bulkCreator.generateSampleCSV('sample_posts.csv');
  
  // Example 4: Create from CSV (uncomment to use)
  // await bulkCreator.createFromCSV('sample_posts.csv');
}

main().catch(console.error);
```

---

## Error Handler

**What it does**: Shows how to properly handle different types of errors.

### JavaScript Version

```javascript
const { SocialMediaAutomationSDK, SMAError } = require('@sma/sdk');

class ErrorHandler {
  constructor() {
    this.client = new SocialMediaAutomationSDK({
      baseURL: 'http://localhost:3001/api',
      debug: true,
      retryAttempts: 3,
      retryDelay: 1000
    });
  }

  async safeLogin(email, password, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.client.login(email, password);
        console.log(`✅ Login successful: ${result.user.name}`);
        return result;
      } catch (error) {
        console.log(`❌ Login attempt ${attempt} failed: ${error.message}`);
        
        if (error instanceof SMAError) {
          switch (error.code) {
            case 'INVALID_TOKEN':
              console.log('💡 Check your email and password');
              break;
            case 'RATE_LIMIT_EXCEEDED':
              console.log(`⏰ Rate limited. Waiting ${error.retryAfter} seconds...`);
              await this.sleep(error.retryAfter * 1000);
              continue;
            case 'NETWORK_ERROR':
              if (attempt < maxRetries) {
                console.log('🔄 Network error, retrying...');
                await this.sleep(2000);
                continue;
              }
              break;
          }
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }
  }

  async safeCreatePost(postData) {
    try {
      // Validate data before sending
      this.validatePostData(postData);
      
      const post = await this.client.createPost(postData);
      console.log(`✅ Post created successfully: ${post.id}`);
      return post;
      
    } catch (error) {
      return this.handlePostError(error, postData);
    }
  }

  validatePostData(postData) {
    const errors = [];
    
    if (!postData.content || postData.content.trim() === '') {
      errors.push('Content is required and cannot be empty');
    }
    
    if (!postData.platforms || postData.platforms.length === 0) {
      errors.push('At least one platform is required');
    }
    
    if (postData.content && postData.content.length > 2000) {
      errors.push('Content is too long (max 2000 characters)');
    }
    
    const validPlatforms = ['facebook', 'instagram', 'x', 'pinterest'];
    if (postData.platforms) {
      const invalidPlatforms = postData.platforms.filter(p => !validPlatforms.includes(p));
      if (invalidPlatforms.length > 0) {
        errors.push(`Invalid platforms: ${invalidPlatforms.join(', ')}`);
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }

  async handlePostError(error, postData) {
    console.log(`❌ Post creation failed: ${error.message}`);
    
    if (error instanceof SMAError) {
      switch (error.code) {
        case 'VALIDATION_ERROR':
          console.log('💡 Fix these validation errors:');
          if (error.details && error.details.validationErrors) {
            error.details.validationErrors.forEach(err => {
              console.log(`   - ${err.field}: ${err.message}`);
            });
          }
          return null;
          
        case 'RATE_LIMIT_EXCEEDED':
          console.log(`⏰ Rate limited. Retrying after ${error.retryAfter} seconds...`);
          await this.sleep(error.retryAfter * 1000);
          return await this.safeCreatePost(postData);
          
        case 'PLATFORM_API_ERROR':
          console.log('🔌 Platform API issue. Trying with fewer platforms...');
          if (postData.platforms.length > 1) {
            const reducedPost = {
              ...postData,
              platforms: [postData.platforms[0]] // Try with just first platform
            };
            return await this.safeCreatePost(reducedPost);
          }
          break;
          
        case 'INSUFFICIENT_PERMISSIONS':
          console.log('🔒 Permission denied. Check your account settings.');
          break;
          
        case 'RESOURCE_NOT_FOUND':
          console.log('❓ Resource not found. Check your platform connections.');
          break;
          
        default:
          console.log(`🤷 Unexpected error: ${error.code}`);
          if (error.documentation) {
            console.log(`📖 See: ${error.documentation}`);
          }
      }
    } else {
      console.log('💥 Non-API error:', error.message);
    }
    
    return null;
  }

  async robustBulkCreate(postsData) {
    console.log(`\n🔄 Creating ${postsData.length} posts with error handling...`);
    
    const results = {
      successful: [],
      failed: [],
      retried: []
    };
    
    for (let i = 0; i < postsData.length; i++) {
      const postData = postsData[i];
      console.log(`\n📝 Processing post ${i + 1}/${postsData.length}...`);
      
      try {
        const post = await this.safeCreatePost(postData);
        if (post) {
          results.successful.push(post);
          console.log(`✅ Post ${i + 1} created successfully`);
        } else {
          results.failed.push({ index: i, data: postData, reason: 'Creation failed' });
          console.log(`❌ Post ${i + 1} failed`);
        }
      } catch (error) {
        results.failed.push({ index: i, data: postData, reason: error.message });
        console.log(`💥 Post ${i + 1} threw error: ${error.message}`);
      }
      
      // Add delay between posts to avoid rate limiting
      if (i < postsData.length - 1) {
        await this.sleep(1000);
      }
    }
    
    this.printBulkResults(results);
    return results;
  }

  printBulkResults(results) {
    console.log('\n📊 BULK CREATION RESULTS');
    console.log('='.repeat(40));
    console.log(`✅ Successful: ${results.successful.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`🔄 Retried: ${results.retried.length}`);
    
    if (results.failed.length > 0) {
      console.log('\n❌ FAILED POSTS:');
      results.failed.forEach(failure => {
        console.log(`   ${failure.index + 1}. ${failure.reason}`);
        console.log(`      Content: "${failure.data.content.substring(0, 50)}..."`);
      });
    }
    
    const successRate = (results.successful.length / (results.successful.length + results.failed.length)) * 100;
    console.log(`\n📈 Success Rate: ${successRate.toFixed(1)}%`);
  }

  async demonstrateErrorHandling() {
    console.log('\n🧪 DEMONSTRATING ERROR HANDLING');
    console.log('='.repeat(50));
    
    // Test various error scenarios
    const testCases = [
      {
        name: 'Empty content',
        data: { content: '', platforms: ['facebook'] }
      },
      {
        name: 'No platforms',
        data: { content: 'Test post', platforms: [] }
      },
      {
        name: 'Invalid platform',
        data: { content: 'Test post', platforms: ['invalid_platform'] }
      },
      {
        name: 'Too long content',
        data: { content: 'x'.repeat(3000), platforms: ['facebook'] }
      },
      {
        name: 'Valid post',
        data: { content: 'This should work! ✅', platforms: ['facebook'] }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n🧪 Testing: ${testCase.name}`);
      await this.safeCreatePost(testCase.data);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
async function main() {
  const errorHandler = new ErrorHandler();
  
  try {
    // Safe login with retries
    await errorHandler.safeLogin('developer@example.com', 'sandbox123');
    
    // Demonstrate error handling
    await errorHandler.demonstrateErrorHandling();
    
    // Robust bulk creation
    const posts = [
      { content: 'Valid post 1', platforms: ['facebook'] },
      { content: '', platforms: ['facebook'] }, // This will fail
      { content: 'Valid post 2', platforms: ['instagram'] },
      { content: 'Valid post 3', platforms: ['invalid'] } // This will fail
    ];
    
    await errorHandler.robustBulkCreate(posts);
    
  } catch (error) {
    console.error('💥 Main execution failed:', error.message);
  }
}

main();
```

This collection of examples shows you how to build real applications using our API. Each example is complete and ready to run - just replace the login credentials with your own!

**Next Steps:**
1. Try running these examples in the sandbox environment
2. Modify them to fit your specific needs
3. Combine different examples to build more complex applications
4. Check our [Getting Started Guide](GETTING_STARTED.md) if you need help with the basics
5. See our [Troubleshooting Guide](TROUBLESHOOTING.md) if you run into issues