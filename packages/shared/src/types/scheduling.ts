import { Platform } from './platform';

export interface SchedulingRule {
  id: string;
  userId: string;
  name: string;
  platforms: Platform[];
  timeSlots: TimeSlot[];
  timezone: string;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeSlot {
  dayOfWeek: number; // 0-6, Sunday = 0
  hour: number; // 0-23
  minute: number; // 0-59
  weight: number; // 1-10, higher = more preferred
}

export interface OptimalTime {
  platform: Platform;
  dayOfWeek: number;
  hour: number;
  minute: number;
  confidence: number; // 0-1
  basedOnData: boolean;
}

export interface SchedulingConflict {
  postId: string;
  scheduledTime: Date;
  conflictType: 'platform_limit' | 'time_slot_full' | 'user_preference';
  suggestedAlternatives: Date[];
}

export interface BulkSchedulingOptions {
  posts: Array<{
    content: string;
    platforms: Platform[];
    images?: string[];
    hashtags?: string[];
  }>;
  startDate: Date;
  endDate: Date;
  frequency: 'daily' | 'weekly' | 'custom';
  customInterval?: number; // hours
  respectOptimalTimes: boolean;
  avoidConflicts: boolean;
}

export interface BulkSchedulingResult {
  scheduledPosts: Array<{
    postIndex: number;
    scheduledTime: Date;
    platforms: Platform[];
  }>;
  conflicts: SchedulingConflict[];
  warnings: string[];
}

export interface RecurringSchedule {
  id: string;
  userId: string;
  name: string;
  template: string;
  platforms: Platform[];
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  dayOfWeek?: number; // for weekly
  dayOfMonth?: number; // for monthly
  time: {
    hour: number;
    minute: number;
  };
  timezone: string;
  isActive: boolean;
  nextExecution: Date;
  lastExecution?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchedulingPreferences {
  userId: string;
  timezone: string;
  defaultSchedulingWindow: {
    startHour: number;
    endHour: number;
  };
  avoidWeekends: boolean;
  avoidHolidays: boolean;
  preferredDays: number[]; // 0-6
  platformPreferences: Record<Platform, {
    preferredTimes: TimeSlot[];
    avoidTimes: TimeSlot[];
    maxPostsPerDay: number;
    minIntervalHours: number;
  }>;
}