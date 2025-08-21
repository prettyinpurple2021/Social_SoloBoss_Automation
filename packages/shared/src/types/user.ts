export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  settings: UserSettings;
}

export interface UserSettings {
  timezone: string;
  defaultHashtags: string[];
  autoApproveFromSoloBoss: boolean;
  bloggerIntegrationEnabled: boolean;
  platformPreferences: PlatformPreferences;
  notificationSettings: NotificationSettings;
}

export interface PlatformPreferences {
  facebook: FacebookPreferences;
  instagram: InstagramPreferences;
  pinterest: PinterestPreferences;
  x: XPreferences;
}

export interface FacebookPreferences {
  defaultHashtags: string[];
  contentFormat: 'full' | 'summary';
  includeLink: boolean;
  autoPost: boolean;
}

export interface InstagramPreferences {
  defaultHashtags: string[];
  imageRequired: boolean;
  maxHashtags: number;
  autoPost: boolean;
}

export interface PinterestPreferences {
  defaultBoard: string;
  defaultHashtags: string[];
  imageRequired: boolean;
  autoPost: boolean;
}

export interface XPreferences {
  defaultHashtags: string[];
  shortenLinks: boolean;
  threadLongContent: boolean;
  autoPost: boolean;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  failedPostNotifications: boolean;
  integrationIssueNotifications: boolean;
  weeklyReports: boolean;
  notificationEmail?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}