import type { Prisma, PrismaClient } from '@prisma/client';
import { truncateIp, type AuditAction } from '@inbox/shared';

/**
 * Journal d'audit des actions de modération.
 *
 * La table est en écriture seule : un déclencheur PostgreSQL refuse tout
 * `UPDATE` et n'autorise `DELETE` qu'au-delà de la durée de conservation. Un
 * journal qu'on peut réécrire ne prouve rien — c'est la base qui le garantit,
 * pas la discipline du code.
 */

export interface AuditEntry {
  actorId: string;
  action: AuditAction;
  targetType: 'Listing' | 'User' | 'Report' | 'LegalDocument';
  targetId: string;
  /** Obligatoire pour les décisions défavorables : refus, suspension, bannissement. */
  reason?: string | undefined;
  metadata?: Prisma.InputJsonValue | undefined;
  ip?: string | undefined;
}

export async function recordAudit(
  prisma: PrismaClient,
  entry: AuditEntry,
  now: Date,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      reason: entry.reason ?? null,
      // Le détail de la décision est conservé tel quel : c'est ce qui permet
      // de reconstituer une affaire des mois plus tard.
      ...(entry.metadata !== undefined && { metadata: entry.metadata }),
      ipPrefix: truncateIp(entry.ip),
      createdAt: now,
    },
  });
}

export interface AuditQuery {
  actorId?: string | undefined;
  action?: string | undefined;
  targetType?: string | undefined;
  targetId?: string | undefined;
  cursor?: string | undefined;
  limit: number;
}

export async function readAudit(prisma: PrismaClient, query: AuditQuery) {
  const entries = await prisma.auditLog.findMany({
    where: {
      ...(query.actorId && { actorId: query.actorId }),
      ...(query.action && { action: query.action }),
      ...(query.targetType && { targetType: query.targetType }),
      ...(query.targetId && { targetId: query.targetId }),
      ...(query.cursor && { createdAt: { lt: new Date(query.cursor) } }),
    },
    include: { actor: { select: { id: true, displayName: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: query.limit + 1,
  });

  const hasMore = entries.length > query.limit;
  const page = hasMore ? entries.slice(0, query.limit) : entries;

  return {
    items: page.map((entry) => ({
      id: entry.id,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      reason: entry.reason,
      metadata: entry.metadata,
      createdAt: entry.createdAt,
      actor: entry.actor
        ? { id: entry.actor.id, displayName: entry.actor.displayName, role: entry.actor.role }
        : null,
    })),
    nextCursor: hasMore ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
  };
}
