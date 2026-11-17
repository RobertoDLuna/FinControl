import { query } from '../database/connection.js';
import {
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from '../schemas/categories.schema.js';
import { Category, CategoryType } from '../types/finance.types.js';

interface DbCategoryRow {
  id: string;
  user_id: string;
  name: string;
  type: CategoryType;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const CATEGORY_COLUMNS = `
  id,
  user_id,
  name,
  type,
  color,
  icon,
  is_active,
  created_at,
  updated_at
`;

function mapCategory(row: DbCategoryRow): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    color: row.color,
    icon: row.icon,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const categoriesRepository = {
  async listByUser(userId: string, filters: ListCategoriesQuery): Promise<Category[]> {
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];

    if (!filters.includeInactive) {
      conditions.push('is_active = TRUE');
    }

    if (filters.type) {
      params.push(filters.type);
      conditions.push(`type = $${params.length}`);
    }

    const result = await query<DbCategoryRow>(
      `SELECT ${CATEGORY_COLUMNS}
       FROM categories
       WHERE ${conditions.join(' AND ')}
       ORDER BY type ASC, name ASC`,
      params,
    );

    return result.rows.map(mapCategory);
  },

  async findById(userId: string, categoryId: string): Promise<Category | null> {
    const result = await query<DbCategoryRow>(
      `SELECT ${CATEGORY_COLUMNS}
       FROM categories
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [categoryId, userId],
    );

    const row = result.rows[0];
    return row ? mapCategory(row) : null;
  },

  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    const result = await query<DbCategoryRow>(
      `INSERT INTO categories (user_id, name, type, color, icon)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${CATEGORY_COLUMNS}`,
      [userId, input.name, input.type, input.color ?? null, input.icon ?? null],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Falha inesperada ao criar categoria.');
    }

    return mapCategory(row);
  },

  async update(
    userId: string,
    categoryId: string,
    input: UpdateCategoryInput,
  ): Promise<Category | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    const assignField = (column: string, value: unknown) => {
      params.push(value);
      setClauses.push(`${column} = $${params.length}`);
    };

    if (input.name !== undefined) assignField('name', input.name);
    if (input.type !== undefined) assignField('type', input.type);
    if (input.color !== undefined) assignField('color', input.color);
    if (input.icon !== undefined) assignField('icon', input.icon);
    if (input.isActive !== undefined) assignField('is_active', input.isActive);

    if (setClauses.length === 0) {
      return this.findById(userId, categoryId);
    }

    params.push(categoryId, userId);

    const result = await query<DbCategoryRow>(
      `UPDATE categories
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING ${CATEGORY_COLUMNS}`,
      params,
    );

    const row = result.rows[0];
    return row ? mapCategory(row) : null;
  },

  async deactivate(userId: string, categoryId: string): Promise<Category | null> {
    const result = await query<DbCategoryRow>(
      `UPDATE categories
       SET is_active = FALSE
       WHERE id = $1 AND user_id = $2
       RETURNING ${CATEGORY_COLUMNS}`,
      [categoryId, userId],
    );

    const row = result.rows[0];
    return row ? mapCategory(row) : null;
  },
};
