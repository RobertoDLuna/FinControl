import { Request, Response } from 'express';
import { LoginInput, RegisterInput } from '../schemas/auth.schema.js';
import { authService } from '../services/auth.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { UnauthorizedError } from '../utils/errors.js';

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body as RegisterInput;
    const result = await authService.register(payload);

    res.status(201).json({
      success: true,
      data: result,
    });
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body as LoginInput;
    const result = await authService.login(payload);

    res.status(200).json({
      success: true,
      data: result,
    });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError('Usuário não autenticado.');
    }

    const user = await authService.getProfile(userId);

    res.status(200).json({
      success: true,
      data: { user },
    });
  }),
};
