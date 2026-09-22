import { createHash } from 'node:crypto';

/**
 * Empreinte lisible d'une clé publique, à comparer de vive voix entre
 * correspondants. Huit groupes de quatre caractères hexadécimaux : assez court
 * pour être lu au téléphone, assez long pour qu'une collision fabriquée reste
 * hors de portée (64 bits).
 *
 * Calculée aussi côté client ; le serveur la recalcule et refuse une empreinte
 * qui ne correspondrait pas à la clé, pour qu'un client modifié ne puisse pas
 * afficher une empreinte rassurante sur une clé qui ne l'est pas.
 */
export function computeFingerprint(publicKeyBase64: string): string {
  const digest = createHash('sha256').update(Buffer.from(publicKeyBase64, 'base64')).digest('hex');
  return (digest.slice(0, 32).toUpperCase().match(/.{4}/g) ?? []).join(' ');
}

export function fingerprintMatches(publicKeyBase64: string, claimed: string): boolean {
  return computeFingerprint(publicKeyBase64) === claimed.trim().toUpperCase();
}
