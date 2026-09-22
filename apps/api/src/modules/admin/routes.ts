import { Router, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import {
  PAGINATION,
  USER_ROLES,
  USER_STATUSES,
  banUserSchema,
  changeRoleSchema,
  cursorPaginationSchema,
  idSchema,
  listReportsSchema,
  moderateListingSchema,
  resolveReportSchema,
  suspendUserSchema,
} from '@inbox/shared';
import { now } from '../../lib/clock.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import type { MailService } from '../mail/service.js';
import { moderateListing, moderationQueue, takeDownListing } from './moderation.js';
import { claimReport, listReports, reportDetail, resolveReport } from './reports.js';
import { banUser, changeRole, listUsers, suspendUser, unsuspendUser, userDetail } from './users.js';
import { dashboardStats, listPayments, revenueByMonth } from './stats.js';
import { readAudit } from './audit.js';

function handle(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

/**
 * Back-office.
 *
 * Le contrôle de rôle est appliqué **sur le routeur entier**, pas route par
 * route : un oubli sur une seule route suffirait à ouvrir la modération à
 * n'importe qui. Les actions réservées aux administrateurs ajoutent leur
 * propre garde par-dessus.
 */
export function adminRouter(prisma: PrismaClient, mail: MailService): Router {
  const router = Router();

  // Les gardes sont montés **sur le préfixe `/admin`**, pas sur le routeur nu :
  // `router.use(mw)` s'appliquerait à toute requête qui traverse ce routeur, y
  // compris celles qui ne correspondent à aucune route — une URL inconnue
  // répondrait alors 401 au lieu de 404, et tout module ajouté après celui-ci
  // hériterait silencieusement de l'authentification.
  router.use('/admin', requireAuth(prisma), requireRole('MODERATOR', 'ADMIN'));

  const deps = { prisma, mail, now };

  // ── Tableau de bord ───────────────────────────────────────────────────────

  router.get(
    '/admin/stats',
    handle(async (_req, res) => {
      res.json({ stats: await dashboardStats(prisma, now()) });
    }),
  );

  router.get(
    '/admin/stats/revenue',
    requireRole('ADMIN'),
    handle(async (_req, res) => {
      res.json({ months: await revenueByMonth(prisma, now()) });
    }),
  );

  // ── File de modération ────────────────────────────────────────────────────

  router.get(
    '/admin/moderation/queue',
    handle(async (req, res) => {
      const { limit, cursor } = cursorPaginationSchema.parse(req.query);
      res.json(await moderationQueue(prisma, { limit, cursor }));
    }),
  );

  router.post(
    '/admin/moderation/listings/:id',
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const input = moderateListingSchema.parse(req.body);

      const listing = await moderateListing(deps, id, req.auth!.userId, input, req.ip);
      res.json({ listing: { id: listing.id, status: listing.status } });
    }),
  );

  router.post(
    '/admin/moderation/listings/:id/takedown',
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const { reason } = z.object({ reason: z.string().trim().min(5).max(500) }).parse(req.body);

      const listing = await takeDownListing(deps, id, req.auth!.userId, reason, req.ip);
      res.json({ listing: { id: listing.id, status: listing.status } });
    }),
  );

  // ── Signalements ──────────────────────────────────────────────────────────

  router.get(
    '/admin/reports',
    handle(async (req, res) => {
      const query = listReportsSchema.parse(req.query);
      res.json(
        await listReports(prisma, {
          status: query.status,
          target: query.target,
          cursor: query.cursor,
          limit: query.limit,
        }),
      );
    }),
  );

  router.get(
    '/admin/reports/:id',
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      res.json({ report: await reportDetail(prisma, id) });
    }),
  );

  router.post(
    '/admin/reports/:id/claim',
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const report = await claimReport(prisma, id, req.auth!.userId);
      res.json({ report: { id: report.id, status: report.status } });
    }),
  );

  router.post(
    '/admin/reports/:id/resolve',
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const { status, note } = resolveReportSchema.parse(req.body);

      const report = await resolveReport(prisma, id, req.auth!.userId, status, note, now(), req.ip);
      res.json({ report: { id: report.id, status: report.status } });
    }),
  );

  // ── Membres ───────────────────────────────────────────────────────────────

  router.get(
    '/admin/users',
    handle(async (req, res) => {
      const query = z
        .object({
          search: z.string().trim().min(1).max(120).optional(),
          role: z.enum(USER_ROLES).optional(),
          status: z.enum(USER_STATUSES).optional(),
          cursor: z.string().max(200).optional(),
          limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(25),
        })
        .parse(req.query);

      res.json(await listUsers(prisma, query));
    }),
  );

  router.get(
    '/admin/users/:id',
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      res.json({ user: await userDetail(prisma, id) });
    }),
  );

  router.post(
    '/admin/users/:id/suspend',
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const { days, reason } = suspendUserSchema.parse(req.body);

      const user = await suspendUser(deps, id, req.auth!.userId, days, reason, req.ip);
      res.json({ user: { id: user.id, status: user.status, suspendedUntil: user.suspendedUntil } });
    }),
  );

  router.post(
    '/admin/users/:id/unsuspend',
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const user = await unsuspendUser(deps, id, req.auth!.userId, req.ip);
      res.json({ user: { id: user.id, status: user.status } });
    }),
  );

  router.post(
    '/admin/users/:id/ban',
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const { reason } = banUserSchema.parse(req.body);

      const user = await banUser(deps, id, req.auth!.userId, reason, req.ip);
      res.json({ user: { id: user.id, status: user.status } });
    }),
  );

  // Le changement de rôle est le seul acte qui peut créer un administrateur :
  // il reste réservé aux administrateurs.
  router.post(
    '/admin/users/:id/role',
    requireRole('ADMIN'),
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const { role, reason } = changeRoleSchema.parse(req.body);

      const user = await changeRole(deps, id, req.auth!.userId, role, reason, req.ip);
      res.json({ user: { id: user.id, role: user.role } });
    }),
  );

  // ── Paiements ─────────────────────────────────────────────────────────────

  router.get(
    '/admin/payments',
    requireRole('ADMIN'),
    handle(async (req, res) => {
      const { limit, cursor } = cursorPaginationSchema.parse(req.query);
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      res.json(await listPayments(prisma, { limit, cursor, status }));
    }),
  );

  // ── Journal d'audit ───────────────────────────────────────────────────────

  router.get(
    '/admin/audit',
    handle(async (req, res) => {
      const { limit, cursor } = cursorPaginationSchema.parse(req.query);

      res.json(
        await readAudit(prisma, {
          limit,
          cursor,
          actorId: typeof req.query.actorId === 'string' ? req.query.actorId : undefined,
          action: typeof req.query.action === 'string' ? req.query.action : undefined,
          targetType: typeof req.query.targetType === 'string' ? req.query.targetType : undefined,
          targetId: typeof req.query.targetId === 'string' ? req.query.targetId : undefined,
        }),
      );
    }),
  );

  return router;
}
