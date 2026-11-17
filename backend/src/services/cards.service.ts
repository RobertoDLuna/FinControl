import { PLAN_LIMITS } from '../middlewares/plan-limits.js';
import { accountsRepository } from '../repositories/accounts.repository.js';
import { cardsRepository } from '../repositories/cards.repository.js';
import {
  CreateCardInput,
  ListCardsQuery,
  UpdateCardInput,
} from '../schemas/cards.schema.js';
import { PlanTier } from '../types/auth.types.js';
import { CardWithLimit } from '../types/finance.types.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';

export interface ListCardsResult {
  cards: CardWithLimit[];
  summary: {
    totalLimitCents: number;
    totalUsedLimitCents: number;
    totalAvailableLimitCents: number;
    activeCount: number;
  };
}

async function validateCardAccount(userId: string, accountId: string): Promise<void> {
  const account = await accountsRepository.findById(userId, accountId);

  if (!account) {
    throw new NotFoundError('Conta vinculada não encontrada.');
  }

  if (!account.isActive) {
    throw new BadRequestError('Não é possível vincular um cartão a uma conta inativa.');
  }

  if (account.type !== 'CHECKING' && account.type !== 'CREDIT_CARD') {
    throw new BadRequestError(
      'O cartão deve estar vinculado a uma conta do tipo CHECKING ou CREDIT_CARD.',
    );
  }
}

export const cardsService = {
  async list(userId: string, filters: ListCardsQuery): Promise<ListCardsResult> {
    const cards = await cardsRepository.listByUser(userId, filters);
    const activeCards = cards.filter((card) => card.isActive);

    const totalLimitCents = activeCards.reduce(
      (sum, card) => sum + card.creditLimitCents,
      0,
    );
    const totalUsedLimitCents = activeCards.reduce(
      (sum, card) => sum + card.usedLimitCents,
      0,
    );

    return {
      cards,
      summary: {
        totalLimitCents,
        totalUsedLimitCents,
        totalAvailableLimitCents: totalLimitCents - totalUsedLimitCents,
        activeCount: activeCards.length,
      },
    };
  },

  async getById(userId: string, cardId: string): Promise<CardWithLimit> {
    const card = await cardsRepository.findById(userId, cardId);
    if (!card) {
      throw new NotFoundError('Cartão não encontrado.');
    }
    return card;
  },

  async create(userId: string, input: CreateCardInput): Promise<CardWithLimit> {
    await validateCardAccount(userId, input.accountId);
    return cardsRepository.create(userId, input);
  },

  async update(
    userId: string,
    planTier: PlanTier,
    cardId: string,
    input: UpdateCardInput,
  ): Promise<CardWithLimit> {
    const existing = await cardsRepository.findById(userId, cardId);
    if (!existing) {
      throw new NotFoundError('Cartão não encontrado.');
    }

    if (input.accountId !== undefined && input.accountId !== existing.accountId) {
      await validateCardAccount(userId, input.accountId);
    }

    // Impede burlar o limite do plano ao reativar um cartão inativo
    if (input.isActive === true && !existing.isActive) {
      const maxCards = PLAN_LIMITS[planTier].maxActiveCards;
      if (maxCards !== null) {
        const activeCount = await cardsRepository.countActiveByUser(userId);
        if (activeCount >= maxCards) {
          throw new ForbiddenError(
            `Limite do plano ${planTier} atingido para cartões ativos (máximo: ${maxCards}). Faça upgrade para o plano PRO para continuar.`,
            'PLAN_LIMIT_REACHED',
          );
        }
      }
    }

    const updated = await cardsRepository.update(userId, cardId, input);
    if (!updated) {
      throw new NotFoundError('Cartão não encontrado.');
    }

    return updated;
  },

  async deactivate(userId: string, cardId: string): Promise<CardWithLimit> {
    const deactivated = await cardsRepository.deactivate(userId, cardId);
    if (!deactivated) {
      throw new NotFoundError('Cartão não encontrado.');
    }
    return deactivated;
  },
};
