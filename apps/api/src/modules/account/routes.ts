import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { RATE_LIMITS, consentSchema, deleteAccountSchema } from '@inbox/shared';
import { now } from '../../lib/clock.js';
import { requireAuth } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import { HttpError } from '../../lib/http-error.js';
import { assertCsrf, clearRefreshCookie } from '../auth/cookies.js';
import { verifyPassword } from '../auth/password.js';
import type { ImageStorage } from '../images/storage.js';
import type { Logger } from '../../lib/logger.js';
import { exportAccountData } from './export.js';
import { anonymizeAccount } from './deletion.js';
import { consentRequired, currentConsent, recordConsent } from './consent.js';

function handle(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

/**
 * Compte : export des données et suppression, plus le consentement aux
 * traceurs — qui n'exige pas de compte, et vit donc ici sans authentification.
 */
export function accountRouter(prisma: PrismaClient, storage: ImageStorage, logger: Logger): Router {
  const router = Router();
  const authenticated = requireAuth(prisma);

  router.get(
    '/account/export',
    authenticated,
    createRateLimiter('dataExport', RATE_LIMITS.dataExport, { byUser: true }),
    handle(async (req, res) => {
      const instant = now();
      const data = await exportAccountData(prisma, req.auth!.userId, instant);

      // Le navigateur doit proposer un enregistrement plutôt que d'afficher
      // quelques mégaoctets de JSON.
      const stamp = instant.toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="inbox-donnees-${stamp}.json"`);
      res.send(JSON.stringify(data, null, 2));
    }),
  );

  router.post(
    '/account/delete',
    authenticated,
    handle(async (req, res) => {
      assertCsrf(req);
      const { password } = deleteAccountSchema.parse(req.body);

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: req.auth!.userId },
        select: { id: true, passwordHash: true, role: true },
      });

      if (!(await verifyPassword(user.passwordHash, password))) {
        throw HttpError.forbidden('INVALID_PASSWORD', 'Mot de passe incorrect');
      }

      // Un administrateur qui supprime son propre compte peut laisser le site
      // sans personne pour l'administrer. La sortie passe par un pair.
      if (user.role === 'ADMIN') {
        throw new HttpError(
          409,
          'ADMIN_SELF_DELETE',
          'Un administrateur ne peut pas supprimer son propre compte : ' +
            'faites-le rétrograder par un autre administrateur au préalable.',
        );
      }

      const report = await anonymizeAccount({ prisma, storage, logger }, user.id, now());
      clearRefreshCookie(res);
      res.json({ deleted: report });
    }),
  );

  // ── Consentement aux traceurs ─────────────────────────────────────────────

  router.get(
    '/consent',
    handle(async (req, res) => {
      res.json({
        required: consentRequired(),
        consent: await currentConsent(prisma, req, now()),
      });
    }),
  );

  router.post(
    '/consent',
    handle(async (req, res) => {
      const input = consentSchema.parse(req.body);
      res.json({ consent: await recordConsent(prisma, req, res, input, now()) });
    }),
  );

  return router;
}
