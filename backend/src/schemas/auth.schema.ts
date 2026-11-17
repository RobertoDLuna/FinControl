import { z } from 'zod';

export const registerBodySchema = z.object({
  name: z
    .string({ required_error: 'O nome é obrigatório.' })
    .trim()
    .min(2, 'O nome deve ter no mínimo 2 caracteres.')
    .max(120, 'O nome deve ter no máximo 120 caracteres.'),
  email: z
    .string({ required_error: 'O e-mail é obrigatório.' })
    .trim()
    .email('Informe um e-mail válido.')
    .max(255, 'O e-mail deve ter no máximo 255 caracteres.')
    .transform((value) => value.toLowerCase()),
  password: z
    .string({ required_error: 'A senha é obrigatória.' })
    .min(8, 'A senha deve ter no mínimo 8 caracteres.')
    .max(128, 'A senha deve ter no máximo 128 caracteres.')
    .refine(
      (value) => /[a-zA-Z]/.test(value) && /\d/.test(value),
      'A senha deve conter pelo menos uma letra e um número.',
    ),
});

export const loginBodySchema = z.object({
  email: z
    .string({ required_error: 'O e-mail é obrigatório.' })
    .trim()
    .email('Informe um e-mail válido.')
    .max(255, 'O e-mail deve ter no máximo 255 caracteres.')
    .transform((value) => value.toLowerCase()),
  password: z
    .string({ required_error: 'A senha é obrigatória.' })
    .min(1, 'A senha é obrigatória.')
    .max(128, 'A senha deve ter no máximo 128 caracteres.'),
});

export type RegisterInput = z.infer<typeof registerBodySchema>;
export type LoginInput = z.infer<typeof loginBodySchema>;
