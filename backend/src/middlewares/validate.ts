import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodTypeAny } from 'zod';
import { ValidationError } from '../utils/errors.js';

interface ValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

interface ValidationIssueDetail {
  location: 'body' | 'params' | 'query';
  field: string;
  message: string;
}

/**
 * Valida body, params e query da requisição usando schemas Zod antes de atingir o controller.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const details: ValidationIssueDetail[] = [];

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        for (const issue of result.error.issues) {
          details.push({
            location: 'params',
            field: issue.path.join('.') || 'params',
            message: issue.message,
          });
        }
      } else {
        Object.assign(req.params, result.data);
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        for (const issue of result.error.issues) {
          details.push({
            location: 'query',
            field: issue.path.join('.') || 'query',
            message: issue.message,
          });
        }
      } else {
        Object.assign(req.query, result.data);
      }
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        for (const issue of result.error.issues) {
          details.push({
            location: 'body',
            field: issue.path.join('.') || 'body',
            message: issue.message,
          });
        }
      } else {
        req.body = result.data;
      }
    }

    if (details.length > 0) {
      next(new ValidationError('Dados de entrada inválidos.', details));
      return;
    }

    next();
  };
}
