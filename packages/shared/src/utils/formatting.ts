import { Platform } from '../types/platform';
import { PostData } from '../types/post';
import { PLATFORM_CHARACTER_LIMITS } from '../constants/platforms';

export function formatPostForPlatform(post: PostData, platform: Platform): string {
  let content = post.content;
  const characterLimit = PLATFORM_CHARACTER_LIMITS[platform];
  
  // Add hashtags if they exist
  if (post.hashtags && post.hashtags.length > 0) {
    const hashtagString = post.hashtags.join(' ');
    content = `${content}\n\n${hashtagString}`;
  }
  
  // Truncate if necessary
  if (content.length > characterLimit) {
    content = truncateContent(content, characterLimit);
  }
  
  return content.trim();
}

export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }
  
  // Try to truncate at word boundary
  const truncated = content.substring(0, maxLength - 3);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > 0 && lastSpaceIndex > maxLength * 0.5) {
    return truncated.substring(0, lastSpaceIndex) + '...';
  }
  
  return truncated + '...';
}

export function extractHashtags(content: string): string[] {
  const hashtagRegex = /#[a-zA-Z0-9_]+/g;
  const matches = content.match(hashtagRegex);
  return matches || [];
}

export function removeHashtags(content: string): string {
  return content.replace(/#[a-zA-Z0-9_]+/g, '').replace(/\s+/g, ' ').trim();
}

export function formatDateTime(date: Date, timezone?: string): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone
  };
  
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks === 1 ? '' : 's'} ago`;
  }
  
  return formatDateTime(date);
}

export function generatePostPreview(post: PostData, platform: Platform): string {
  const formattedContent = formatPostForPlatform(post, platform);
  const maxPreviewLength = 100;
  
  if (formattedContent.length <= maxPreviewLength) {
    return formattedContent;
  }
  
  return truncateContent(formattedContent, maxPreviewLength);
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
}

export function capitalizeWords(text: string): string {
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatPlatformName(platform: Platform): string {
  switch (platform) {
    case Platform.FACEBOOK:
      return 'Facebook';
    case Platform.INSTAGRAM:
      return 'Instagram';
    case Platform.PINTEREST:
      return 'Pinterest';
    case Platform.X:
      return 'X';
    default:
      return capitalizeWords(platform);
  }
}

export function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unknown error occurred';
}