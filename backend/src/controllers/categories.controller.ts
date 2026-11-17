import { Request, Response } from 'express';
import {
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from '../schemas/categories.schema.js';
import { categoriesService } from '../services/categories.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { getAuthenticatedUserId } from '../utils/auth-user.js';

export const categoriesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const filters = req.query as unknown as ListCategoriesQuery;
    const categories = await categoriesService.list(userId, filters);

    res.status(200).json({
      success: true,
      data: { categories },
    });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const categoryId = String(req.params.id);
    const category = await categoriesService.getById(userId, categoryId);

    res.status(200).json({
      success: true,
      data: { category },
    });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const payload = req.body as CreateCategoryInput;
    const category = await categoriesService.create(userId, payload);

    res.status(201).json({
      success: true,
      data: { category },
    });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const categoryId = String(req.params.id);
    const payload = req.body as UpdateCategoryInput;
    const category = await categoriesService.update(userId, categoryId, payload);

    res.status(200).json({
      success: true,
      data: { category },
    });
  }),

  deactivate: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const categoryId = String(req.params.id);
    const category = await categoriesService.deactivate(userId, categoryId);

    res.status(200).json({
      success: true,
      data: { category },
    });
  }),
};
