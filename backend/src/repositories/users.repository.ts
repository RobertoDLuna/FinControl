import { query, withTransaction } from '../database/connection.js';
import { PlanTier, PublicUser, UserWithPasswordRow } from '../types/auth.types.js';

interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
}

interface DefaultCategorySeed {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  color: string;
  icon: string;
}

interface DbPublicUserRow {
  id: string;
  name: string;
  email: string;
  plan_tier: PlanTier;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface DbUserWithPasswordRow extends DbPublicUserRow {
  password_hash: string;
}

const DEFAULT_CATEGORIES: readonly DefaultCategorySeed[] = [
  { name: 'Alimentação', type: 'EXPENSE', color: '#EF4444', icon: 'utensils' },
  { name: 'Transporte', type: 'EXPENSE', color: '#F59E0B', icon: 'car' },
  { name: 'Moradia', type: 'EXPENSE', color: '#3B82F6', icon: 'home' },
  { name: 'Saúde', type: 'EXPENSE', color: '#10B981', icon: 'heart-pulse' },
  { name: 'Lazer', type: 'EXPENSE', color: '#8B5CF6', icon: 'gamepad-2' },
  { name: 'Educação', type: 'EXPENSE', color: '#06B6D4', icon: 'graduation-cap' },
  { name: 'Assinaturas', type: 'EXPENSE', color: '#EC4899', icon: 'repeat' },
  { name: 'Outros Gastos', type: 'EXPENSE', color: '#64748B', icon: 'ellipsis' },
  { name: 'Salário', type: 'INCOME', color: '#22C55E', icon: 'wallet' },
  { name: 'Freelance', type: 'INCOME', color: '#14B8A6', icon: 'briefcase' },
  { name: 'Investimentos', type: 'INCOME', color: '#6366F1', icon: 'trending-up' },
  { name: 'Outras Rendas', type: 'INCOME', color: '#84CC16', icon: 'plus-circle' },
];

function mapPublicUser(row: DbPublicUserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    planTier: row.plan_tier,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUserWithPassword(row: DbUserWithPasswordRow): UserWithPasswordRow {
  return {
    ...mapPublicUser(row),
    passwordHash: row.password_hash,
  };
}

export const usersRepository = {
  /**
   * Verifica se já existe usuário cadastrado com o e-mail informado.
   */
  async existsByEmail(email: string): Promise<boolean> {
    const result = await query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)
       ) AS exists`,
      [email],
    );

    return Boolean(result.rows[0]?.exists);
  },

  /**
   * Busca usuário completo (incluindo password_hash) exclusivamente para verificação de login.
   */
  async findAuthByEmail(email: string): Promise<UserWithPasswordRow | null> {
    const result = await query<DbUserWithPasswordRow>(
      `SELECT
         id,
         name,
         email,
         password_hash,
         plan_tier,
         is_active,
         created_at,
         updated_at
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email],
    );

    const row = result.rows[0];
    return row ? mapUserWithPassword(row) : null;
  },

  /**
   * Busca dados públicos do usuário autenticado pelo seu ID (nunca expõe password_hash).
   */
  async findPublicById(id: string): Promise<PublicUser | null> {
    const result = await query<DbPublicUserRow>(
      `SELECT
         id,
         name,
         email,
         plan_tier,
         is_active,
         created_at,
         updated_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    return row ? mapPublicUser(row) : null;
  },

  /**
   * Cria um novo usuário e inicializa suas categorias padrão em transação atômica.
   */
  async createWithDefaultCategories(input: CreateUserInput): Promise<PublicUser> {
    return withTransaction(async (client) => {
      const userResult = await client.query<DbPublicUserRow>(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, LOWER($2), $3)
         RETURNING
           id,
           name,
           email,
           plan_tier,
           is_active,
           created_at,
           updated_at`,
        [input.name, input.email, input.passwordHash],
      );

      const createdRow = userResult.rows[0];
      if (!createdRow) {
        throw new Error('Falha inesperada ao criar registro de usuário.');
      }

      const names = DEFAULT_CATEGORIES.map((category) => category.name);
      const types = DEFAULT_CATEGORIES.map((category) => category.type);
      const colors = DEFAULT_CATEGORIES.map((category) => category.color);
      const icons = DEFAULT_CATEGORIES.map((category) => category.icon);

      await client.query(
        `INSERT INTO categories (user_id, name, type, color, icon)
         SELECT $1, name, type, color, icon
         FROM UNNEST($2::text[], $3::text[], $4::text[], $5::text[])
           AS seed(name, type, color, icon)`,
        [createdRow.id, names, types, colors, icons],
      );

      return mapPublicUser(createdRow);
    });
  },
};
