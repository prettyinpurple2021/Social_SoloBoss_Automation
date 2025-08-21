export interface SoloBossConfig {
  id: string;
  userId: string;
  apiKey: string; // encrypted
  webhookSecret: string; // encrypted
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SoloBossWebhookPayload {
  id: string;
  title: string;
  content: string;
  seoSuggestions: string[];
  socialMediaText: string;
  images: string[];
  publishedAt: string;
  userId: string;
  signature: string;
}

export interface SoloBossConnectionRequest {
  apiKey: string;
  webhookSecret: string;
}

export interface SoloBossConnectionResult {
  success: boolean;
  error?: string;
  configId?: string;
}