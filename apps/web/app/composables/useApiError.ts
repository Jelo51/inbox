import { ApiError } from '~/composables/useApiClient';

/**
 * Traduit une erreur de l'API en message affichable. Le code renvoyé par le
 * serveur est stable ; le message qu'il porte sert de repli quand aucune
 * traduction n'existe encore pour ce code.
 */
export function useApiError() {
  const { t, te } = useI18n();

  function message(error: unknown): string {
    if (!(error instanceof ApiError)) return t('auth.errors.generic');

    const key = `auth.errors.${error.code}`;
    if (te(key)) return t(key);
    return error.message || t('auth.errors.generic');
  }

  function fieldError(error: unknown, field: string): string | null {
    return error instanceof ApiError ? error.fieldError(field) : null;
  }

  return { message, fieldError };
}
