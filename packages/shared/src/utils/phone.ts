/**
 * Numéros camerounais. Les mobiles sont à 9 chiffres et commencent par 6
 * (indicatif pays +237). Le numéro n'est jamais affiché en clair sans action
 * explicite de l'utilisateur, tracée et limitée en fréquence.
 */

const CM_MOBILE = /^6\d{8}$/;

/** Retire tout sauf les chiffres, puis l'indicatif pays s'il est présent. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const national = digits.startsWith('237') ? digits.slice(3) : digits;
  return CM_MOBILE.test(national) ? national : null;
}

export function isValidCameroonMobile(input: string): boolean {
  return normalizePhone(input) !== null;
}

/** `+237 6XX XX XX XX` */
export function formatPhone(input: string): string | null {
  const n = normalizePhone(input);
  if (!n) return null;
  return `+237 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
}

/** Aperçu affichable sans consentement : `+237 6XX XX XX 89`. */
export function maskPhone(input: string): string | null {
  const n = normalizePhone(input);
  if (!n) return null;
  return `+237 ${n.slice(0, 1)}•• •• •• ${n.slice(7, 9)}`;
}
