/**
 * Toutes les lectures d'horloge passent par ici : une règle ESLint interdit
 * `new Date()` ailleurs, pour que les tests puissent figer le temps.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export function fixedClock(instant: Date | string): Clock {
  const frozen = instant instanceof Date ? instant : new Date(instant);
  return { now: () => new Date(frozen.getTime()) };
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

/**
 * Début du mois calendaire courant à Douala (UTC+1, sans heure d'été),
 * exprimé en UTC. Sert au calcul du quota mensuel d'annonces.
 */
export function startOfMonthDouala(instant: Date): Date {
  const doualaOffsetMs = 60 * 60 * 1000;
  const local = new Date(instant.getTime() + doualaOffsetMs);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 0, 0, 0, 0);
  return new Date(startLocal - doualaOffsetMs);
}
