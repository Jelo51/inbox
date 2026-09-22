import argon2 from 'argon2';

/**
 * Paramètres argon2id recommandés par l'OWASP : 19 Mio de mémoire, deux
 * passes, un fil d'exécution. Le coût mémoire est ce qui rend l'attaque par
 * GPU non rentable ; le baisser vaut à peu près renoncer à la protection.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // Empreinte illisible ou tronquée : on refuse, sans distinguer ce cas d'un
    // mot de passe erroné.
    return false;
  }
}

/**
 * Empreinte factice, de coût comparable à une vraie. On la vérifie quand
 * l'adresse e-mail est inconnue, pour que le temps de réponse ne révèle pas
 * l'existence du compte.
 */
let decoyHash: string | null = null;

export async function wastePasswordTime(plain: string): Promise<void> {
  decoyHash ??= await hashPassword('mot-de-passe-factice-jamais-utilise');
  await verifyPassword(decoyHash, plain);
}

/**
 * argon2 évolue : une empreinte produite avec des paramètres plus faibles doit
 * être recalculée à la prochaine connexion réussie.
 */
export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON2_OPTIONS);
}
