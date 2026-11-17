import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { apiRoutes } from './routes/index.js';
import { ForbiddenError } from './utils/errors.js';

/**
 * Cria e configura a instância da aplicação Express desacoplada da porta TCP.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Permite chamadas sem cabeçalho Origin (ex.: health checks, curl, clientes server-to-server)
        if (!origin) {
          callback(null, true);
          return;
        }

        if (env.CORS_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new ForbiddenError('Origem não permitida pela política de CORS.'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
