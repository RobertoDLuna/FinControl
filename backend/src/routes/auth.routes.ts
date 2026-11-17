import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authRateLimiter } from '../middlewares/rate-limit.js';
import { validate } from '../middlewares/validate.js';
import { loginBodySchema, registerBodySchema } from '../schemas/auth.schema.js';

export const authRoutes = Router();

authRoutes.post(
  '/register',
  authRateLimiter,
  validate({ body: registerBodySchema }),
  authController.register,
);

authRoutes.post(
  '/login',
  authRateLimiter,
  validate({ body: loginBodySchema }),
  authController.login,
);

authRoutes.get('/me', authenticate, authController.me);
