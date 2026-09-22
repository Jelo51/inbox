import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';

/**
 * Sonde de disponibilité. `/health` reste volontairement muet sur la version
 * et la configuration : ce sont des informations utiles à un attaquant.
 */
export function healthRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/health/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  return router;
}
