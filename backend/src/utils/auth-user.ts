import { Request } from 'express';
import { UnauthorizedError } from './errors.js';

/**
 * Extrai o ID do usuário autenticado de `req.user` (garantido pelo middleware `authenticate`).
 */
export function getAuthenticatedUserId(req: Request): string {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError('Usuário não autenticado.');
  }
  return userId;
}
