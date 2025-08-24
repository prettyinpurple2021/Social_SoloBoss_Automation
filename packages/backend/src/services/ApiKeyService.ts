import { db } from '../database/connection';
import { loggerService } from './LoggerService';
import { monitoringService } from './MonitoringService';
import { EncryptionService } from './EncryptionService';
import { AppError, ErrorCode, ErrorSeverity } from '../types/errors';
import { randomBytes, createHash } from 'crypto';

export interface ApiKey {
    id: string;
    userId: string;
    name: string;
    keyHash: string;
    permissions: string[];
    isActive: boolean;
    expiresAt?: Date;
    lastUsedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface ApiKeyUsage {
    id: string;
    apiKeyId: string;
    endpoint: string;
    method: string;
    ipAddress: string;
    userAgent: string;
    responseStatus: number;
    responseTime: number;
    timestamp: Date;
}

export interface CreateApiKeyRequest {
    name: string;
    permissions: string[];
    expiresAt?: Date;
}

export interface ApiKeyInfo {
    id: string;
    name: string;
    keyPrefix: string;
    permissions: string[];
    isActive: boolean;
    expiresAt?: Date;
    lastUsedAt?: Date;
    createdAt: Date;
    usageCount: number;
}

export class ApiKeyService {
    private static instance: ApiKeyService;
    private readonly keyPrefix = 'sma_';
    private readonly keyLength = 64;

    private constructor() { }

    static getInstance(): ApiKeyService {
        if (!ApiKeyService.instance) {
            ApiKeyService.instance = new ApiKeyService();
        }
        return ApiKeyService.instance;
    }

    /**
     * Create a new API key for a user
     */
    async createApiKey(
        userId: string,
        request: CreateApiKeyRequest
    ): Promise<{ apiKey: string; keyInfo: ApiKeyInfo }> {
        try {
            // Validate permissions
            const validPermissions = [
                'posts:read',
                'posts:write',
                'posts:delete',
                'analytics:read',
                'platforms:read',
                'platforms:write',
                'users:read',
                'admin:all'
            ];

            const invalidPermissions = request.permissions.filter(
                p => !validPermissions.includes(p)
            );

            if (invalidPermissions.length > 0) {
                throw new AppError(
                    `Invalid permissions: ${invalidPermissions.join(', ')}`,
                    ErrorCode.VALIDATION_ERROR,
                    400,
                    ErrorSeverity.LOW
                );
            }

            // Check user's API key limit
            const existingKeysCount = await this.getUserApiKeyCount(userId);
            const maxKeysPerUser = parseInt(process.env.MAX_API_KEYS_PER_USER || '10');

            if (existingKeysCount >= maxKeysPerUser) {
                throw new AppError(
                    `Maximum API keys limit reached (${maxKeysPerUser})`,
                    ErrorCode.VALIDATION_ERROR,
                    400,
                    ErrorSeverity.LOW
                );
            }

            // Generate API key
            const keyId = randomBytes(16).toString('hex');
            const keySecret = randomBytes(32).toString('hex');
            const apiKey = `${this.keyPrefix}${keyId}_${keySecret}`;
            const keyHash = this.hashApiKey(apiKey);

            // Store in database
            const result = await db.query(`
        INSERT INTO api_keys (
          id, user_id, name, key_hash, permissions, is_active, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, created_at
      `, [
                keyId,
                userId,
                request.name,
                keyHash,
                JSON.stringify(request.permissions),
                true,
                request.expiresAt || null
            ]);

            const keyInfo: ApiKeyInfo = {
                id: keyId,
                name: request.name,
                keyPrefix: `${this.keyPrefix}${keyId.substring(0, 8)}...`,
                permissions: request.permissions,
                isActive: true,
                expiresAt: request.expiresAt,
                lastUsedAt: undefined,
                createdAt: result.rows[0].created_at,
                usageCount: 0
            };

            // Log API key creation
            loggerService.audit('API key created', {
                userId,
                keyId,
                keyName: request.name,
                permissions: request.permissions,
                expiresAt: request.expiresAt
            });

            monitoringService.incrementCounter('api_keys_created', 1, {
                userId,
                permissionCount: request.permissions.length.toString()
            });

            return { apiKey, keyInfo };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            loggerService.error('Failed to create API key', error as Error, { userId });
            throw new AppError(
                'Failed to create API key',
                ErrorCode.DATABASE_ERROR,
                500,
                ErrorSeverity.HIGH
            );
        }
    }

    /**
     * Validate an API key and return associated information
     */
    async validateApiKey(apiKey: string): Promise<{
        isValid: boolean;
        userId?: string;
        keyId?: string;
        permissions?: string[];
    }> {
        try {
            // Validate format
            if (!this.isValidApiKeyFormat(apiKey)) {
                return { isValid: false };
            }

            const keyId = this.extractKeyId(apiKey);
            const keyHash = this.hashApiKey(apiKey);

            // Look up key in database
            const result = await db.query(`
        SELECT 
          ak.id, ak.user_id, ak.permissions, ak.is_active, ak.expires_at,
          u.is_active as user_active
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        WHERE ak.id = $1 AND ak.key_hash = $2
      `, [keyId, keyHash]);

            if (result.rows.length === 0) {
                // Log invalid key attempt
                loggerService.security('Invalid API key used', {
                    keyPrefix: apiKey.substring(0, 12),
                    timestamp: new Date()
                });

                monitoringService.incrementCounter('invalid_api_key_attempts', 1);
                return { isValid: false };
            }

            const keyData = result.rows[0];

            // Check if key is active
            if (!keyData.is_active) {
                loggerService.security('Inactive API key used', {
                    keyId: keyData.id,
                    userId: keyData.user_id
                });
                return { isValid: false };
            }

            // Check if user is active
            if (!keyData.user_active) {
                loggerService.security('API key used by inactive user', {
                    keyId: keyData.id,
                    userId: keyData.user_id
                });
                return { isValid: false };
            }

            // Check expiration
            if (keyData.expires_at && new Date() > new Date(keyData.expires_at)) {
                loggerService.security('Expired API key used', {
                    keyId: keyData.id,
                    userId: keyData.user_id,
                    expiresAt: keyData.expires_at
                });
                return { isValid: false };
            }

            // Update last used timestamp
            await this.updateLastUsed(keyData.id);

            return {
                isValid: true,
                userId: keyData.user_id,
                keyId: keyData.id,
                permissions: JSON.parse(keyData.permissions)
            };
        } catch (error) {
            loggerService.error('API key validation failed', error as Error, {
                keyPrefix: apiKey.substring(0, 12)
            });
            return { isValid: false };
        }
    }

    /**
     * Get all API keys for a user
     */
    async getUserApiKeys(userId: string): Promise<ApiKeyInfo[]> {
        try {
            const result = await db.query(`
        SELECT 
          ak.id, ak.name, ak.permissions, ak.is_active, ak.expires_at,
          ak.last_used_at, ak.created_at,
          COUNT(aku.id) as usage_count
        FROM api_keys ak
        LEFT JOIN api_key_usage aku ON ak.id = aku.api_key_id
        WHERE ak.user_id = $1
        GROUP BY ak.id, ak.name, ak.permissions, ak.is_active, ak.expires_at, ak.last_used_at, ak.created_at
        ORDER BY ak.created_at DESC
      `, [userId]);

            return result.rows.map(row => ({
                id: row.id,
                name: row.name,
                keyPrefix: `${this.keyPrefix}${row.id.substring(0, 8)}...`,
                permissions: JSON.parse(row.permissions),
                isActive: row.is_active,
                expiresAt: row.expires_at,
                lastUsedAt: row.last_used_at,
                createdAt: row.created_at,
                usageCount: parseInt(row.usage_count)
            }));
        } catch (error) {
            loggerService.error('Failed to get user API keys', error as Error, { userId });
            throw new AppError(
                'Failed to retrieve API keys',
                ErrorCode.DATABASE_ERROR,
                500,
                ErrorSeverity.MEDIUM
            );
        }
    }

    /**
     * Revoke an API key
     */
    async revokeApiKey(userId: string, keyId: string): Promise<void> {
        try {
            const result = await db.query(`
        UPDATE api_keys 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND user_id = $2
      `, [keyId, userId]);

            if (result.rowCount === 0) {
                throw new AppError(
                    'API key not found',
                    ErrorCode.NOT_FOUND,
                    404,
                    ErrorSeverity.LOW
                );
            }

            loggerService.audit('API key revoked', {
                userId,
                keyId
            });

            monitoringService.incrementCounter('api_keys_revoked', 1, {
                userId
            });
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            loggerService.error('Failed to revoke API key', error as Error, {
                userId,
                keyId
            });
            throw new AppError(
                'Failed to revoke API key',
                ErrorCode.DATABASE_ERROR,
                500,
                ErrorSeverity.MEDIUM
            );
        }
    }

    /**
     * Log API key usage
     */
    async logApiKeyUsage(
        keyId: string,
        endpoint: string,
        method: string,
        ipAddress: string,
        userAgent: string,
        responseStatus: number,
        responseTime: number
    ): Promise<void> {
        try {
            await db.query(`
        INSERT INTO api_key_usage (
          api_key_id, endpoint, method, ip_address, user_agent,
          response_status, response_time, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [keyId, endpoint, method, ipAddress, userAgent, responseStatus, responseTime]);

            // Record metrics
            monitoringService.incrementCounter('api_key_requests', 1, {
                keyId: keyId.substring(0, 8),
                endpoint,
                method,
                status: responseStatus.toString()
            });

            monitoringService.recordTimer('api_key_response_time', responseTime, {
                endpoint,
                method
            });
        } catch (error) {
            // Don't throw - logging usage shouldn't break the request
            loggerService.error('Failed to log API key usage', error as Error, {
                keyId,
                endpoint,
                method
            });
        }
    }

    /**
     * Get API key usage statistics
     */
    async getApiKeyUsage(
        userId: string,
        keyId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<ApiKeyUsage[]> {
        try {
            let query = `
        SELECT aku.*
        FROM api_key_usage aku
        JOIN api_keys ak ON aku.api_key_id = ak.id
        WHERE ak.user_id = $1 AND ak.id = $2
      `;
            const params: any[] = [userId, keyId];

            if (startDate) {
                query += ` AND aku.timestamp >= $${params.length + 1}`;
                params.push(startDate);
            }

            if (endDate) {
                query += ` AND aku.timestamp <= $${params.length + 1}`;
                params.push(endDate);
            }

            query += ` ORDER BY aku.timestamp DESC LIMIT 1000`;

            const result = await db.query(query, params);

            return result.rows.map(row => ({
                id: row.id,
                apiKeyId: row.api_key_id,
                endpoint: row.endpoint,
                method: row.method,
                ipAddress: row.ip_address,
                userAgent: row.user_agent,
                responseStatus: row.response_status,
                responseTime: row.response_time,
                timestamp: row.timestamp
            }));
        } catch (error) {
            loggerService.error('Failed to get API key usage', error as Error, {
                userId,
                keyId
            });
            throw new AppError(
                'Failed to retrieve API key usage',
                ErrorCode.DATABASE_ERROR,
                500,
                ErrorSeverity.MEDIUM
            );
        }
    }

    /**
     * Clean up expired API keys
     */
    async cleanupExpiredKeys(): Promise<number> {
        try {
            const result = await db.query(`
        UPDATE api_keys 
        SET is_active = false, updated_at = NOW()
        WHERE expires_at < NOW() AND is_active = true
      `);

            const deactivatedCount = result.rowCount || 0;

            if (deactivatedCount > 0) {
                loggerService.info(`Deactivated ${deactivatedCount} expired API keys`);
                monitoringService.incrementCounter('api_keys_expired', deactivatedCount);
            }

            return deactivatedCount;
        } catch (error) {
            loggerService.error('Failed to cleanup expired API keys', error as Error);
            return 0;
        }
    }

    /**
     * Check if user has permission for an action
     */
    hasPermission(userPermissions: string[], requiredPermission: string): boolean {
        // Admin permission grants all access
        if (userPermissions.includes('admin:all')) {
            return true;
        }

        // Check for exact permission match
        if (userPermissions.includes(requiredPermission)) {
            return true;
        }

        // Check for wildcard permissions
        const [resource, action] = requiredPermission.split(':');
        const wildcardPermission = `${resource}:*`;

        return userPermissions.includes(wildcardPermission);
    }

    /**
     * Private helper methods
     */
    private async getUserApiKeyCount(userId: string): Promise<number> {
        const result = await db.query(
            'SELECT COUNT(*) as count FROM api_keys WHERE user_id = $1 AND is_active = true',
            [userId]
        );
        return parseInt(result.rows[0].count);
    }

    private async updateLastUsed(keyId: string): Promise<void> {
        try {
            await db.query(
                'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
                [keyId]
            );
        } catch (error) {
            // Don't throw - this is not critical
            loggerService.debug('Failed to update API key last used timestamp', { keyId });
        }
    }

    private isValidApiKeyFormat(apiKey: string): boolean {
        const pattern = new RegExp(`^${this.keyPrefix}[a-f0-9]{32}_[a-f0-9]{64}$`);
        return pattern.test(apiKey);
    }

    private extractKeyId(apiKey: string): string {
        return apiKey.substring(this.keyPrefix.length, this.keyPrefix.length + 32);
    }

    private hashApiKey(apiKey: string): string {
        return createHash('sha256').update(apiKey).digest('hex');
    }
}

// Export singleton instance
export const apiKeyService = ApiKeyService.getInstance();

// Schedule cleanup task
if (process.env.NODE_ENV !== 'test') {
    setInterval(async () => {
        try {
            await apiKeyService.cleanupExpiredKeys();
        } catch (error) {
            loggerService.error('API key cleanup task failed', error as Error);
        }
    }, 24 * 60 * 60 * 1000); // Run daily
}