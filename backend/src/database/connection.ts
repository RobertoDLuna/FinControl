import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env.js';

const sslConfig: PoolConfig['ssl'] = env.DB_SSL
  ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED }
  : false;

const basePoolConfig: PoolConfig = {
  ssl: sslConfig,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
  statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
};

const poolConfig: PoolConfig = env.DATABASE_URL
  ? {
      ...basePoolConfig,
      connectionString: env.DATABASE_URL,
    }
  : {
      ...basePoolConfig,
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    };

/**
 * Pool global de conexões com o PostgreSQL.
 * Utilize os helpers `query` ou `withTransaction` nos repositórios
 * para garantir consultas parametrizadas ($1, $2...) e liberação segura de clientes.
 */
export const pool = new Pool(poolConfig);

pool.on('error', (error: Error) => {
  // Evita expor metadados internos de conexão em produção
  const details = env.NODE_ENV === 'production' ? error.message : error;
  console.error('[Database] Erro inesperado em cliente ocioso do PostgreSQL:', details);
});

/**
 * Executa uma consulta SQL parametrizada contra o pool de conexões.
 * Nunca concatene valores de entrada na string SQL — passe-os sempre em `params`.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, [...params]);

  if (env.NODE_ENV === 'development') {
    const durationMs = Date.now() - start;
    if (durationMs > 250) {
      // Nunca logar `text` ou `params` para evitar vazamento de dados financeiros/credenciais
      console.warn(`[Database] Query lenta detectada (${durationMs}ms):`, {
        rowCount: result.rowCount,
      });
    }
  }

  return result;
}

/**
 * Obtém um cliente dedicado do pool para operações manuais.
 * O chamador é responsável por invocar `client.release()` em bloco `finally`.
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Executa múltiplas operações de forma atômica dentro de uma transação PostgreSQL.
 * Realiza COMMIT em caso de sucesso e ROLLBACK automático em caso de erro.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      const details =
        env.NODE_ENV === 'production' && rollbackError instanceof Error
          ? rollbackError.message
          : rollbackError;
      console.error('[Database] Falha ao executar ROLLBACK da transação:', details);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verifica a conectividade com o banco de dados PostgreSQL.
 */
export async function testDatabaseConnection(): Promise<void> {
  await pool.query('SELECT 1');
}

/**
 * Encerra graciosamente todas as conexões ativas do pool.
 */
export async function closeDatabasePool(): Promise<void> {
  await pool.end();
}

/**
 * Formata erros de banco (incluindo AggregateError de driver TCP/pg) sem vazar segredos.
 */
export function formatDatabaseError(error: unknown): string {
  if (error instanceof AggregateError && error.errors.length > 0) {
    return error.errors.map((innerError) => formatDatabaseError(innerError)).join(' | ');
  }

  if (error instanceof Error) {
    const pgCode =
      'code' in error && typeof error.code === 'string' && error.code.length > 0
        ? ` (${error.code})`
        : '';
    return `${error.message || error.name}${pgCode}`;
  }

  return String(error);
}
