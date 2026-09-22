import pino from 'pino';
import { env } from '../config/env.js';

/**
 * Journalisation structurée sans donnée personnelle.
 * Les clés listées ci-dessous sont supprimées avant écriture : rien ne doit
 * permettre de reconstituer une identité, un jeton ou un contenu de message.
 */
const REDACTED = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  'password',
  'newPassword',
  'currentPassword',
  '*.password',
  'token',
  'refreshToken',
  'accessToken',
  '*.token',
  'email',
  '*.email',
  'phone',
  '*.phone',
  'ciphertext',
  '*.ciphertext',
  'senderCiphertext',
  'encryptedPrivateKey',
  'plaintext',
  '*.plaintext',
];

export function createLogger() {
  const config = env();
  return pino({
    level: config.LOG_LEVEL,
    redact: { paths: REDACTED, censor: '[supprimé]' },
    base: { service: 'inbox-api' },
    transport: config.isProduction
      ? undefined
      : { target: 'pino/file', options: { destination: 1 } },
  });
}

export type Logger = ReturnType<typeof createLogger>;
