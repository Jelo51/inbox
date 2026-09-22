import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import {
  RATE_LIMITS,
  acceptLegalSchema,
  changeEmailSchema,
  changePasswordSchema,
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import { requireAuth } from '../../middleware/auth.js';
import type { MailService } from '../mail/service.js';
import { requiredAcceptances } from '../legal/documents.js';
import {
  assertCsrf,
  clearRefreshCookie,
  issueCsrfToken,
  readRefreshCookie,
  setRefreshCookie,
} from './cookies.js';
import { revokeAllSessions, revokeSessionByToken } from './sessions.js';
import * as auth from './service.js';
import { now } from '../../lib/clock.js';

/** Enveloppe une route asynchrone pour que ses rejets partent vers le gestionnaire d'erreurs. */
function handle(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

function sessionContext(req: Request) {
  return { userAgent: req.get('user-agent'), ip: req.ip };
}

export function authRouter(prisma: PrismaClient, mail: MailService): Router {
  const router = Router();
  const deps: auth.AuthDeps = { prisma, mail, now };
  const authenticated = requireAuth(prisma);

  /** Réponse commune : le jeton de rafraîchissement part en cookie, jamais en JSON. */
  function respondWithSession(res: Response, result: auth.AuthResult) {
    setRefreshCookie(res, result.refreshToken);
    const csrfToken = issueCsrfToken(res);
    res.json({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      csrfToken,
      pendingLegalAcceptances: result.pendingLegalAcceptances,
    });
  }

  // Versions des documents à accepter : le formulaire d'inscription les lit
  // avant de s'afficher, et les renvoie telles quelles.
  router.get(
    '/auth/legal-versions',
    handle(async (_req, res) => {
      const documents = await requiredAcceptances(prisma, now());
      res.json({
        versions: Object.fromEntries(documents.map((d) => [d.type, d.version])),
        documents: documents.map((d) => ({
          type: d.type,
          version: d.version,
          title: d.title,
          effectiveAt: d.effectiveAt,
        })),
      });
    }),
  );

  router.post(
    '/auth/register',
    createRateLimiter('register', RATE_LIMITS.register),
    handle(async (req, res) => {
      const input = registerSchema.parse(req.body);
      const result = await auth.register(deps, input, sessionContext(req));
      res.status(201);
      respondWithSession(res, result);
    }),
  );

  router.post(
    '/auth/login',
    createRateLimiter('login', RATE_LIMITS.login),
    handle(async (req, res) => {
      const { email, password } = loginSchema.parse(req.body);
      const result = await auth.login(deps, email, password, sessionContext(req));
      respondWithSession(res, result);
    }),
  );

  // Le cookie de rafraîchissement suffit à identifier l'appelant : cette route
  // est donc protégée contre le CSRF, sans quoi un site tiers pourrait
  // renouveler une session à l'insu de l'utilisateur.
  router.post(
    '/auth/refresh',
    handle(async (req, res) => {
      assertCsrf(req);
      const token = readRefreshCookie(req);
      if (!token) throw HttpError.unauthorized('NO_SESSION', 'Aucune session à renouveler');

      try {
        const result = await auth.refresh(deps, token, sessionContext(req));
        respondWithSession(res, result);
      } catch (err) {
        clearRefreshCookie(res);
        throw err;
      }
    }),
  );

  router.post(
    '/auth/logout',
    handle(async (req, res) => {
      assertCsrf(req);
      const token = readRefreshCookie(req);
      if (token) await revokeSessionByToken(prisma, token, now());
      clearRefreshCookie(res);
      res.json({ ok: true });
    }),
  );

  router.post(
    '/auth/logout-all',
    authenticated,
    handle(async (req, res) => {
      assertCsrf(req);
      await revokeAllSessions(prisma, req.auth!.userId, now(), 'LOGOUT_ALL');
      clearRefreshCookie(res);
      res.json({ ok: true });
    }),
  );

  router.post(
    '/auth/verify-email',
    handle(async (req, res) => {
      const { token } = verifyEmailSchema.parse(req.body);
      const user = await auth.verifyEmail(deps, token);
      res.json({ user });
    }),
  );

  router.post(
    '/auth/verify-email/resend',
    authenticated,
    createRateLimiter('emailVerificationResend', RATE_LIMITS.emailVerificationResend, {
      byUser: true,
    }),
    handle(async (req, res) => {
      await auth.resendVerification(deps, req.auth!.userId);
      res.json({ ok: true });
    }),
  );

  router.post(
    '/auth/password/forgot',
    createRateLimiter('passwordReset', RATE_LIMITS.passwordReset),
    handle(async (req, res) => {
      const { email } = requestPasswordResetSchema.parse(req.body);
      await auth.requestPasswordReset(deps, email);
      // Réponse identique que l'adresse existe ou non.
      res.json({ ok: true });
    }),
  );

  router.post(
    '/auth/password/reset',
    createRateLimiter('passwordReset', RATE_LIMITS.passwordReset),
    handle(async (req, res) => {
      const { token, password } = resetPasswordSchema.parse(req.body);
      await auth.resetPassword(deps, token, password);
      clearRefreshCookie(res);
      res.json({ ok: true });
    }),
  );

  router.post(
    '/auth/password/change',
    authenticated,
    handle(async (req, res) => {
      assertCsrf(req);
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const { refreshToken } = await auth.changePassword(
        deps,
        req.auth!.userId,
        currentPassword,
        newPassword,
        sessionContext(req),
      );
      setRefreshCookie(res, refreshToken);
      res.json({ ok: true });
    }),
  );

  router.post(
    '/auth/email/change',
    authenticated,
    handle(async (req, res) => {
      const { newEmail, currentPassword } = changeEmailSchema.parse(req.body);
      await auth.requestEmailChange(deps, req.auth!.userId, newEmail, currentPassword);
      res.json({ ok: true });
    }),
  );

  router.post(
    '/auth/email/confirm',
    handle(async (req, res) => {
      const { token } = verifyEmailSchema.parse(req.body);
      const user = await auth.confirmEmailChange(deps, token);
      res.json({ user });
    }),
  );

  router.post(
    '/auth/legal/accept',
    authenticated,
    handle(async (req, res) => {
      acceptLegalSchema.partial().parse(req.body ?? {});
      await auth.acceptPendingLegal(deps, req.auth!.userId, sessionContext(req));
      res.json({ ok: true });
    }),
  );

  router.get(
    '/auth/me',
    authenticated,
    handle(async (req, res) => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId } });
      res.json({ user: auth.toPublicUser(user) });
    }),
  );

  // Appareils connectés, pour que l'utilisateur puisse constater une intrusion.
  router.get(
    '/auth/sessions',
    authenticated,
    handle(async (req, res) => {
      const sessions = await prisma.session.findMany({
        where: { userId: req.auth!.userId, revokedAt: null, expiresAt: { gt: now() } },
        select: {
          id: true,
          userAgent: true,
          ipPrefix: true,
          createdAt: true,
          lastUsedAt: true,
        },
        orderBy: { lastUsedAt: 'desc' },
      });
      res.json({ sessions });
    }),
  );

  return router;
}
