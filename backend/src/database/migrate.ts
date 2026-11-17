import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  closeDatabasePool,
  formatDatabaseError,
  query,
  withTransaction,
} from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

interface MigrationRow {
  version: string;
}

/**
 * Garante a existência da tabela de controle de migrations aplicadas.
 */
async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

/**
 * Retorna a lista de versões já executadas no banco de dados.
 */
async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await query<MigrationRow>('SELECT version FROM schema_migrations');
  return new Set(result.rows.map((row) => row.version));
}

/**
 * Executa todas as migrations SQL pendentes em ordem alfabética,
 * garantindo atomicidade por arquivo via transação PostgreSQL.
 */
async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });
  const sqlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const pendingFiles = sqlFiles.filter((fileName) => !applied.has(fileName));

  if (pendingFiles.length === 0) {
    console.log('[Migrate] Nenhuma migration pendente.');
    return;
  }

  for (const fileName of pendingFiles) {
    const filePath = path.join(MIGRATIONS_DIR, fileName);
    const sql = await fs.readFile(filePath, 'utf8');

    console.log(`[Migrate] Aplicando ${fileName}...`);

    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [fileName]);
    });

    console.log(`[Migrate] ${fileName} aplicada com sucesso.`);
  }
}

runMigrations()
  .catch((error: unknown) => {
    console.error('[Migrate] Erro ao executar migrations:', formatDatabaseError(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabasePool();
  });
