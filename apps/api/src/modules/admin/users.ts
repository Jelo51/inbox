import type { PrismaClient, UserStatus } from '@prisma/client';
import { addDays, maskEmail, type UserRole } from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import type { MailService } from '../mail/service.js';
import { revokeAllSessions } from '../auth/sessions.js';
import { recordAudit } from './audit.js';

export interface UserAdminDeps {
  prisma: PrismaClient;
  mail: MailService;
  now: () => Date;
}

export interface UserQuery {
  search?: string | undefined;
  role?: UserRole | undefined;
  status?: UserStatus | undefined;
  cursor?: string | undefined;
  limit: number;
}

export async function listUsers(prisma: PrismaClient, query: UserQuery) {
  const rows = await prisma.user.findMany({
    where: {
      ...(query.role && { role: query.role }),
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { email: { contains: query.search, mode: 'insensitive' as const } },
          { displayName: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
      ...(query.cursor && { createdAt: { lt: new Date(query.cursor) } }),
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      suspendedUntil: true,
      suspendedFor: true,
      bannedAt: true,
      bannedFor: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { listings: true, reportsReceived: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: query.limit + 1,
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    items: page.map((user) => ({
      id: user.id,
      // L'adresse complète n'est utile qu'au détail : la liste s'en tient à
      // une forme masquée, qu'un écran partagé ne trahit pas.
      emailMasked: maskEmail(user.email),
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerifiedAt !== null,
      suspendedUntil: user.suspendedUntil,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      listingCount: user._count.listings,
      reportCount: user._count.reportsReceived,
    })),
    nextCursor: hasMore ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
  };
}

export async function userDetail(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      status: true,
      bio: true,
      emailVerifiedAt: true,
      suspendedUntil: true,
      suspendedFor: true,
      bannedAt: true,
      bannedFor: true,
      createdAt: true,
      lastLoginAt: true,
      city: { select: { name: true } },
      _count: { select: { listings: true, reportsReceived: true, reportsMade: true } },
    },
  });

  if (!user) throw HttpError.notFound('USER_NOT_FOUND', 'Membre introuvable');

  const [listings, reports, subscription] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: userId, deletedAt: null },
      select: { id: true, slug: true, title: true, status: true, createdAt: true, price: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.report.findMany({
      where: { reportedUserId: userId },
      select: { id: true, reason: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.subscription.findFirst({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    ...user,
    listings,
    reports,
    subscription: subscription
      ? {
          status: subscription.status,
          planName: subscription.plan.nameFr,
          endsAt: subscription.endsAt,
          cancelledAt: subscription.cancelledAt,
        }
      : null,
  };
}

/**
 * Une suspension ou un bannissement ferme immédiatement toutes les sessions.
 * Sans cela, la personne resterait connectée jusqu'à l'expiration de son jeton
 * d'accès — quinze minutes pendant lesquelles la décision n'a aucun effet.
 */
export async function suspendUser(
  deps: UserAdminDeps,
  userId: string,
  moderatorId: string,
  days: number,
  reason: string,
  ip?: string,
) {
  const now = deps.now();
  const user = await deps.prisma.user.findUniqueOrThrow({ where: { id: userId } });

  assertNotStaff(user.role, 'suspendre');

  const until = addDays(now, days);

  const updated = await deps.prisma.user.update({
    where: { id: userId },
    data: { status: 'SUSPENDED', suspendedUntil: until, suspendedFor: reason },
  });

  await revokeAllSessions(deps.prisma, userId, now, 'SUSPENDED');
  await recordAudit(
    deps.prisma,
    {
      actorId: moderatorId,
      action: 'USER_SUSPENDED',
      targetType: 'User',
      targetId: userId,
      reason,
      metadata: { days, until: until.toISOString() },
      ip,
    },
    now,
  );

  await deps.mail.sendAccountSuspended(user, {
    reason,
    until: new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(until),
  });

  return updated;
}

export async function unsuspendUser(
  deps: UserAdminDeps,
  userId: string,
  moderatorId: string,
  ip?: string,
) {
  const now = deps.now();

  const updated = await deps.prisma.user.update({
    where: { id: userId },
    data: { status: 'ACTIVE', suspendedUntil: null, suspendedFor: null },
  });

  await recordAudit(
    deps.prisma,
    { actorId: moderatorId, action: 'USER_UNSUSPENDED', targetType: 'User', targetId: userId, ip },
    now,
  );

  return updated;
}

export async function banUser(
  deps: UserAdminDeps,
  userId: string,
  moderatorId: string,
  reason: string,
  ip?: string,
) {
  const now = deps.now();
  const user = await deps.prisma.user.findUniqueOrThrow({ where: { id: userId } });

  assertNotStaff(user.role, 'bannir');

  const updated = await deps.prisma.user.update({
    where: { id: userId },
    data: { status: 'BANNED', bannedAt: now, bannedFor: reason },
  });

  // Les annonces d'un compte banni sortent du site en même temps que lui.
  await deps.prisma.listing.updateMany({
    where: { sellerId: userId, status: { in: ['PUBLISHED', 'PENDING'] } },
    data: {
      status: 'REJECTED',
      publishedAt: null,
      rejectionReason: 'OTHER',
      rejectionNote: reason,
    },
  });

  await revokeAllSessions(deps.prisma, userId, now, 'BANNED');
  await recordAudit(
    deps.prisma,
    {
      actorId: moderatorId,
      action: 'USER_BANNED',
      targetType: 'User',
      targetId: userId,
      reason,
      ip,
    },
    now,
  );

  await deps.mail.sendAccountSuspended(user, { reason, until: null });

  return updated;
}

/**
 * Changement de rôle, réservé aux administrateurs. On refuse qu'un
 * administrateur se retire lui-même ses droits : c'est la façon la plus simple
 * de se retrouver sans aucun administrateur sur la plateforme.
 */
export async function changeRole(
  deps: UserAdminDeps,
  userId: string,
  adminId: string,
  role: UserRole,
  reason: string,
  ip?: string,
) {
  const now = deps.now();

  if (userId === adminId) {
    throw HttpError.badRequest('SELF_ROLE_CHANGE', 'Vous ne pouvez pas changer votre propre rôle');
  }

  const user = await deps.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role === role) {
    throw HttpError.conflict('SAME_ROLE', 'Ce membre a déjà ce rôle');
  }

  const updated = await deps.prisma.user.update({ where: { id: userId }, data: { role } });

  // Le badge Pro des annonces suit le rôle.
  await deps.prisma.listing.updateMany({
    where: { sellerId: userId },
    data: { sellerIsPro: role === 'PRO' },
  });

  await recordAudit(
    deps.prisma,
    {
      actorId: adminId,
      action: 'USER_ROLE_CHANGED',
      targetType: 'User',
      targetId: userId,
      reason,
      metadata: { from: user.role, to: role },
      ip,
    },
    now,
  );

  return updated;
}

/**
 * Un modérateur ne sanctionne pas un autre membre de l'équipe : ce serait la
 * porte ouverte à un compte compromis qui neutralise la modération.
 */
function assertNotStaff(role: UserRole, action: string): void {
  if (role === 'MODERATOR' || role === 'ADMIN') {
    throw HttpError.forbidden(
      'CANNOT_MODERATE_STAFF',
      `Impossible de ${action} un membre de l'équipe depuis cette interface`,
    );
  }
}
