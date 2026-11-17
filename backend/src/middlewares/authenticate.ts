import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { usersRepository } from '../repositories/users.repository.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) {
    throw new UnauthorizedError('Token de autenticação não fornecido.', 'MISSING_TOKEN');
  }

  const parts = authorizationHeader.trim().split(/\s+/);
  const scheme = parts[0];
  const token = parts[1];

  if (parts.length !== 2 || !scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    throw new UnauthorizedError('Formato do cabeçalho Authorization inválido.', 'INVALID_AUTH_HEADER');
  }

  return token;
}

/**
 * Middleware de autenticação JWT obrigatória para rotas protegidas.
 * Extrai o user_id exclusivamente do token validado no servidor e confirma o status no banco.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);

  let subjectId: string;

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      typeof decoded.sub !== 'string' ||
      !UUID_REGEX.test(decoded.sub)
    ) {
      throw new UnauthorizedError('Token de autenticação inválido.', 'INVALID_TOKEN');
    }

    subjectId = decoded.sub;
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Sessão expirada. Faça login novamente.', 'TOKEN_EXPIRED');
    }

    throw new UnauthorizedError('Token de autenticação inválido.', 'INVALID_TOKEN');
  }

  const user = await usersRepository.findPublicById(subjectId);

  if (!user) {
    throw new UnauthorizedError('Usuário da sessão não encontrado.', 'INVALID_TOKEN');
  }

  if (!user.isActive) {
    throw new ForbiddenError('Conta desativada. Entre em contato com o suporte.', 'ACCOUNT_INACTIVE');
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    planTier: user.planTier,
  };

  next();
});
