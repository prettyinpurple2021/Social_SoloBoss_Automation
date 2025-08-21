// OAuth types and interfaces

import { Platform } from './database';

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string[];
  tokenType?: string;
}

export interface OAuthUserInfo {
  id: string;
  username: string;
  name?: string;
  email?: string;
  profilePicture?: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  authUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
}

export interface OAuthAuthorizationParams {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  responseType: 'code';
  [key: string]: string;
}

export interface OAuthTokenRequest {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  grantType: 'authorization_code';
}

export interface OAuthRefreshRequest {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  grantType: 'refresh_token';
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export interface OAuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

export interface PlatformOAuthConfig {
  [Platform.FACEBOOK]: OAuthConfig;
  [Platform.INSTAGRAM]: OAuthConfig;
  [Platform.PINTEREST]: OAuthConfig;
  [Platform.X]: OAuthConfig;
}

export interface OAuthState {
  userId: string;
  platform: Platform;
  timestamp: number;
  nonce: string;
}

export interface ConnectionResult {
  success: boolean;
  connection?: {
    id: string;
    platform: Platform;
    username: string;
    isActive: boolean;
  };
  error?: string;
}

export interface DisconnectionResult {
  success: boolean;
  error?: string;
}