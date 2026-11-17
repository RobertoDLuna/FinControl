import { z } from 'zod';

export const cardIdParamsSchema = z.object({
  id: z.string().uuid('ID de cartão inválido.'),
});

export const listCardsQuerySchema = z.object({
  accountId: z.string().uuid('ID de conta inválido.').optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

// .strict() rejeita campos extras não permitidos (ex.: número completo do cartão, CVV ou userId)
export const createCardBodySchema = z
  .object({
    accountId: z
      .string({ required_error: 'A conta vinculada é obrigatória.' })
      .uuid('ID de conta inválido.'),
    name: z
      .string({ required_error: 'O nome do cartão é obrigatório.' })
      .trim()
      .min(2, 'O nome deve ter no mínimo 2 caracteres.')
      .max(100, 'O nome deve ter no máximo 100 caracteres.'),
    brand: z
      .string()
      .trim()
      .min(2, 'A bandeira deve ter no mínimo 2 caracteres.')
      .max(40, 'A bandeira deve ter no máximo 40 caracteres.')
      .nullable()
      .optional(),
    lastFourDigits: z
      .string()
      .trim()
      .regex(/^\d{4}$/, 'Informe exatamente os 4 últimos dígitos numéricos do cartão.')
      .nullable()
      .optional(),
    creditLimitCents: z
      .number({ required_error: 'O limite do cartão é obrigatório.' })
      .int('O limite deve ser um valor inteiro em centavos.')
      .min(0, 'O limite não pode ser negativo.')
      .max(100_000_000_00, 'Valor acima do limite permitido.'),
    closingDay: z
      .number({ required_error: 'O dia de fechamento é obrigatório.' })
      .int('O dia de fechamento deve ser um número inteiro.')
      .min(1, 'O dia de fechamento deve estar entre 1 e 31.')
      .max(31, 'O dia de fechamento deve estar entre 1 e 31.'),
    dueDay: z
      .number({ required_error: 'O dia de vencimento é obrigatório.' })
      .int('O dia de vencimento deve ser um número inteiro.')
      .min(1, 'O dia de vencimento deve estar entre 1 e 31.')
      .max(31, 'O dia de vencimento deve estar entre 1 e 31.'),
  })
  .strict();

export const updateCardBodySchema = createCardBodySchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualização.',
  });

export type ListCardsQuery = z.infer<typeof listCardsQuerySchema>;
export type CreateCardInput = z.infer<typeof createCardBodySchema>;
export type UpdateCardInput = z.infer<typeof updateCardBodySchema>;
