import { Platform } from './platform';

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string[];
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthState {
  userId: string;
  platform: Platform;
  state: string;
  createdAt: Date;
}

export interface TokenRefreshResult {
  success: boolean;
  token?: OAuthToken;
  error?: string;
}

export interface AuthenticationError {
  code: string;
  message: string;
  platform?: Platform;
  retryable: boolean;
}

export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}