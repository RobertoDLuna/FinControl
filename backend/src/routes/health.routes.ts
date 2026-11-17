import { Router } from 'express';
import { formatDatabaseError, testDatabaseConnection } from '../database/connection.js';

export const healthRoutes = Router();

/**
 * GET /api/health
 * Verifica disponibilidade da API e conectividade ativa com o PostgreSQL.
 */
healthRoutes.get('/', async (_req, res) => {
  const timestamp = new Date().toISOString();

  try {
    await testDatabaseConnection();

    res.status(200).json({
      success: true,
      status: 'ok',
      database: 'connected',
      timestamp,
    });
  } catch (error: unknown) {
    console.error('[Health] Falha ao verificar PostgreSQL:', formatDatabaseError(error));

    res.status(503).json({
      success: false,
      status: 'degraded',
      database: 'disconnected',
      timestamp,
    });
  }
});
