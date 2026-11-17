import { z } from 'zod';

export const ACCOUNT_TYPES = [
  'CHECKING',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'CASH',
  'INVESTMENT',
] as const;

export const BANK_CODES = [
  'NUBANK',
  'INTER',
  'ITAU',
  'BRADESCO',
  'SANTANDER',
  'CAIXA',
  'BANCO_DO_BRASIL',
  'CASH',
  'OTHER',
] as const;

const accountTypeEnum = z.enum(ACCOUNT_TYPES, {
  message:
    'Tipo de conta inválido. Valores aceitos: CHECKING, CREDIT_CARD, DEBIT_CARD, CASH, INVESTMENT.',
});

const bankCodeEnum = z.enum(BANK_CODES, {
  message:
    'Banco inválido. Valores aceitos: NUBANK, INTER, ITAU, BRADESCO, SANTANDER, CAIXA, BANCO_DO_BRASIL, CASH, OTHER.',
});

export const accountIdParamsSchema = z.object({
  id: z.string().uuid('ID de conta inválido.'),
});

export const listAccountsQuerySchema = z.object({
  type: accountTypeEnum.optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const createAccountBodySchema = z.object({
  name: z
    .string({ required_error: 'O nome da conta é obrigatório.' })
    .trim()
    .min(2, 'O nome deve ter no mínimo 2 caracteres.')
    .max(100, 'O nome deve ter no máximo 100 caracteres.'),
  bankCode: bankCodeEnum.default('OTHER'),
  type: accountTypeEnum,
  initialBalanceCents: z
    .number({ invalid_type_error: 'O saldo inicial deve ser um número inteiro em centavos.' })
    .int('O saldo inicial deve ser um valor inteiro em centavos.')
    .min(-100_000_000_00, 'Valor abaixo do limite permitido.')
    .max(100_000_000_00, 'Valor acima do limite permitido.')
    .default(0),
});

export const updateAccountBodySchema = createAccountBodySchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualização.',
  });

export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;
export type CreateAccountInput = z.infer<typeof createAccountBodySchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountBodySchema>;
