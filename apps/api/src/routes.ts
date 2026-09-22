import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { healthRouter } from './modules/health.js';
import { authRouter } from './modules/auth/routes.js';
import { legalRouter } from './modules/legal/routes.js';
import { listingRouter } from './modules/listings/routes.js';
import { imageRouter, multerErrorHandler } from './modules/images/routes.js';
import { messagingRouter } from './modules/messaging/routes.js';
import { billingRouter } from './modules/billing/routes.js';
import { adminRouter } from './modules/admin/routes.js';
import type { BillingDeps } from './modules/billing/service.js';
import type { MailService } from './modules/mail/service.js';
import type { ImageStorage } from './modules/images/storage.js';
import type { RealtimeHub } from './modules/messaging/realtime.js';

/**
 * Routeur de la version 1 de l'API. Les modules métier viennent s'y greffer
 * au fil des phases ; la version reste dans le chemin (`/api/v1`) pour pouvoir
 * faire évoluer les contrats sans casser les clients déjà déployés.
 */
export function apiV1Router(
  prisma: PrismaClient,
  mail: MailService,
  storage: ImageStorage,
  hub: RealtimeHub,
  billing: BillingDeps,
): Router {
  const router = Router();

  router.use(healthRouter(prisma));
  router.use(legalRouter(prisma));
  router.use(authRouter(prisma, mail));
  router.use(listingRouter(prisma, storage));
  router.use(imageRouter(prisma, storage));
  router.use(messagingRouter(prisma, hub));
  router.use(billingRouter(prisma, billing));
  router.use(adminRouter(prisma, mail));

  // Les erreurs de multer arrivent avant le gestionnaire global : elles ont
  // leur propre forme, qu'il faut traduire.
  router.use(multerErrorHandler);

  return router;
}
