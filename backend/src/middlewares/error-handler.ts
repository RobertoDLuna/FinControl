import { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError, NotFoundError } from '../utils/errors.js';

interface PostgresErrorLike {
  code?: string;
}

const PG_ERROR_MAP: Readonly<
  Record<string, { statusCode: number; code: string; message: string }>
> = {
  '23505': {
    statusCode: 409,
    code: 'RESOURCE_ALREADY_EXISTS',
    message: 'Já existe um registro com os dados informados.',
  },
  '23503': {
    statusCode: 400,
    code: 'INVALID_REFERENCE',
    message: 'O recurso referenciado não existe ou não pertence ao usuário.',
  },
  '22P02': {
    statusCode: 400,
    code: 'INVALID_IDENTIFIER',
    message: 'Formato de identificador ou dado inválido.',
  },
  '23514': {
    statusCode: 400,
    code: 'CONSTRAINT_VIOLATION',
    message: 'Os dados informados violam uma regra de integridade.',
  },
};

function isJsonSyntaxError(error: unknown): error is SyntaxError & { status?: number } {
  return (
    error instanceof SyntaxError &&
    'status' in error &&
    (error as { status?: number }).status === 400
  );
}

/**
 * Intercepta requisições para rotas inexistentes na API.
 */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Rota não encontrada: ${req.method} ${req.originalUrl}`));
};

/**
 * Middleware centralizado de tratamento de erros HTTP.
 * Garante padronização das respostas e ocultação de detalhes internos em produção.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      field: issue.path.join('.') || 'payload',
      message: issue.message,
    }));

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados de entrada inválidos.',
        details,
      },
    });
    return;
  }

  if (isJsonSyntaxError(error)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Corpo da requisição possui JSON malformado.',
      },
    });
    return;
  }

  const pgCode =
    typeof error === 'object' && error !== null
      ? (error as PostgresErrorLike).code
      : undefined;

  if (pgCode && pgCode in PG_ERROR_MAP) {
    const mapped = PG_ERROR_MAP[pgCode];
    if (mapped) {
      res.status(mapped.statusCode).json({
        success: false,
        error: {
          code: mapped.code,
          message: mapped.message,
        },
      });
      return;
    }
  }

  const logPayload =
    env.NODE_ENV === 'production' && error instanceof Error
      ? error.message
      : error;
  console.error('[HTTP] Erro interno não tratado:', logPayload);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'Erro interno do servidor.'
          : error instanceof Error
            ? error.message
            : 'Erro interno do servidor.',
    },
  });
};
