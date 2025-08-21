import { Pool } from 'pg';
import { SoloBossConfig } from '../types/soloboss';
import { EncryptionService } from '../services/EncryptionService';

export class SoloBossIntegration {
  constructor(
    private db: Pool
  ) {}

  async create(userId: string, apiKey: string, webhookSecret: string): Promise<SoloBossConfig> {
    const encryptedApiKey = EncryptionService.encrypt(apiKey);
    const encryptedWebhookSecret = EncryptionService.encrypt(webhookSecret);
    
    const query = `
      INSERT INTO soloboss_integrations (user_id, api_key, webhook_secret, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, user_id, api_key, webhook_secret, is_active, created_at, updated_at
    `;
    
    const result = await this.db.query(query, [userId, encryptedApiKey, encryptedWebhookSecret, true]);
    const row = result.rows[0];
    
    return {
      id: row.id,
      userId: row.user_id,
      apiKey: row.api_key,
      webhookSecret: row.webhook_secret,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findByUserId(userId: string): Promise<SoloBossConfig | null> {
    const query = `
      SELECT id, user_id, api_key, webhook_secret, is_active, created_at, updated_at
      FROM soloboss_integrations
      WHERE user_id = $1 AND is_active = true
    `;
    
    const result = await this.db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      apiKey: row.api_key,
      webhookSecret: row.webhook_secret,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getDecryptedApiKey(userId: string): Promise<string | null> {
    const config = await this.findByUserId(userId);
    if (!config) {
      return null;
    }
    
    return EncryptionService.decrypt(config.apiKey);
  }

  async getDecryptedWebhookSecret(userId: string): Promise<string | null> {
    const config = await this.findByUserId(userId);
    if (!config) {
      return null;
    }
    
    return EncryptionService.decrypt(config.webhookSecret);
  }

  async update(userId: string, updates: Partial<Pick<SoloBossConfig, 'apiKey' | 'webhookSecret' | 'isActive'>>): Promise<SoloBossConfig | null> {
    const config = await this.findByUserId(userId);
    if (!config) {
      return null;
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (updates.apiKey !== undefined) {
      updateFields.push(`api_key = $${paramIndex++}`);
      updateValues.push(EncryptionService.encrypt(updates.apiKey));
    }

    if (updates.webhookSecret !== undefined) {
      updateFields.push(`webhook_secret = $${paramIndex++}`);
      updateValues.push(EncryptionService.encrypt(updates.webhookSecret));
    }

    if (updates.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      updateValues.push(updates.isActive);
    }

    if (updateFields.length === 0) {
      return config;
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(userId);

    const query = `
      UPDATE soloboss_integrations
      SET ${updateFields.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING id, user_id, api_key, webhook_secret, is_active, created_at, updated_at
    `;

    const result = await this.db.query(query, updateValues);
    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      apiKey: row.api_key,
      webhookSecret: row.webhook_secret,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async delete(userId: string): Promise<boolean> {
    const query = `
      UPDATE soloboss_integrations
      SET is_active = false, updated_at = NOW()
      WHERE user_id = $1
    `;
    
    const result = await this.db.query(query, [userId]);
    return (result.rowCount || 0) > 0;
  }
}