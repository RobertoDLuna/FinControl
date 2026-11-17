import { Request, Response } from 'express';
import {
  CreateCardInput,
  ListCardsQuery,
  UpdateCardInput,
} from '../schemas/cards.schema.js';
import { cardsService } from '../services/cards.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { getAuthenticatedUserId } from '../utils/auth-user.js';
import { UnauthorizedError } from '../utils/errors.js';

export const cardsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const filters = req.query as unknown as ListCardsQuery;
    const result = await cardsService.list(userId, filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const cardId = String(req.params.id);
    const card = await cardsService.getById(userId, cardId);

    res.status(200).json({
      success: true,
      data: { card },
    });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const payload = req.body as CreateCardInput;
    const card = await cardsService.create(userId, payload);

    res.status(201).json({
      success: true,
      data: { card },
    });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    if (!req.user) {
      throw new UnauthorizedError('Usuário não autenticado.');
    }

    const cardId = String(req.params.id);
    const payload = req.body as UpdateCardInput;
    const card = await cardsService.update(
      userId,
      req.user.planTier,
      cardId,
      payload,
    );

    res.status(200).json({
      success: true,
      data: { card },
    });
  }),

  deactivate: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const cardId = String(req.params.id);
    const card = await cardsService.deactivate(userId, cardId);

    res.status(200).json({
      success: true,
      data: { card },
    });
  }),
};
