import { Router } from 'express';
import { categoriesController } from '../controllers/categories.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import {
  categoryIdParamsSchema,
  createCategoryBodySchema,
  listCategoriesQuerySchema,
  updateCategoryBodySchema,
} from '../schemas/categories.schema.js';

export const categoriesRoutes = Router();

categoriesRoutes.use(authenticate);

categoriesRoutes.get(
  '/',
  validate({ query: listCategoriesQuerySchema }),
  categoriesController.list,
);

categoriesRoutes.get(
  '/:id',
  validate({ params: categoryIdParamsSchema }),
  categoriesController.getById,
);

categoriesRoutes.post(
  '/',
  validate({ body: createCategoryBodySchema }),
  categoriesController.create,
);

categoriesRoutes.patch(
  '/:id',
  validate({ params: categoryIdParamsSchema, body: updateCategoryBodySchema }),
  categoriesController.update,
);

categoriesRoutes.delete(
  '/:id',
  validate({ params: categoryIdParamsSchema }),
  categoriesController.deactivate,
);
