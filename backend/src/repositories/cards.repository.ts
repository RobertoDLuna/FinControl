import { query } from '../database/connection.js';
import {
  CreateCardInput,
  ListCardsQuery,
  UpdateCardInput,
} from '../schemas/cards.schema.js';
import { CardWithLimit } from '../types/finance.types.js';

interface DbCardWithLimitRow {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  brand: string | null;
  last_four_digits: string | null;
  credit_limit_cents: string | number;
  used_limit_cents: string | number;
  closing_day: number;
  due_day: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const CARD_WITH_LIMIT_SELECT = `
  SELECT
    c.id,
    c.user_id,
    c.account_id,
    c.name,
    c.brand,
    c.last_four_digits,
    c.credit_limit_cents,
    (
      COALESCE((
        SELECT SUM(i.amount_cents)
        FROM installments i
        WHERE i.card_id = c.id
          AND i.user_id = c.user_id
          AND i.status = 'PENDING'
      ), 0)
      +
      COALESCE((
        SELECT SUM(t.total_amount_cents)
        FROM transactions t
        WHERE t.card_id = c.id
          AND t.user_id = c.user_id
          AND t.is_installment = FALSE
          AND t.type = 'EXPENSE'
          AND t.status = 'PENDING'
      ), 0)
    ) AS used_limit_cents,
    c.closing_day,
    c.due_day,
    c.is_active,
    c.created_at,
    c.updated_at
  FROM cards c
`;

function mapCardWithLimit(row: DbCardWithLimitRow): CardWithLimit {
  const creditLimitCents = Number(row.credit_limit_cents);
  const usedLimitCents = Number(row.used_limit_cents);

  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    name: row.name,
    brand: row.brand,
    lastFourDigits: row.last_four_digits ? row.last_four_digits.trim() : null,
    creditLimitCents,
    usedLimitCents,
    availableLimitCents: creditLimitCents - usedLimitCents,
    closingDay: Number(row.closing_day),
    dueDay: Number(row.due_day),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const cardsRepository = {
  async countActiveByUser(userId: string): Promise<number> {
    const result = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM cards
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );

    return Number(result.rows[0]?.total ?? 0);
  },

  async listByUser(userId: string, filters: ListCardsQuery): Promise<CardWithLimit[]> {
    const conditions: string[] = ['c.user_id = $1'];
    const params: unknown[] = [userId];

    if (!filters.includeInactive) {
      conditions.push('c.is_active = TRUE');
    }

    if (filters.accountId) {
      params.push(filters.accountId);
      conditions.push(`c.account_id = $${params.length}`);
    }

    const result = await query<DbCardWithLimitRow>(
      `${CARD_WITH_LIMIT_SELECT}
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.is_active DESC, c.name ASC`,
      params,
    );

    return result.rows.map(mapCardWithLimit);
  },

  async findById(userId: string, cardId: string): Promise<CardWithLimit | null> {
    const result = await query<DbCardWithLimitRow>(
      `${CARD_WITH_LIMIT_SELECT}
       WHERE c.id = $1 AND c.user_id = $2
       LIMIT 1`,
      [cardId, userId],
    );

    const row = result.rows[0];
    return row ? mapCardWithLimit(row) : null;
  },

  async create(userId: string, input: CreateCardInput): Promise<CardWithLimit> {
    const result = await query<{ id: string }>(
      `INSERT INTO cards (
         user_id,
         account_id,
         name,
         brand,
         last_four_digits,
         credit_limit_cents,
         closing_day,
         due_day
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        userId,
        input.accountId,
        input.name,
        input.brand ?? null,
        input.lastFourDigits ?? null,
        input.creditLimitCents,
        input.closingDay,
        input.dueDay,
      ],
    );

    const createdId = result.rows[0]?.id;
    if (!createdId) {
      throw new Error('Falha inesperada ao criar cartão.');
    }

    const created = await this.findById(userId, createdId);
    if (!created) {
      throw new Error('Falha inesperada ao carregar cartão recém-criado.');
    }

    return created;
  },

  async update(
    userId: string,
    cardId: string,
    input: UpdateCardInput,
  ): Promise<CardWithLimit | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    const assignField = (column: string, value: unknown) => {
      params.push(value);
      setClauses.push(`${column} = $${params.length}`);
    };

    if (input.accountId !== undefined) assignField('account_id', input.accountId);
    if (input.name !== undefined) assignField('name', input.name);
    if (input.brand !== undefined) assignField('brand', input.brand);
    if (input.lastFourDigits !== undefined) {
      assignField('last_four_digits', input.lastFourDigits);
    }
    if (input.creditLimitCents !== undefined) {
      assignField('credit_limit_cents', input.creditLimitCents);
    }
    if (input.closingDay !== undefined) assignField('closing_day', input.closingDay);
    if (input.dueDay !== undefined) assignField('due_day', input.dueDay);
    if (input.isActive !== undefined) assignField('is_active', input.isActive);

    if (setClauses.length === 0) {
      return this.findById(userId, cardId);
    }

    params.push(cardId, userId);

    const result = await query<{ id: string }>(
      `UPDATE cards
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING id`,
      params,
    );

    if (!result.rows[0]) {
      return null;
    }

    return this.findById(userId, cardId);
  },

  async deactivate(userId: string, cardId: string): Promise<CardWithLimit | null> {
    const result = await query<{ id: string }>(
      `UPDATE cards
       SET is_active = FALSE
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [cardId, userId],
    );

    if (!result.rows[0]) {
      return null;
    }

    return this.findById(userId, cardId);
  },
};
