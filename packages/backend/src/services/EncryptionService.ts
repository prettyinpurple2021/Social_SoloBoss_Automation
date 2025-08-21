import crypto from 'crypto';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;

  private static getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    // Create a consistent 32-byte key from the environment variable
    return crypto.scryptSync(key, 'salt', this.KEY_LENGTH);
  }

  /**
   * Encrypts a string value
   */
  static encrypt(text: string): string {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine iv and encrypted data
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypts an encrypted string value
   */
  static decrypt(encryptedText: string): string {
    try {
      const key = this.getEncryptionKey();
      const parts = encryptedText.split(':');
      
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
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
}