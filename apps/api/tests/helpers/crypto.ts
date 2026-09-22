import nacl from 'tweetnacl';
import { createHash } from 'node:crypto';

/**
 * Chiffrement de test, identique à ce que fait le navigateur : c'est la seule
 * façon de vérifier que le serveur transporte bien des octets qu'il ne peut
 * pas ouvrir, et que le destinataire, lui, les ouvre.
 */

export interface KeyPair {
  publicKey: string;
  secretKey: Uint8Array;
  fingerprint: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function generateKeyPair(): KeyPair {
  const pair = nacl.box.keyPair();
  const publicKey = Buffer.from(pair.publicKey).toString('base64');
  return { publicKey, secretKey: pair.secretKey, fingerprint: fingerprint(publicKey) };
}

export function fingerprint(publicKeyBase64: string): string {
  const digest = createHash('sha256').update(Buffer.from(publicKeyBase64, 'base64')).digest('hex');
  return (digest.slice(0, 32).toUpperCase().match(/.{4}/g) ?? []).join(' ');
}

export interface SealedBox {
  ciphertext: string;
  nonce: string;
}

export function seal(
  plaintext: string,
  recipientPublicKey: string,
  senderSecret: Uint8Array,
): SealedBox {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const boxed = nacl.box(
    encoder.encode(plaintext),
    nonce,
    Buffer.from(recipientPublicKey, 'base64'),
    senderSecret,
  );

  return {
    ciphertext: Buffer.from(boxed).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64'),
  };
}

export function open(
  sealed: SealedBox,
  senderPublicKey: string,
  recipientSecret: Uint8Array,
): string | null {
  const opened = nacl.box.open(
    Buffer.from(sealed.ciphertext, 'base64'),
    Buffer.from(sealed.nonce, 'base64'),
    Buffer.from(senderPublicKey, 'base64'),
    recipientSecret,
  );

  return opened ? decoder.decode(opened) : null;
}
