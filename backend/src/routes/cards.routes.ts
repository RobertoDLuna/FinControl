import { Router } from 'express';
import { cardsController } from '../controllers/cards.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { enforceResourceLimit } from '../middlewares/plan-limits.js';
import { validate } from '../middlewares/validate.js';
import { cardsRepository } from '../repositories/cards.repository.js';
import {
  cardIdParamsSchema,
  createCardBodySchema,
  listCardsQuerySchema,
  updateCardBodySchema,
} from '../schemas/cards.schema.js';

export const cardsRoutes = Router();

cardsRoutes.use(authenticate);

cardsRoutes.get(
  '/',
  validate({ query: listCardsQuerySchema }),
  cardsController.list,
);

cardsRoutes.get(
  '/:id',
  validate({ params: cardIdParamsSchema }),
  cardsController.getById,
);

cardsRoutes.post(
  '/',
  enforceResourceLimit({
    resourceLabel: 'cartões ativos',
    limitKey: 'maxActiveCards',
    countCurrentUsage: (userId) => cardsRepository.countActiveByUser(userId),
  }),
  validate({ body: createCardBodySchema }),
  cardsController.create,
);

cardsRoutes.patch(
  '/:id',
  validate({ params: cardIdParamsSchema, body: updateCardBodySchema }),
  cardsController.update,
);

cardsRoutes.delete(
  '/:id',
  validate({ params: cardIdParamsSchema }),
  cardsController.deactivate,
);
