import { Platform } from '../types/platform';
import { PostData } from '../types/post';
import { ContentOptimizationService } from './ContentOptimizationService';
import { ImageOptimizationService } from './ImageOptimizationService';
import { HashtagOptimizationService } from './HashtagOptimizationService';

/**
 * Demo class showing how to use the content optimization services together
 */
export class ContentOptimizationDemo {
  /**
   * Demonstrates complete content optimization for a post across all platforms
   */
  public static demonstrateFullOptimization(): void {
    const samplePost: PostData = {
      userId: 'demo-user',
      platforms: [Platform.FACEBOOK, Platform.INSTAGRAM, Platform.PINTEREST, Platform.X],
      content: 'Just launched my new tech startup focused on AI-powered productivity tools! Excited to share this journey with everyone. What productivity challenges do you face daily?',
      images: ['https://example.com/startup-launch.jpg'],
      hashtags: ['#startup', '#AI', '#productivity', '#tech', '#entrepreneur']
    };

    console.log('=== Content Optimization Demo ===\n');
    console.log('Original Post:');
    console.log(`Content: ${samplePost.content}`);
    console.log(`Hashtags: ${samplePost.hashtags?.join(', ')}`);
    console.log(`Images: ${samplePost.images?.join(', ')}`);
    console.log('\n');

    // Optimize for each platform
    for (const platform of samplePost.platforms) {
      console.log(`--- Optimization for ${platform.toUpperCase()} ---`);
      
      // Content optimization
      const contentResult = ContentOptimizationService.optimizeContentForPlatform(samplePost, platform);
      console.log(`Optimized Content: ${contentResult.optimizedContent.content}`);
      console.log(`Optimized Hashtags: ${contentResult.optimizedContent.hashtags?.join(', ')}`);
      
      if (contentResult.warnings.length > 0) {
        console.log(`Warnings: ${contentResult.warnings.join(', ')}`);
      }
      
      if (contentResult.suggestions.length > 0) {
        console.log(`Suggestions: ${contentResult.suggestions.join(', ')}`);
      }
      
      if (contentResult.truncated) {
        console.log('⚠️  Content was truncated to fit platform limits');
      }

      // Hashtag analysis
      if (samplePost.hashtags) {
        const hashtagAnalysis = HashtagOptimizationService.analyzeHashtags(
          samplePost.hashtags, 
          platform, 
          samplePost.content
        );
        
        console.log(`Hashtag Analysis: ${hashtagAnalysis.isOptimal ? '✅ Optimal' : '⚠️  Needs improvement'}`);
        console.log(`Count: ${hashtagAnalysis.count}/${hashtagAnalysis.maxRecommended} recommended`);
        
        if (hashtagAnalysis.improvements.length > 0) {
          console.log(`Hashtag Improvements: ${hashtagAnalysis.improvements.join(', ')}`);
        }
      }

      // Image optimization
      if (samplePost.images && samplePost.images.length > 0 && samplePost.images[0]) {
        const imageValidation = ImageOptimizationService.validateImageForPlatform(
          samplePost.images[0], 
          platform
        );
        
        console.log(`Image Validation: ${imageValidation.isValid ? '✅ Valid' : '⚠️  Issues found'}`);
        
        if (imageValidation.suggestions.length > 0) {
          console.log(`Image Suggestions: ${imageValidation.suggestions.join(', ')}`);
        }
        
        const optimalDimensions = ImageOptimizationService.getOptimalDimensionsForPlatform(platform);
        if (optimalDimensions) {
          console.log(`Optimal Dimensions: ${optimalDimensions.width}x${optimalDimensions.height}`);
        }
      }

      console.log('\n');
    }
  }

  /**
   * Demonstrates hashtag optimization for different content types
   */
  public static demonstrateHashtagOptimization(): void {
    console.log('=== Hashtag Optimization Demo ===\n');

    const contentExamples = [
      {
        content: 'Just finished an amazing workout at the gym! Feeling stronger every day.',
        platform: Platform.INSTAGRAM
      },
      {
        content: 'New blog post about sustainable living tips for busy professionals.',
        platform: Platform.PINTEREST
      },
      {
        content: 'Excited to announce our latest product update with AI features!',
        platform: Platform.X
      },
      {
        content: 'Family dinner tonight with homemade pasta and fresh ingredients.',
        platform: Platform.FACEBOOK
      }
    ];

    for (const example of contentExamples) {
      console.log(`--- ${example.platform.toUpperCase()} Content ---`);
      console.log(`Content: ${example.content}`);
      
      const suggestions = HashtagOptimizationService.suggestHashtagsForContent(
        example.content, 
        example.platform
      );
      
      console.log('Suggested Hashtags:');
      suggestions.forEach(suggestion => {
        console.log(`  ${suggestion.hashtag} (${suggestion.popularity}) - ${suggestion.reason}`);
      });
      
      console.log('\n');
    }
  }

  /**
   * Demonstrates image optimization recommendations
   */
  public static demonstrateImageOptimization(): void {
    console.log('=== Image Optimization Demo ===\n');

    const platforms = [Platform.FACEBOOK, Platform.INSTAGRAM, Platform.PINTEREST, Platform.X];

    for (const platform of platforms) {
      console.log(`--- ${platform.toUpperCase()} Image Guidelines ---`);
      
      const instructions = ImageOptimizationService.generateImageOptimizationInstructions(platform);
      instructions.forEach(instruction => {
        console.log(`  • ${instruction}`);
      });
      
      const imageTypes = ImageOptimizationService.getImageTypeOptions(platform);
      console.log(`Available Image Types: ${imageTypes.join(', ')}`);
      
      console.log('\n');
    }
  }
}

// Run demos if this file is executed directly
if (require.main === module) {
  ContentOptimizationDemo.demonstrateFullOptimization();
  ContentOptimizationDemo.demonstrateHashtagOptimization();
  ContentOptimizationDemo.demonstrateImageOptimization();
}