import type { PrismaClient } from '@prisma/client';
import { QUOTA, startOfMonthDouala } from '@inbox/shared';
import type { UserRole } from '@inbox/shared';

export interface QuotaState {
  /** `null` signifie illimité (comptes PRO). */
  limit: number | null;
  used: number;
  remaining: number | null;
  resetsAt: Date;
}

/**
 * Le quota compte les annonces **passées en publication** dans le mois
 * calendaire courant, à l'heure de Douala.
 *
 * Il est calculé à partir des données, jamais tenu dans un compteur : un
 * compteur se désynchronise à la première suppression, au premier rejet, ou à
 * la première tâche planifiée qui échoue à mi-parcours.
 */
export async function getQuota(
  prisma: PrismaClient,
  userId: string,
  role: UserRole,
  now: Date,
): Promise<QuotaState> {
  const periodStart = startOfMonthDouala(now);
  const nextMonth = new Date(periodStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

  if (role === 'PRO' || role === 'ADMIN' || role === 'MODERATOR') {
    return { limit: null, used: 0, remaining: null, resetsAt: nextMonth };
  }

  // Une annonce soumise puis refusée ne doit pas consommer de quota : seules
  // celles qui ont réellement atteint la publication sont comptées.
  const used = await prisma.listing.count({
    where: {
      sellerId: userId,
      publishedAt: { gte: periodStart, lt: nextMonth },
    },
  });

  const limit = QUOTA.freeListingsPerMonth;
  return { limit, used, remaining: Math.max(0, limit - used), resetsAt: nextMonth };
}

export function quotaExhausted(state: QuotaState): boolean {
  return state.remaining !== null && state.remaining <= 0;
}
