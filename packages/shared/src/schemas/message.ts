import { z } from 'zod';
import { MESSAGE_LIMITS } from '../constants/limits.js';
import { idSchema } from './common.js';

/**
 * Le serveur ne voit jamais de texte en clair : un message est un couple
 * (chiffré, nonce) produit par nacl.box côté client. Aucun champ `content`
 * n'existe, ni dans ces schémas, ni dans le schéma Prisma.
 */
const base64Schema = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Base64 attendu');

export const publicKeySchema = base64Schema.length(44, 'Clé publique X25519 de 32 octets attendue');

export const sendMessageSchema = z.object({
  conversationId: idSchema,
  /** Chiffré pour le destinataire. */
  ciphertext: base64Schema.max(Math.ceil((MESSAGE_LIMITS.ciphertextMaxBytes * 4) / 3) + 4),
  nonce: base64Schema.length(32, 'Nonce de 24 octets attendu'),
  /**
   * Copie chiffrée pour l'expéditeur : sans elle, il ne pourrait pas relire
   * ses propres messages depuis un autre appareil restauré.
   */
  senderCiphertext: base64Schema.max(Math.ceil((MESSAGE_LIMITS.ciphertextMaxBytes * 4) / 3) + 4),
  senderNonce: base64Schema.length(32),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const startConversationSchema = z.object({
  /** Une conversation ne peut naître que d'une annonce : pas de démarchage à froid. */
  listingId: idSchema,
});

export const registerPublicKeySchema = z.object({
  publicKey: publicKeySchema,
  /** Empreinte affichable, calculée côté client et revérifiée côté serveur. */
  fingerprint: z.string().regex(/^[0-9A-F]{4}( [0-9A-F]{4}){7}$/, 'Empreinte invalide'),
});

export const keyBackupSchema = z.object({
  /** Blob chiffré côté client avec une phrase secrète ; le serveur le stocke sans pouvoir l'ouvrir. */
  encryptedPrivateKey: z.string().min(1).max(4096),
  salt: z.string().min(1).max(200),
  nonce: z.string().min(1).max(200),
  kdf: z.literal('argon2id'),
  kdfParams: z.object({
    memoryKiB: z.number().int().min(19456).max(1048576),
    iterations: z.number().int().min(2).max(16),
    parallelism: z.number().int().min(1).max(8),
  }),
});
export type KeyBackupInput = z.infer<typeof keyBackupSchema>;

export const blockUserSchema = z.object({ userId: idSchema });
