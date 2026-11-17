import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import {
  closeDatabasePool,
  formatDatabaseError,
  testDatabaseConnection,
} from './database/connection.js';

let server: http.Server | undefined;
let isShuttingDown = false;

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log(`[Server] Sinal ${signal} recebido. Iniciando encerramento gracioso...`);

  const forceExitTimer = setTimeout(() => {
    console.error('[Server] Tempo limite de encerramento excedido. Forçando saída.');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    }

    await closeDatabasePool();
    clearTimeout(forceExitTimer);
    console.log('[Server] Servidor HTTP e pool do PostgreSQL encerrados com sucesso.');
    process.exit(exitCode);
  } catch (error: unknown) {
    console.error('[Server] Erro durante encerramento gracioso:', formatDatabaseError(error));
    process.exit(1);
  }
}

async function bootstrap(): Promise<void> {
  try {
    await testDatabaseConnection();
    console.log('[Database] Conexão com PostgreSQL verificada.');
  } catch (error: unknown) {
    console.error(
      '[Server] Falha ao conectar ao PostgreSQL na inicialização:',
      formatDatabaseError(error),
    );
    await closeDatabasePool().catch(() => undefined);
    process.exit(1);
  }

  const app = createApp();

  server = app.listen(env.PORT, () => {
    console.log(`[Server] FinControl API rodando na porta ${env.PORT} (${env.NODE_ENV}).`);
  });

  server.on('error', (error: Error) => {
    console.error('[Server] Erro no servidor HTTP:', error.message);
    void shutdown('SERVER_ERROR', 1);
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT', 0);
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM', 0);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[Process] Unhandled Rejection:', formatDatabaseError(reason));
  void shutdown('UNHANDLED_REJECTION', 1);
});

process.on('uncaughtException', (error: Error) => {
  console.error('[Process] Uncaught Exception:', error.message);
  void shutdown('UNCAUGHT_EXCEPTION', 1);
});

void bootstrap();
