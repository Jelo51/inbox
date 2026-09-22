import nacl from 'tweetnacl';
import { sha256 } from '@noble/hashes/sha2.js';
import { argon2id } from '@noble/hashes/argon2.js';

/**
 * Primitives de chiffrement de bout en bout, sans dépendance à Nuxt ni au
 * navigateur : elles sont ainsi testables directement, et le format produit ici
 * est exactement celui que le seed de l'API sait relire.
 *
 * `nacl.box` (X25519 + XSalsa20-Poly1305) pour les messages, `nacl.secretbox`
 * pour la sauvegarde de la clé privée, `argon2id` pour dériver la clé de
 * sauvegarde depuis une phrase secrète.
 */

export const KDF_PARAMS = { memoryKiB: 19456, iterations: 2, parallelism: 1 } as const;

export interface KdfParams {
  memoryKiB: number;
  iterations: number;
  parallelism: number;
}

export interface Identity {
  publicKey: string;
  secretKey: Uint8Array;
  fingerprint: string;
}

export interface SealedBox {
  ciphertext: string;
  nonce: string;
}

export interface BackupPayload {
  encryptedPrivateKey: string;
  salt: string;
  nonce: string;
  kdf: 'argon2id';
  kdfParams: KdfParams;
  publicKey: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/**
 * Empreinte lisible : huit groupes de quatre caractères hexadécimaux, soit
 * 64 bits. Assez court pour être lu au téléphone, assez long pour qu'une
 * collision fabriquée reste hors de portée. Le serveur la recalcule à
 * l'identique et refuse une empreinte qui ne correspondrait pas à la clé.
 */
export function fingerprintOf(publicKeyBase64: string): string {
  const digest = sha256(fromBase64(publicKeyBase64));
  const hex = Array.from(digest.slice(0, 16))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return (hex.match(/.{4}/g) ?? []).join(' ');
}

export function generateIdentity(): Identity {
  const pair = nacl.box.keyPair();
  const publicKey = toBase64(pair.publicKey);
  return { publicKey, secretKey: pair.secretKey, fingerprint: fingerprintOf(publicKey) };
}

export function seal(
  plaintext: string,
  recipientPublicKey: string,
  secretKey: Uint8Array,
): SealedBox {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const boxed = nacl.box(
    encoder.encode(plaintext),
    nonce,
    fromBase64(recipientPublicKey),
    secretKey,
  );
  return { ciphertext: toBase64(boxed), nonce: toBase64(nonce) };
}

/** `null` si le message ne peut pas être ouvert : mauvaise clé, ou contenu altéré. */
export function open(
  sealed: SealedBox,
  senderPublicKey: string,
  secretKey: Uint8Array,
): string | null {
  const opened = nacl.box.open(
    fromBase64(sealed.ciphertext),
    fromBase64(sealed.nonce),
    fromBase64(senderPublicKey),
    secretKey,
  );
  return opened ? decoder.decode(opened) : null;
}

function deriveKey(passphrase: string, salt: Uint8Array, params: KdfParams): Uint8Array {
  return argon2id(encoder.encode(passphrase), salt, {
    m: params.memoryKiB,
    t: params.iterations,
    p: params.parallelism,
    dkLen: nacl.secretbox.keyLength,
  });
}

/**
 * Chiffre la clé privée avec une clé dérivée de la phrase secrète. Le serveur
 * reçoit ce résultat et rien d'autre : ni la phrase, ni la clé privée.
 */
export function buildBackup(identity: Identity, passphrase: string): BackupPayload {
  const salt = nacl.randomBytes(16);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const key = deriveKey(passphrase, salt, KDF_PARAMS);

  return {
    encryptedPrivateKey: toBase64(nacl.secretbox(identity.secretKey, nonce, key)),
    salt: toBase64(salt),
    nonce: toBase64(nonce),
    kdf: 'argon2id',
    kdfParams: KDF_PARAMS,
    publicKey: identity.publicKey,
  };
}

/**
 * `null` si la phrase secrète est fausse. Rien d'autre ne la vérifie : c'est le
 * déchiffrement lui-même qui échoue, et c'est exactement ce qu'on veut — aucun
 * indice ne doit permettre de tester une phrase sans faire le travail.
 */
export function restoreBackup(
  backup: {
    encryptedPrivateKey: string;
    salt: string;
    nonce: string;
    kdfParams: KdfParams;
  },
  passphrase: string,
): Uint8Array | null {
  const key = deriveKey(passphrase, fromBase64(backup.salt), backup.kdfParams);
  return nacl.secretbox.open(fromBase64(backup.encryptedPrivateKey), fromBase64(backup.nonce), key);
}
