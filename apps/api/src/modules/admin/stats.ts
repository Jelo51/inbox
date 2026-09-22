import type { Prisma, PrismaClient } from '@prisma/client';
import { addDays } from '@inbox/shared';

/**
 * Statistiques du tableau de bord.
 *
 * Tout est agrégé en base plutôt que chargé puis compté en mémoire : ces
 * requêtes tournent à chaque ouverture du tableau de bord, et la table des
 * annonces grossit indéfiniment.
 */

export interface DashboardStats {
  users: { total: number; verified: number; pro: number; newLast30Days: number };
  listings: { byStatus: Record<string, number>; publishedLast30Days: number };
  byCategory: { slug: string; nameFr: string; count: number }[];
  byCity: { slug: string; name: string; count: number }[];
  moderation: { pending: number; flagged: number; openReports: number };
  revenue: { last30DaysXaf: number; totalXaf: number; activeSubscriptions: number };
  registrationsByDay: { day: string; count: number }[];
}

export async function dashboardStats(prisma: PrismaClient, now: Date): Promise<DashboardStats> {
  const since30 = addDays(now, -30);

  const [
    userTotal,
    userVerified,
    userPro,
    userNew,
    listingsByStatus,
    publishedRecent,
    byCategory,
    byCity,
    pending,
    flagged,
    openReports,
    revenueRecent,
    revenueTotal,
    activeSubscriptions,
    registrations,
  ] = await Promise.all([
    prisma.user.count({ where: { status: { not: 'DELETED' } } }),
    prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
    prisma.user.count({ where: { role: 'PRO' } }),
    prisma.user.count({ where: { createdAt: { gte: since30 } } }),

    prisma.listing.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.listing.count({ where: { publishedAt: { gte: since30 } } }),

    prisma.$queryRaw<{ slug: string; nameFr: string; count: bigint }[]>`
      SELECT c."slug", c."nameFr", count(l."id") AS count
      FROM "Category" c
      LEFT JOIN "Listing" l ON l."categoryId" = c."id" AND l."status" = 'PUBLISHED'
      GROUP BY c."slug", c."nameFr", c."position"
      ORDER BY c."position" ASC
    `,

    prisma.$queryRaw<{ slug: string; name: string; count: bigint }[]>`
      SELECT ci."slug", ci."name", count(l."id") AS count
      FROM "City" ci
      LEFT JOIN "Listing" l ON l."cityId" = ci."id" AND l."status" = 'PUBLISHED'
      GROUP BY ci."slug", ci."name"
      ORDER BY count(l."id") DESC, ci."name" ASC
    `,

    prisma.listing.count({ where: { status: 'PENDING', deletedAt: null } }),
    prisma.listing.count({
      where: { status: 'PENDING', deletedAt: null, moderationFlags: { some: {} } },
    }),
    prisma.report.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),

    prisma.payment.aggregate({
      where: { status: 'SUCCEEDED', paidAt: { gte: since30 } },
      _sum: { amountXaf: true },
    }),
    prisma.payment.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amountXaf: true } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', endsAt: { gt: now } } }),

    prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, count(*) AS count
      FROM "User"
      WHERE "createdAt" >= ${since30}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ]);

  return {
    users: { total: userTotal, verified: userVerified, pro: userPro, newLast30Days: userNew },
    listings: {
      byStatus: Object.fromEntries(listingsByStatus.map((row) => [row.status, row._count._all])),
      publishedLast30Days: publishedRecent,
    },
    byCategory: byCategory.map((row) => ({
      slug: row.slug,
      nameFr: row.nameFr,
      count: Number(row.count),
    })),
    byCity: byCity.map((row) => ({ slug: row.slug, name: row.name, count: Number(row.count) })),
    moderation: { pending, flagged, openReports },
    revenue: {
      last30DaysXaf: revenueRecent._sum.amountXaf ?? 0,
      totalXaf: revenueTotal._sum.amountXaf ?? 0,
      activeSubscriptions,
    },
    registrationsByDay: registrations.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      count: Number(row.count),
    })),
  };
}

/** Revenus mensuels de l'abonnement, sur douze mois glissants. */
export async function revenueByMonth(prisma: PrismaClient, now: Date) {
  const since = addDays(now, -365);

  const rows = await prisma.$queryRaw<{ month: Date; total: bigint; payments: bigint }[]>`
    SELECT date_trunc('month', "paidAt") AS month,
           sum("amountXaf") AS total,
           count(*) AS payments
    FROM "Payment"
    WHERE "status" = 'SUCCEEDED' AND "paidAt" >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return rows.map((row) => ({
    month: row.month.toISOString().slice(0, 7),
    totalXaf: Number(row.total),
    payments: Number(row.payments),
  }));
}

/** Liste des paiements, pour le suivi administratif. */
export async function listPayments(
  prisma: PrismaClient,
  options: { limit: number; cursor?: string | undefined; status?: string | undefined },
) {
  const rows = await prisma.payment.findMany({
    where: {
      ...(options.status && { status: options.status as Prisma.EnumPaymentStatusFilter['equals'] }),
      ...(options.cursor && { createdAt: { lt: new Date(options.cursor) } }),
    },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
      receipt: { select: { number: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: options.limit + 1,
  });

  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;

  return {
    items: page.map((payment) => ({
      id: payment.id,
      reference: payment.reference,
      amountXaf: payment.amountXaf,
      provider: payment.provider,
      method: payment.method,
      status: payment.status,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      receiptNumber: payment.receipt?.number ?? null,
      user: payment.user,
    })),
    nextCursor: hasMore ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
  };
}
