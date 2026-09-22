import type { Locale } from '../constants/enums.js';
import type { PriceUnit } from '../constants/enums.js';

export const CURRENCY = 'FCFA' as const;

/**
 * Le franc CFA n'a pas de sous-unité : les montants sont des entiers.
 * Le séparateur de milliers est l'espace insécable étroit, comme en `fr-FR`.
 */
export function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) throw new TypeError('Montant non fini');
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Math.round(amount));
}

export function formatPrice(amount: number): string {
  return `${formatAmount(amount)} ${CURRENCY}`;
}

const PRICE_UNIT_SUFFIX: Record<PriceUnit, Record<Locale, string>> = {
  NONE: { fr: '', en: '' },
  PER_MONTH: { fr: '/mois', en: '/month' },
  PER_DAY: { fr: '/jour', en: '/day' },
  PER_HOUR: { fr: '/heure', en: '/hour' },
  PER_SESSION: { fr: '/séance', en: '/session' },
};

export function formatPriceWithUnit(
  amount: number,
  unit: PriceUnit = 'NONE',
  locale: Locale = 'fr',
): string {
  const suffix = PRICE_UNIT_SUFFIX[unit][locale];
  return suffix ? `${formatPrice(amount)} ${suffix}` : formatPrice(amount);
}
