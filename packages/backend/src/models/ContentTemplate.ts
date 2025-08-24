import { db } from '../database';
import { Platform } from '../types/database';

export interface ContentTemplateRow {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  template_type: 'blogger' | 'soloboss' | 'manual';
  platform: Platform | 'all';
  template_content: string;
  variables: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateContentTemplateInput {
  user_id: string;
  name: string;
  description?: string;
  template_type: 'blogger' | 'soloboss' | 'manual';
  platform: Platform | 'all';
  template_content: string;
  variables?: string[];
  is_active?: boolean;
}

export interface UpdateContentTemplateInput {
  name?: string;
  description?: string;
  template_content?: string;
  variables?: string[];
  is_active?: boolean;
}

export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

export class ContentTemplateModel {
  /**
   * Create a new content template
   */
  static async create(input: CreateContentTemplateInput): Promise<ContentTemplateRow> {
    const query = `
      INSERT INTO content_templates (
        user_id, name, description, template_type, platform, 
        template_content, variables, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      input.user_id,
      input.name,
      input.description || null,
      input.template_type,
      input.platform,
      input.template_content,
      input.variables || [],
      input.is_active ?? true
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Find template by ID
   */
  static async findById(id: string, userId?: string): Promise<ContentTemplateRow | null> {
    let query = 'SELECT * FROM content_templates WHERE id = $1';
    const values = [id];
    
    if (userId) {
      query += ' AND user_id = $2';
      values.push(userId);
    }

    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Find templates by user ID
   */
  static async findByUserId(userId: string, templateType?: string, platform?: Platform | 'all'): Promise<ContentTemplateRow[]> {
    let query = 'SELECT * FROM content_templates WHERE user_id = $1';
    const values: any[] = [userId];
    let paramCount = 2;

    if (templateType) {
      query += ` AND template_type = $${paramCount}`;
      values.push(templateType);
      paramCount++;
    }

    if (platform) {
      query += ` AND (platform = $${paramCount} OR platform = 'all')`;
      values.push(platform);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, values);
    return result.rows;
  }

  /**
   * Find active templates for a specific integration type and platform
   */
  static async findActiveTemplates(
    userId: string, 
    templateType: 'blogger' | 'soloboss' | 'manual', 
    platform?: Platform
  ): Promise<ContentTemplateRow[]> {
    let query = `
      SELECT * FROM content_templates 
      WHERE user_id = $1 AND template_type = $2 AND is_active = true
    `;
    const values: any[] = [userId, templateType];
    let paramCount = 3;

    if (platform) {
      query += ` AND (platform = $${paramCount} OR platform = 'all')`;
      values.push(platform);
    } else {
      query += ` AND platform = 'all'`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, values);
    return result.rows;
  }

  /**
   * Update template
   */
  static async update(id: string, userId: string, input: UpdateContentTemplateInput): Promise<ContentTemplateRow | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(input.name);
    }

    if (input.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(input.description);
    }

    if (input.template_content !== undefined) {
      fields.push(`template_content = $${paramCount++}`);
      values.push(input.template_content);
    }

    if (input.variables !== undefined) {
      fields.push(`variables = $${paramCount++}`);
      values.push(input.variables);
    }

    if (input.is_active !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(input.is_active);
    }

    if (fields.length === 0) {
      return null;
    }

    fields.push(`updated_at = $${paramCount++}`);
    values.push(new Date());
    values.push(id);
    values.push(userId);

    const query = `
      UPDATE content_templates 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount - 1} AND user_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete template
   */
  static async delete(id: string, userId: string): Promise<boolean> {
    const query = 'DELETE FROM content_templates WHERE id = $1 AND user_id = $2';
    const result = await db.query(query, [id, userId]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Get available template variables for a template type
   */
  static getAvailableVariables(templateType: 'blogger' | 'soloboss' | 'manual'): TemplateVariable[] {
    const commonVariables: TemplateVariable[] = [
      { name: 'title', description: 'Post title', required: false },
      { name: 'content', description: 'Post content/excerpt', required: false },
      { name: 'url', description: 'Post URL', required: false },
      { name: 'author', description: 'Post author', required: false },
      { name: 'date', description: 'Publication date', required: false },
      { name: 'hashtags', description: 'Generated hashtags', required: false }
    ];

    switch (templateType) {
      case 'blogger':
        return [
          ...commonVariables,
          { name: 'blog_name', description: 'Blog name', required: false },
          { name: 'categories', description: 'Post categories', required: false },
          { name: 'excerpt', description: 'Post excerpt', required: false }
        ];
      
      case 'soloboss':
        return [
          ...commonVariables,
          { name: 'seo_suggestions', description: 'SEO suggestions', required: false },
          { name: 'social_text', description: 'AI-generated social media text', required: false },
          { name: 'keywords', description: 'Extracted keywords', required: false }
        ];
      
      case 'manual':
        return commonVariables;
      
      default:
        return commonVariables;
    }
  }
}