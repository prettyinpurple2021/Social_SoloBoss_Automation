import crypto from 'crypto';
import { loggerService } from './LoggerService';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;
  private static readonly SALT_LENGTH = 32;
  
  // Key rotation support
  private static keyCache: Map<string, Buffer> = new Map();
  private static currentKeyId: string = '1';

  private static getEncryptionKey(keyId: string = this.currentKeyId): Buffer {
    // Check cache first
    if (this.keyCache.has(keyId)) {
      return this.keyCache.get(keyId)!;
    }

    const keyEnvVar = keyId === '1' ? 'ENCRYPTION_KEY' : `ENCRYPTION_KEY_${keyId}`;
    const key = process.env[keyEnvVar];
    
    if (!key) {
      throw new Error(`${keyEnvVar} environment variable is required`);
    }
    
    // Create a consistent 32-byte key from the environment variable with unique salt per key
    const salt = `encryption_salt_${keyId}`;
    const derivedKey = crypto.scryptSync(key, salt, this.KEY_LENGTH);
    
    // Cache the key
    this.keyCache.set(keyId, derivedKey);
    
    return derivedKey;
  }

  /**
   * Get current key ID for new encryptions
   */
  private static getCurrentKeyId(): string {
    return process.env.CURRENT_ENCRYPTION_KEY_ID || this.currentKeyId;
  }

  /**
   * Rotate to a new encryption key
   */
  static rotateKey(newKeyId: string): void {
    try {
      // Verify the new key exists and is valid
      this.getEncryptionKey(newKeyId);
      this.currentKeyId = newKeyId;
      
      loggerService.info('Encryption key rotated', { 
        newKeyId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      loggerService.error('Failed to rotate encryption key', error as Error, { newKeyId });
      throw error;
    }
  }

  /**
   * Encrypts a string value with authenticated encryption (AES-GCM)
   */
  static encrypt(text: string, keyId?: string): string {
    try {
      const currentKeyId = keyId || this.getCurrentKeyId();
      const key = this.getEncryptionKey(currentKeyId);
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      // Format: keyId:iv:tag:encrypted
      return `${currentKeyId}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
    } catch (error) {
      loggerService.error('Encryption failed', error as Error, { keyId });
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypts an encrypted string value with authentication verification
   */
  static decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      
      if (parts.length !== 4) {
        throw new Error('Invalid encrypted data format');
      }

      const [keyId, ivHex, tagHex, encrypted] = parts;
      const key = this.getEncryptionKey(keyId);
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      loggerService.error('Decryption failed', error as Error);
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypts data with additional authenticated data (AAD)
   */
  static encryptWithAAD(text: string, aad: string, keyId?: string): string {
    try {
      const currentKeyId = keyId || this.getCurrentKeyId();
      const key = this.getEncryptionKey(currentKeyId);
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      
      // Set additional authenticated data
      cipher.setAAD(Buffer.from(aad, 'utf8'));

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Format: keyId:iv:tag:aad_length:aad:encrypted
      const aadHex = Buffer.from(aad, 'utf8').toString('hex');
      return `${currentKeyId}:${iv.toString('hex')}:${tag.toString('hex')}:${aadHex.length}:${aadHex}:${encrypted}`;
    } catch (error) {
      loggerService.error('Encryption with AAD failed', error as Error, { keyId });
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypts data with additional authenticated data verification
   */
  static decryptWithAAD(encryptedText: string): { data: string; aad: string } {
    try {
      const parts = encryptedText.split(':');
      
      if (parts.length !== 6) {
        throw new Error('Invalid encrypted data format with AAD');
      }

      const [keyId, ivHex, tagHex, aadLengthStr, aadHex, encrypted] = parts;
      const key = this.getEncryptionKey(keyId);
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const aad = Buffer.from(aadHex, 'hex').toString('utf8');

      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      decipher.setAAD(Buffer.from(aad, 'utf8'));

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return { data: decrypted, aad };
    } catch (error) {
      loggerService.error('Decryption with AAD failed', error as Error);
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypts an OAuth token object
   */
  static encryptToken(token: { accessToken: string; refreshToken?: string }): { 
    accessToken: string; 
    refreshToken?: string 
  } {
    return {
      accessToken: this.encrypt(token.accessToken),
      refreshToken: token.refreshToken ? this.encrypt(token.refreshToken) : undefined
    };
  }

  /**
   * Decrypts an OAuth token object
   */
  static decryptToken(encryptedToken: { accessToken: string; refreshToken?: string }): { 
    accessToken: string; 
    refreshToken?: string 
  } {
    return {
      accessToken: this.decrypt(encryptedToken.accessToken),
      refreshToken: encryptedToken.refreshToken ? this.decrypt(encryptedToken.refreshToken) : undefined
    };
  }

  /**
   * Generates a secure random state string for OAuth
   */
  static generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generates a secure nonce for OAuth state
   */
  static generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generates a cryptographically secure random string
   */
  static generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Creates a secure hash of data (SHA-256)
   */
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  /**
   * Creates a secure hash with salt
   */
  static hashWithSalt(data: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(data + actualSalt, 'utf8').digest('hex');
    return { hash, salt: actualSalt };
  }

  /**
   * Verifies a hash with salt
   */
  static verifyHash(data: string, hash: string, salt: string): boolean {
    const computedHash = crypto.createHash('sha256').update(data + salt, 'utf8').digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
  }

  /**
   * Creates HMAC signature
   */
  static createHMAC(data: string, secret: string, algorithm: string = 'sha256'): string {
    return crypto.createHmac(algorithm, secret).update(data, 'utf8').digest('hex');
  }

  /**
   * Verifies HMAC signature
   */
  static verifyHMAC(data: string, signature: string, secret: string, algorithm: string = 'sha256'): boolean {
    const computedSignature = this.createHMAC(data, secret, algorithm);
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(computedSignature, 'hex'));
  }

  /**
   * Generates a secure API key
   */
  static generateAPIKey(): string {
    const prefix = 'sma_';
    const randomPart = crypto.randomBytes(32).toString('base64url');
    return prefix + randomPart;
  }

  /**
   * Encrypts sensitive configuration data
   */
  static encryptConfig(config: Record<string, any>): string {
    const configString = JSON.stringify(config);
    return this.encrypt(configString);
  }

  /**
   * Decrypts sensitive configuration data
   */
  static decryptConfig(encryptedConfig: string): Record<string, any> {
    const configString = this.decrypt(encryptedConfig);
    return JSON.parse(configString);
  }

  /**
   * Securely wipe sensitive data from memory (best effort)
   */
  static secureWipe(buffer: Buffer): void {
    if (buffer && buffer.length > 0) {
      crypto.randomFillSync(buffer);
      buffer.fill(0);
    }
  }

  /**
   * Get available encryption keys (for key management)
   */
  static getAvailableKeys(): string[] {
    const keys: string[] = [];
    
    // Check for numbered keys
    for (let i = 1; i <= 10; i++) {
      const keyEnvVar = i === 1 ? 'ENCRYPTION_KEY' : `ENCRYPTION_KEY_${i}`;
      if (process.env[keyEnvVar]) {
        keys.push(i.toString());
      }
    }
    
    return keys;
  }

  /**
   * Validate encryption key strength
   */
  static validateKeyStrength(key: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (key.length < 32) {
      issues.push('Key is too short (minimum 32 characters)');
    }
    
    if (!/[A-Z]/.test(key)) {
      issues.push('Key should contain uppercase letters');
    }
    
    if (!/[a-z]/.test(key)) {
      issues.push('Key should contain lowercase letters');
    }
    
    if (!/[0-9]/.test(key)) {
      issues.push('Key should contain numbers');
    }
    
    if (!/[^A-Za-z0-9]/.test(key)) {
      issues.push('Key should contain special characters');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}