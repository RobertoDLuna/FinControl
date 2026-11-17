import {
  closeDatabasePool,
  formatDatabaseError,
  testDatabaseConnection,
} from './connection.js';

/**
 * Verifica rapidamente a conectividade com o PostgreSQL utilizando as variáveis de ambiente.
 */
async function checkConnection(): Promise<void> {
  await testDatabaseConnection();
  console.log('[Database] Conexão com PostgreSQL validada com sucesso.');
}

checkConnection()
  .catch((error: unknown) => {
    console.error('[Database] Falha na conexão com PostgreSQL:', formatDatabaseError(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabasePool();
  });
