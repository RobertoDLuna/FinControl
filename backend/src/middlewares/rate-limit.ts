import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Limitador de taxa para rotas públicas de autenticação (proteção contra brute-force).
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'production' ? 15 : 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Muitas tentativas de autenticação. Aguarde alguns minutos e tente novamente.',
      },
    });
  },
});
