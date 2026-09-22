import { randomUUID } from 'node:crypto';
import type { PrismaClient, Session } from '@prisma/client';
import { AUTH_LIMITS, addSeconds, truncateIp } from '@inbox/shared';
import { generateOpaqueToken, hashToken } from './tokens.js';

export interface SessionContext {
  userAgent?: string | undefined;
  ip?: string | undefined;
}

export interface IssuedRefreshToken {
  token: string;
  session: Session;
}

/**
 * Crée une session et son jeton de rafraîchissement. `familyId` identifie la
 * chaîne de rotation : tous les jetons issus d'une même connexion la partagent.
 */
export async function createSession(
  prisma: PrismaClient,
  userId: string,
  now: Date,
  context: SessionContext = {},
  familyId = randomUUID(),
): Promise<IssuedRefreshToken> {
  const token = generateOpaqueToken();

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      familyId,
      userAgent: context.userAgent?.slice(0, 255) ?? null,
      ipPrefix: truncateIp(context.ip),
      expiresAt: addSeconds(now, AUTH_LIMITS.refreshTokenTtlSeconds),
      createdAt: now,
      lastUsedAt: now,
    },
  });

  return { token, session };
}

export type RotationResult =
  | { outcome: 'ROTATED'; token: string; session: Session }
  | { outcome: 'UNKNOWN' }
  | { outcome: 'EXPIRED' }
  /**
   * Un jeton déjà consommé est présenté une seconde fois : soit il a été volé,
   * soit la copie légitime a été rejouée. Dans les deux cas on ne peut pas
   * distinguer le voleur du propriétaire, donc toute la chaîne tombe.
   */
  | { outcome: 'REUSE_DETECTED'; userId: string };

/**
 * Rotation du jeton de rafraîchissement : l'ancien est révoqué et un nouveau
 * est émis dans la même chaîne. Un jeton n'est donc jamais valable deux fois.
 */
export async function rotateSession(
  prisma: PrismaClient,
  presentedToken: string,
  now: Date,
  context: SessionContext = {},
): Promise<RotationResult> {
  const existing = await prisma.session.findUnique({
    where: { tokenHash: hashToken(presentedToken) },
  });

  if (!existing) return { outcome: 'UNKNOWN' };

  if (existing.revokedAt) {
    await revokeFamily(prisma, existing.familyId, now, 'REUSE_DETECTED');
    return { outcome: 'REUSE_DETECTED', userId: existing.userId };
  }

  if (existing.expiresAt <= now) {
    return { outcome: 'EXPIRED' };
  }

  const issued = await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: existing.id },
      data: { revokedAt: now, revokedBy: 'ROTATION', lastUsedAt: now },
    });

    const token = generateOpaqueToken();
    const session = await tx.session.create({
      data: {
        userId: existing.userId,
        tokenHash: hashToken(token),
        familyId: existing.familyId,
        userAgent: context.userAgent?.slice(0, 255) ?? existing.userAgent,
        ipPrefix: truncateIp(context.ip) ?? existing.ipPrefix,
        // La rotation ne prolonge pas indéfiniment la session : la nouvelle
        // hérite de l'échéance de la chaîne.
        expiresAt: existing.expiresAt,
        createdAt: now,
        lastUsedAt: now,
      },
    });

    return { token, session };
  });

  return { outcome: 'ROTATED', ...issued };
}

export async function revokeFamily(
  prisma: PrismaClient,
  familyId: string,
  now: Date,
  reason: string,
): Promise<number> {
  const result = await prisma.session.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: now, revokedBy: reason },
  });
  return result.count;
}

export async function revokeSessionByToken(
  prisma: PrismaClient,
  token: string,
  now: Date,
): Promise<boolean> {
  const result = await prisma.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: now, revokedBy: 'LOGOUT' },
  });
  return result.count > 0;
}

/** Déconnexion de tous les appareils : changement de mot de passe, vol suspecté. */
export async function revokeAllSessions(
  prisma: PrismaClient,
  userId: string,
  now: Date,
  reason: string,
): Promise<number> {
  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now, revokedBy: reason },
  });
  return result.count;
}

export async function isSessionActive(
  prisma: PrismaClient,
  sessionId: string,
  now: Date,
): Promise<boolean> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { revokedAt: true, expiresAt: true },
  });
  return Boolean(session && !session.revokedAt && session.expiresAt > now);
}
