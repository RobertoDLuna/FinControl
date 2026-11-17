import { Router } from 'express';
import { accountsRoutes } from './accounts.routes.js';
import { authRoutes } from './auth.routes.js';
import { categoriesRoutes } from './categories.routes.js';
import { healthRoutes } from './health.routes.js';

export const apiRoutes = Router();

apiRoutes.use('/health', healthRoutes);
apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/categories', categoriesRoutes);
apiRoutes.use('/accounts', accountsRoutes);
