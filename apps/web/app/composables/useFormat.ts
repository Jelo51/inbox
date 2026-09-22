import { formatPrice, formatPriceWithUnit, type PriceUnit } from '@inbox/shared';

/**
 * Formatage réutilisable. Les montants passent par `@inbox/shared` : le front
 * et l'API partagent la même définition d'un prix en francs CFA.
 */
export function useFormat() {
  const { locale } = useI18n();

  const intlLocale = computed(() => (locale.value === 'en' ? 'en-GB' : 'fr-FR'));

  function price(amount: number, unit: PriceUnit = 'NONE'): string {
    return unit === 'NONE'
      ? formatPrice(amount)
      : formatPriceWithUnit(amount, unit, locale.value === 'en' ? 'en' : 'fr');
  }

  function date(value: string | Date): string {
    return new Intl.DateTimeFormat(intlLocale.value, { dateStyle: 'long' }).format(
      typeof value === 'string' ? new Date(value) : value,
    );
  }

  function monthYear(value: string | Date): string {
    return new Intl.DateTimeFormat(intlLocale.value, { month: 'long', year: 'numeric' }).format(
      typeof value === 'string' ? new Date(value) : value,
    );
  }

  function number(value: number): string {
    return new Intl.NumberFormat(intlLocale.value).format(value);
  }

  return { price, date, monthYear, number };
}
