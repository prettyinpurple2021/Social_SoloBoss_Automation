import { createHash, createHmac, randomBytes } from 'crypto';

export function generateRandomString(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

export function hashString(input: string, algorithm: string = 'sha256'): string {
  return createHash(algorithm).update(input).digest('hex');
}

export function createSignature(data: string, secret: string, algorithm: string = 'sha256'): string {
  return createHmac(algorithm, secret).update(data).digest('hex');
}

export function verifySignature(data: string, signature: string, secret: string, algorithm: string = 'sha256'): boolean {
  const expectedSignature = createSignature(data, secret, algorithm);
  return signature === expectedSignature;
}

export function generateApiKey(): string {
  const prefix = 'sma';
  const timestamp = Date.now().toString(36);
  const random = generateRandomString(16);
  return `${prefix}_${timestamp}_${random}`;
}

export function generateWebhookSecret(): string {
  return generateRandomString(32);
}

export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }
  
  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  const middle = '*'.repeat(data.length - (visibleChars * 2));
  
  return `${start}${middle}${end}`;
}

export function generateStateParameter(): string {
  return generateSecureToken(16);
}

export function validateStateParameter(state: string): boolean {
  // Basic validation - should be base64url encoded string
  return /^[A-Za-z0-9_-]+$/.test(state) && state.length >= 16;
}