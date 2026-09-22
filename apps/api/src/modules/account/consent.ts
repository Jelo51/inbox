import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { RETENTION_DAYS, addDays, truncateIp, type ConsentInput } from '@inbox/shared';
import { env } from '../../config/env.js';

export const VISITOR_COOKIE = 'inbox_visitor';

/**
 * Consentement aux traceurs.
 *
 * La mesure d'audience retenue — Umami auto-hébergé — ne pose aucun cookie et
 * ne conserve pas d'identifiant : elle n'exige donc pas de consentement, et
 * afficher une bannière à son sujet serait à la fois inutile et trompeur. La
 * bannière ne s'affiche que si un traceur qui, lui, en exige un est configuré.
 *
 * Le modèle et la route existent malgré tout : le jour où un tel traceur est
 * ajouté, il ne doit pas falloir écrire la conformité dans l'urgence.
 */
export function consentRequired(): boolean {
  return env().ANALYTICS_REQUIRES_CONSENT;
}

/**
 * Identifiant de visiteur, pour rattacher un consentement à quelqu'un qui n'a
 * pas de compte. C'est un cookie strictement nécessaire : il n'existe que pour
 * se souvenir d'un choix, et n'est posé qu'au moment où ce choix est fait.
 */
function visitorId(req: Request, res: Response): string {
  const existing = (req.cookies as Record<string, unknown> | undefined)?.[VISITOR_COOKIE];
  if (typeof existing === 'string' && existing.length > 0) return existing;

  const fresh = randomUUID();
  res.cookie(VISITOR_COOKIE, fresh, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env().NODE_ENV === 'production',
    maxAge: RETENTION_DAYS.consentValidity * 24 * 60 * 60 * 1000,
    path: '/',
  });
  return fresh;
}

export async function recordConsent(
  prisma: PrismaClient,
  req: Request,
  res: Response,
  input: ConsentInput,
  at: Date,
): Promise<{ analytics: boolean; expiresAt: Date }> {
  const userId = req.auth?.userId;
  const expiresAt = addDays(at, RETENTION_DAYS.consentValidity);

  // Un consentement ne se modifie pas : chaque choix est une ligne de plus. On
  // doit pouvoir montrer ce qui a été accepté, et quand — y compris un refus
  // qui a suivi une acceptation.
  await prisma.consentRecord.create({
    data: {
      userId: userId ?? null,
      visitorId: userId ? null : visitorId(req, res),
      analytics: input.analytics,
      policyVersion: input.policyVersion,
      ipPrefix: truncateIp(req.ip),
      createdAt: at,
      expiresAt,
    },
  });

  return { analytics: input.analytics, expiresAt };
}

export async function currentConsent(
  prisma: PrismaClient,
  req: Request,
  at: Date,
): Promise<{ analytics: boolean; policyVersion: string; expiresAt: Date } | null> {
  const userId = req.auth?.userId;
  const visitor = (req.cookies as Record<string, unknown> | undefined)?.[VISITOR_COOKIE];

  const where = userId
    ? { userId }
    : typeof visitor === 'string' && visitor.length > 0
      ? { visitorId: visitor }
      : null;

  if (!where) return null;

  const record = await prisma.consentRecord.findFirst({
    where: { ...where, expiresAt: { gt: at } },
    orderBy: { createdAt: 'desc' },
    select: { analytics: true, policyVersion: true, expiresAt: true },
  });

  return record;
}
