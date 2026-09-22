import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { healthRouter } from './modules/health.js';

/**
 * Routeur de la version 1 de l'API. Les modules métier viennent s'y greffer
 * au fil des phases ; la version reste dans le chemin (`/api/v1`) pour pouvoir
 * faire évoluer les contrats sans casser les clients déjà déployés.
 */
export function apiV1Router(prisma: PrismaClient): Router {
  const router = Router();

  router.use(healthRouter(prisma));

  return router;
}
