import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { AUTH_LIMITS } from '@inbox/shared';
import type { UserRole } from '@inbox/shared';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/http-error.js';

export interface AccessTokenClaims {
  userId: string;
  role: UserRole;
  emailVerified: boolean;
  sessionId: string;
}

const ISSUER = 'inbox';
const AUDIENCE = 'inbox-web';

function accessKey(): Uint8Array {
  return new TextEncoder().encode(env().JWT_SECRET);
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({
    role: claims.role,
    ev: claims.emailVerified,
    sid: claims.sessionId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${AUTH_LIMITS.accessTokenTtlSeconds}s`)
    .sign(accessKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, accessKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });

    if (!payload.sub || typeof payload.sid !== 'string' || typeof payload.role !== 'string') {
      throw HttpError.unauthorized('INVALID_TOKEN', 'Jeton incomplet');
    }

    return {
      userId: payload.sub,
      role: payload.role as UserRole,
      emailVerified: payload.ev === true,
      sessionId: payload.sid,
    };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw HttpError.unauthorized('INVALID_TOKEN', 'Jeton d’accès invalide ou expiré');
  }
}

/**
 * Jetons opaques (rafraîchissement, vérification d'e-mail, réinitialisation).
 * 32 octets tirés au sort : ni devinables, ni énumérables. Seule leur empreinte
 * est stockée, de sorte qu'une fuite de la base ne livre aucun jeton utilisable.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparaison à temps constant, pour ne rien révéler par la durée. */
export function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
