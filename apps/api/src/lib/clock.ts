import { systemClock, type Clock } from '@inbox/shared';

/**
 * Unique point de lecture de l'heure côté API. Une règle ESLint interdit
 * `new Date()` ailleurs : sans cela, les comportements liés au temps
 * (expiration de jeton, quota mensuel, purges) ne seraient pas testables.
 */
let current: Clock = systemClock;

export function now(): Date {
  return current.now();
}

/** Réservé aux tests : fige l'horloge. */
export function setClock(clock: Clock): void {
  current = clock;
}

export function resetClock(): void {
  current = systemClock;
}
