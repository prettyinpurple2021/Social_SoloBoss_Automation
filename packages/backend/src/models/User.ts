import { db } from '../database/connection';
import { 
  UserRow, 
  CreateUserInput, 
  UpdateUserInput,
  UserSettings 
} from '../types/database';

export class UserModel {
  static async create(input: CreateUserInput): Promise<UserRow> {
    const query = `
      INSERT INTO users (email, name, password_hash, settings)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      input.email,
      input.name,
      input.password_hash,
      JSON.stringify(input.settings || {})
    ];

    const result = await db.query<UserRow>(query, values);
    return result.rows[0];
  }

  static async findById(id: string): Promise<UserRow | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query<UserRow>(query, [id]);
    return result.rows[0] || null;
  }

  static async findByEmail(email: string): Promise<UserRow | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await db.query<UserRow>(query, [email]);
    return result.rows[0] || null;
  }

  static async update(id: string, input: UpdateUserInput): Promise<UserRow | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(input.email);
    }
    if (input.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(input.name);
    }
    if (input.password_hash !== undefined) {
      updates.push(`password_hash = $${paramCount++}`);
      values.push(input.password_hash);
    }
    if (input.settings !== undefined) {
      updates.push(`settings = $${paramCount++}`);
      values.push(JSON.stringify(input.settings));
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    values.push(id);

    const result = await db.query<UserRow>(query, values);
    return result.rows[0] || null;
  }

  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  static async list(limit: number = 50, offset: number = 0): Promise<UserRow[]> {
    const query = `
      SELECT * FROM users 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    const result = await db.query<UserRow>(query, [limit, offset]);
    return result.rows;
  }

  static async updateSettings(id: string, settings: UserSettings): Promise<UserRow | null> {
    const query = `
      UPDATE users 
      SET settings = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query<UserRow>(query, [JSON.stringify(settings), id]);
    return result.rows[0] || null;
  }
}