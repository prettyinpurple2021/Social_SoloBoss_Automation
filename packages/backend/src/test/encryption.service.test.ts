import { EncryptionService } from '../services/EncryptionService';

describe('EncryptionService', () => {
  const testText = 'test-secret-token';
  const testToken = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456'
  };

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-testing';
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt text correctly', () => {
      const encrypted = EncryptionService.encrypt(testText);
      expect(encrypted).not.toBe(testText);
      expect(encrypted).toContain(':'); // Should contain separator
      expect(encrypted.split(':').length).toBe(2); // Should have iv:encrypted format
      
      const decrypted = EncryptionService.decrypt(encrypted);
      expect(decrypted).toBe(testText);
    });

    it('should produce different encrypted values for same input', () => {
      const encrypted1 = EncryptionService.encrypt(testText);
      const encrypted2 = EncryptionService.encrypt(testText);
      
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to the same value
      expect(EncryptionService.decrypt(encrypted1)).toBe(testText);
      expect(EncryptionService.decrypt(encrypted2)).toBe(testText);
    });

    it('should throw error when encryption key is missing', () => {
      delete process.env.ENCRYPTION_KEY;
      
      expect(() => {
        EncryptionService.encrypt(testText);
      }).toThrow('ENCRYPTION_KEY environment variable is required');
    });

    it('should throw error for invalid encrypted data format', () => {
      expect(() => {
        EncryptionService.decrypt('invalid-format');
      }).toThrow('Decryption failed');
    });

    it('should throw error for corrupted encrypted data', () => {
      const encrypted = EncryptionService.encrypt(testText);
      const corrupted = encrypted.replace('a', 'b'); // Corrupt the data
      
      expect(() => {
        EncryptionService.decrypt(corrupted);
      }).toThrow('Decryption failed');
    });
  });

  describe('encryptToken and decryptToken', () => {
    it('should encrypt and decrypt token object correctly', () => {
      const encrypted = EncryptionService.encryptToken(testToken);
      
      expect(encrypted.accessToken).not.toBe(testToken.accessToken);
      expect(encrypted.refreshToken).not.toBe(testToken.refreshToken);
      expect(encrypted.accessToken).toBeDefined();
      expect(encrypted.refreshToken).toBeDefined();
      
      const decrypted = EncryptionService.decryptToken(encrypted);
      expect(decrypted).toEqual(testToken);
    });

    it('should handle token without refresh token', () => {
      const tokenWithoutRefresh = { accessToken: 'access-token-123' };
      
      const encrypted = EncryptionService.encryptToken(tokenWithoutRefresh);
      expect(encrypted.accessToken).toBeDefined();
      expect(encrypted.refreshToken).toBeUndefined();
      
      const decrypted = EncryptionService.decryptToken(encrypted);
      expect(decrypted).toEqual(tokenWithoutRefresh);
    });
  });

  describe('generateState', () => {
    it('should generate random state strings', () => {
      const state1 = EncryptionService.generateState();
      const state2 = EncryptionService.generateState();
      
      expect(state1).not.toBe(state2);
      expect(state1).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(state2).toHaveLength(64);
      expect(state1).toMatch(/^[a-f0-9]+$/i); // Should be hex (case insensitive)
      expect(state2).toMatch(/^[a-f0-9]+$/i);
    });
  });

  describe('generateNonce', () => {
    it('should generate random nonce strings', () => {
      const nonce1 = EncryptionService.generateNonce();
      const nonce2 = EncryptionService.generateNonce();
      
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(nonce2).toHaveLength(32);
      expect(nonce1).toMatch(/^[a-f0-9]+$/i); // Should be hex (case insensitive)
      expect(nonce2).toMatch(/^[a-f0-9]+$/i);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string encryption', () => {
      const encrypted = EncryptionService.encrypt('');
      const decrypted = EncryptionService.decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('should handle long text encryption', () => {
      const longText = 'a'.repeat(10000);
      const encrypted = EncryptionService.encrypt(longText);
      const decrypted = EncryptionService.decrypt(encrypted);
      expect(decrypted).toBe(longText);
    });

    it('should handle special characters', () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:,.<>?`~"\'\\';
      const encrypted = EncryptionService.encrypt(specialText);
      const decrypted = EncryptionService.decrypt(encrypted);
      expect(decrypted).toBe(specialText);
    });

    it('should handle unicode characters', () => {
      const unicodeText = '🔐🔑🛡️ Security tokens with émojis and ñoñó';
      const encrypted = EncryptionService.encrypt(unicodeText);
      const decrypted = EncryptionService.decrypt(encrypted);
      expect(decrypted).toBe(unicodeText);
    });
  });
});