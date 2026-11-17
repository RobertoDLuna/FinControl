import { Router } from 'express';
import { accountsController } from '../controllers/accounts.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { enforceResourceLimit } from '../middlewares/plan-limits.js';
import { validate } from '../middlewares/validate.js';
import { accountsRepository } from '../repositories/accounts.repository.js';
import {
  accountIdParamsSchema,
  createAccountBodySchema,
  listAccountsQuerySchema,
  updateAccountBodySchema,
} from '../schemas/accounts.schema.js';

export const accountsRoutes = Router();

accountsRoutes.use(authenticate);

accountsRoutes.get(
  '/',
  validate({ query: listAccountsQuerySchema }),
  accountsController.list,
);

accountsRoutes.get(
  '/:id',
  validate({ params: accountIdParamsSchema }),
  accountsController.getById,
);

accountsRoutes.post(
  '/',
  enforceResourceLimit({
    resourceLabel: 'contas ativas',
    limitKey: 'maxActiveAccounts',
    countCurrentUsage: (userId) => accountsRepository.countActiveByUser(userId),
  }),
  validate({ body: createAccountBodySchema }),
  accountsController.create,
);

accountsRoutes.patch(
  '/:id',
  validate({ params: accountIdParamsSchema, body: updateAccountBodySchema }),
  accountsController.update,
);

accountsRoutes.delete(
  '/:id',
  validate({ params: accountIdParamsSchema }),
  accountsController.deactivate,
);
