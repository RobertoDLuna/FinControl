import { z } from 'zod';

const categoryTypeEnum = z.enum(['INCOME', 'EXPENSE'], {
  message: 'O tipo da categoria deve ser INCOME ou EXPENSE.',
});

export const categoryIdParamsSchema = z.object({
  id: z.string().uuid('ID de categoria inválido.'),
});

export const listCategoriesQuerySchema = z.object({
  type: categoryTypeEnum.optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const createCategoryBodySchema = z.object({
  name: z
    .string({ required_error: 'O nome da categoria é obrigatório.' })
    .trim()
    .min(2, 'O nome deve ter no mínimo 2 caracteres.')
    .max(80, 'O nome deve ter no máximo 80 caracteres.'),
  type: categoryTypeEnum,
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'A cor deve estar no formato hexadecimal (#RRGGBB).')
    .nullable()
    .optional(),
  icon: z
    .string()
    .trim()
    .min(1)
    .max(50, 'O ícone deve ter no máximo 50 caracteres.')
    .nullable()
    .optional(),
});

export const updateCategoryBodySchema = createCategoryBodySchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualização.',
  });

export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
export type CreateCategoryInput = z.infer<typeof createCategoryBodySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryBodySchema>;
