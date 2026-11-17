import 'dotenv/config';
import { z } from 'zod';

const booleanFromEnv = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const postgresUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
    'DATABASE_URL deve utilizar o protocolo postgresql:// ou postgres://.',
  );

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3333),

    DATABASE_URL: postgresUrlSchema.optional().or(z.literal('')),
    DB_HOST: z.string().min(1).default('localhost'),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_NAME: z.string().min(1).default('fincontrol'),
    DB_USER: z.string().min(1).default('postgres'),
    DB_PASSWORD: z.string().default(''),
    DB_SSL: booleanFromEnv,
    DB_SSL_REJECT_UNAUTHORIZED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),
    DB_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
    DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(500).default(5000),
    DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(10000),
  })
  .superRefine((data, ctx) => {
    const databaseUrl = data.DATABASE_URL?.trim() ?? '';
    const hasDatabaseUrl = databaseUrl.length > 0;

    if (data.NODE_ENV === 'production') {
      if (!hasDatabaseUrl && (!data.DB_PASSWORD || data.DB_PASSWORD === 'CHANGE_ME')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DB_PASSWORD'],
          message: 'DB_PASSWORD válida ou DATABASE_URL é obrigatória em produção.',
        });
      }

      if (hasDatabaseUrl && databaseUrl.includes('CHANGE_ME')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DATABASE_URL'],
          message: 'DATABASE_URL em produção não pode conter o placeholder CHANGE_ME.',
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  throw new Error('Falha ao carregar e validar as variáveis de ambiente.');
}

export const env = Object.freeze({
  ...parsed.data,
  DATABASE_URL:
    parsed.data.DATABASE_URL && parsed.data.DATABASE_URL.trim().length > 0
      ? parsed.data.DATABASE_URL.trim()
      : undefined,
});
