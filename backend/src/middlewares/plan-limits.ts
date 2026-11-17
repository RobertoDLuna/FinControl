import { RequestHandler } from 'express';
import { PlanTier } from '../types/auth.types.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export interface PlanFeatureLimits {
  maxActiveAccounts: number | null;
  maxActiveCards: number | null;
  maxMonthlyExcelExports: number | null;
  allowConsolidatedExcelExport: boolean;
}

/**
 * Tabela centralizada e desacoplada de limites por plano SaaS (LEI 04).
 * Valores `null` representam uso ilimitado.
 */
export const PLAN_LIMITS: Readonly<Record<PlanTier, PlanFeatureLimits>> = {
  FREE: {
    maxActiveAccounts: 2,
    maxActiveCards: 2,
    maxMonthlyExcelExports: 2,
    allowConsolidatedExcelExport: false,
  },
  PRO: {
    maxActiveAccounts: null,
    maxActiveCards: null,
    maxMonthlyExcelExports: null,
    allowConsolidatedExcelExport: true,
  },
};

type NumericLimitKey = 'maxActiveAccounts' | 'maxActiveCards' | 'maxMonthlyExcelExports';

interface EnforceResourceLimitOptions {
  resourceLabel: string;
  limitKey: NumericLimitKey;
  countCurrentUsage: (userId: string) => Promise<number>;
}

/**
 * Exige que o usuário autenticado possua plano PRO para acessar recursos exclusivos.
 */
export function requireProPlan(featureLabel = 'este recurso'): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError('Usuário não autenticado.'));
      return;
    }

    if (req.user.planTier !== 'PRO') {
      next(
        new ForbiddenError(
          `O plano PRO é necessário para utilizar ${featureLabel}.`,
          'PLAN_UPGRADE_REQUIRED',
        ),
      );
      return;
    }

    next();
  };
}

/**
 * Middleware genérico para validar limites quantitativos por plano antes de criar recursos.
 */
export function enforceResourceLimit(options: EnforceResourceLimitOptions): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Usuário não autenticado.');
    }

    const planLimits = PLAN_LIMITS[req.user.planTier];
    const maxAllowed = planLimits[options.limitKey];

    if (maxAllowed === null) {
      next();
      return;
    }

    const currentUsage = await options.countCurrentUsage(req.user.id);
    if (currentUsage >= maxAllowed) {
      throw new ForbiddenError(
        `Limite do plano ${req.user.planTier} atingido para ${options.resourceLabel} (máximo: ${maxAllowed}). Faça upgrade para o plano PRO para continuar.`,
        'PLAN_LIMIT_REACHED',
      );
    }

    next();
  });
}
