import { Request, Response } from 'express';
import {
  CreateAccountInput,
  ListAccountsQuery,
  UpdateAccountInput,
} from '../schemas/accounts.schema.js';
import { accountsService } from '../services/accounts.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { getAuthenticatedUserId } from '../utils/auth-user.js';
import { UnauthorizedError } from '../utils/errors.js';

export const accountsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const filters = req.query as unknown as ListAccountsQuery;
    const result = await accountsService.list(userId, filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const accountId = String(req.params.id);
    const account = await accountsService.getById(userId, accountId);

    res.status(200).json({
      success: true,
      data: { account },
    });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const payload = req.body as CreateAccountInput;
    const account = await accountsService.create(userId, payload);

    res.status(201).json({
      success: true,
      data: { account },
    });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    if (!req.user) {
      throw new UnauthorizedError('Usuário não autenticado.');
    }
    const accountId = String(req.params.id);
    const payload = req.body as UpdateAccountInput;
    const account = await accountsService.update(
      userId,
      req.user.planTier,
      accountId,
      payload,
    );

    res.status(200).json({
      success: true,
      data: { account },
    });
  }),

  deactivate: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const accountId = String(req.params.id);
    const account = await accountsService.deactivate(userId, accountId);

    res.status(200).json({
      success: true,
      data: { account },
    });
  }),
};
