import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { AUTH_LIMITS } from '@inbox/shared';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/http-error.js';

export const REFRESH_COOKIE = 'inbox_refresh';
export const CSRF_COOKIE = 'inbox_csrf';
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Le cookie de rafraîchissement est limité au chemin des routes
 * d'authentification : il n'est donc pas joint aux requêtes ordinaires, ce qui
 * réduit d'autant sa surface d'exposition.
 */
const REFRESH_PATH = '/api/v1/auth';

function baseCookieOptions(): CookieOptions {
  const config = env();
  return {
    httpOnly: true,
    secure: config.isProduction,
    // `Lax` laisse passer la navigation depuis un lien externe, mais pas les
    // requêtes croisées déclenchées par un site tiers.
    sameSite: 'lax',
    domain: config.COOKIE_DOMAIN,
    path: REFRESH_PATH,
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...baseCookieOptions(),
    maxAge: AUTH_LIMITS.refreshTokenTtlSeconds * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions());
}

export function readRefreshCookie(req: Request): string | null {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Protection CSRF par double soumission. Le jeton est posé dans un cookie
 * lisible par le script, et doit être renvoyé dans un en-tête : un site tiers
 * peut provoquer l'envoi du cookie, mais ne peut pas lire sa valeur pour
 * reconstituer l'en-tête.
 *
 * La valeur est signée avec un secret serveur, sinon un sous-domaine
 * compromis pourrait poser un cookie de son choix et fabriquer une paire
 * cohérente.
 */
function signCsrf(value: string): string {
  return createHmac('sha256', env().CSRF_SECRET).update(value).digest('base64url');
}

export function issueCsrfToken(res: Response): string {
  const value = randomBytes(24).toString('base64url');
  const token = `${value}.${signCsrf(value)}`;

  res.cookie(CSRF_COOKIE, token, {
    // Lisible par le script du front : c'est le principe de la double soumission.
    httpOnly: false,
    secure: env().isProduction,
    sameSite: 'lax',
    domain: env().COOKIE_DOMAIN,
    path: '/',
    maxAge: AUTH_LIMITS.refreshTokenTtlSeconds * 1000,
  });

  return token;
}

function isWellFormed(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  const [value, signature] = token.split('.');
  if (!value || !signature) return false;

  const expected = Buffer.from(signCsrf(value));
  const provided = Buffer.from(signature);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

/**
 * À appliquer sur toute route qui s'appuie sur le cookie de rafraîchissement.
 * Sans cela, un site tiers pourrait déclencher un renouvellement de session à
 * l'insu de l'utilisateur.
 */
export function assertCsrf(req: Request): void {
  const cookie = (req.cookies as Record<string, unknown> | undefined)?.[CSRF_COOKIE];
  const header = req.get(CSRF_HEADER);

  if (!isWellFormed(cookie) || !header) {
    throw HttpError.forbidden('CSRF_INVALID', 'Jeton anti-CSRF manquant ou invalide');
  }

  const a = Buffer.from(cookie);
  const b = Buffer.from(header);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw HttpError.forbidden('CSRF_INVALID', 'Jeton anti-CSRF manquant ou invalide');
  }
}
