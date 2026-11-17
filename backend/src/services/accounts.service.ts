import { PLAN_LIMITS } from '../middlewares/plan-limits.js';
import { accountsRepository } from '../repositories/accounts.repository.js';
import {
  CreateAccountInput,
  ListAccountsQuery,
  UpdateAccountInput,
} from '../schemas/accounts.schema.js';
import { PlanTier } from '../types/auth.types.js';
import { AccountWithBalance } from '../types/finance.types.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

export interface ListAccountsResult {
  accounts: AccountWithBalance[];
  summary: {
    totalActiveBalanceCents: number;
    activeCount: number;
  };
}

export const accountsService = {
  async list(userId: string, filters: ListAccountsQuery): Promise<ListAccountsResult> {
    const accounts = await accountsRepository.listByUser(userId, filters);

    const activeAccounts = accounts.filter((account) => account.isActive);
    const totalActiveBalanceCents = activeAccounts.reduce(
      (sum, account) => sum + account.currentBalanceCents,
      0,
    );

    return {
      accounts,
      summary: {
        totalActiveBalanceCents,
        activeCount: activeAccounts.length,
      },
    };
  },

  async getById(userId: string, accountId: string): Promise<AccountWithBalance> {
    const account = await accountsRepository.findById(userId, accountId);
    if (!account) {
      throw new NotFoundError('Conta não encontrada.');
    }
    return account;
  },

  async create(userId: string, input: CreateAccountInput): Promise<AccountWithBalance> {
    return accountsRepository.create(userId, input);
  },

  async update(
    userId: string,
    planTier: PlanTier,
    accountId: string,
    input: UpdateAccountInput,
  ): Promise<AccountWithBalance> {
    const existing = await accountsRepository.findById(userId, accountId);
    if (!existing) {
      throw new NotFoundError('Conta não encontrada.');
    }

    // Impede burlar o limite do plano ao reativar uma conta inativa
    if (input.isActive === true && !existing.isActive) {
      const maxAccounts = PLAN_LIMITS[planTier].maxActiveAccounts;
      if (maxAccounts !== null) {
        const activeCount = await accountsRepository.countActiveByUser(userId);
        if (activeCount >= maxAccounts) {
          throw new ForbiddenError(
            `Limite do plano ${planTier} atingido para contas ativas (máximo: ${maxAccounts}). Faça upgrade para o plano PRO para continuar.`,
            'PLAN_LIMIT_REACHED',
          );
        }
      }
    }

    const updated = await accountsRepository.update(userId, accountId, input);
    if (!updated) {
      throw new NotFoundError('Conta não encontrada.');
    }

    return updated;
  },

  async deactivate(userId: string, accountId: string): Promise<AccountWithBalance> {
    const deactivated = await accountsRepository.deactivate(userId, accountId);
    if (!deactivated) {
      throw new NotFoundError('Conta não encontrada.');
    }
    return deactivated;
  },
};
