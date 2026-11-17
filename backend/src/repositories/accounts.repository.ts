import { query } from '../database/connection.js';
import {
  CreateAccountInput,
  ListAccountsQuery,
  UpdateAccountInput,
} from '../schemas/accounts.schema.js';
import { AccountType, AccountWithBalance, BankCode } from '../types/finance.types.js';

interface DbAccountWithBalanceRow {
  id: string;
  user_id: string;
  name: string;
  bank_code: BankCode;
  type: AccountType;
  initial_balance_cents: string | number;
  current_balance_cents: string | number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const ACCOUNT_BALANCE_SELECT = `
  SELECT
    a.id,
    a.user_id,
    a.name,
    a.bank_code,
    a.type,
    a.initial_balance_cents,
    (
      a.initial_balance_cents + COALESCE(
        SUM(
          CASE
            WHEN t.type = 'INCOME' THEN t.total_amount_cents
            WHEN t.type = 'EXPENSE' THEN -t.total_amount_cents
            ELSE 0
          END
        ),
        0
      )
    ) AS current_balance_cents,
    a.is_active,
    a.created_at,
    a.updated_at
  FROM accounts a
  LEFT JOIN transactions t
    ON t.account_id = a.id
    AND t.user_id = a.user_id
    AND t.status = 'PAID'
    AND t.is_installment = FALSE
`;

function mapAccountWithBalance(row: DbAccountWithBalanceRow): AccountWithBalance {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    bankCode: row.bank_code,
    type: row.type,
    initialBalanceCents: Number(row.initial_balance_cents),
    currentBalanceCents: Number(row.current_balance_cents),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const accountsRepository = {
  async countActiveByUser(userId: string): Promise<number> {
    const result = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM accounts
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );

    return Number(result.rows[0]?.total ?? 0);
  },

  async listByUser(
    userId: string,
    filters: ListAccountsQuery,
  ): Promise<AccountWithBalance[]> {
    const conditions: string[] = ['a.user_id = $1'];
    const params: unknown[] = [userId];

    if (!filters.includeInactive) {
      conditions.push('a.is_active = TRUE');
    }

    if (filters.type) {
      params.push(filters.type);
      conditions.push(`a.type = $${params.length}`);
    }

    const result = await query<DbAccountWithBalanceRow>(
      `${ACCOUNT_BALANCE_SELECT}
       WHERE ${conditions.join(' AND ')}
       GROUP BY a.id
       ORDER BY a.is_active DESC, a.name ASC`,
      params,
    );

    return result.rows.map(mapAccountWithBalance);
  },

  async findById(userId: string, accountId: string): Promise<AccountWithBalance | null> {
    const result = await query<DbAccountWithBalanceRow>(
      `${ACCOUNT_BALANCE_SELECT}
       WHERE a.id = $1 AND a.user_id = $2
       GROUP BY a.id
       LIMIT 1`,
      [accountId, userId],
    );

    const row = result.rows[0];
    return row ? mapAccountWithBalance(row) : null;
  },

  async create(userId: string, input: CreateAccountInput): Promise<AccountWithBalance> {
    const result = await query<{ id: string }>(
      `INSERT INTO accounts (user_id, name, bank_code, type, initial_balance_cents)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, input.name, input.bankCode, input.type, input.initialBalanceCents],
    );

    const createdId = result.rows[0]?.id;
    if (!createdId) {
      throw new Error('Falha inesperada ao criar conta.');
    }

    const created = await this.findById(userId, createdId);
    if (!created) {
      throw new Error('Falha inesperada ao carregar conta recém-criada.');
    }

    return created;
  },

  async update(
    userId: string,
    accountId: string,
    input: UpdateAccountInput,
  ): Promise<AccountWithBalance | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    const assignField = (column: string, value: unknown) => {
      params.push(value);
      setClauses.push(`${column} = $${params.length}`);
    };

    if (input.name !== undefined) assignField('name', input.name);
    if (input.bankCode !== undefined) assignField('bank_code', input.bankCode);
    if (input.type !== undefined) assignField('type', input.type);
    if (input.initialBalanceCents !== undefined) {
      assignField('initial_balance_cents', input.initialBalanceCents);
    }
    if (input.isActive !== undefined) assignField('is_active', input.isActive);

    if (setClauses.length === 0) {
      return this.findById(userId, accountId);
    }

    params.push(accountId, userId);

    const result = await query<{ id: string }>(
      `UPDATE accounts
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING id`,
      params,
    );

    if (!result.rows[0]) {
      return null;
    }

    return this.findById(userId, accountId);
  },

  async deactivate(userId: string, accountId: string): Promise<AccountWithBalance | null> {
    const result = await query<{ id: string }>(
      `UPDATE accounts
       SET is_active = FALSE
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [accountId, userId],
    );

    if (!result.rows[0]) {
      return null;
    }

    return this.findById(userId, accountId);
  },
};
