import type { EmailTokenPurpose, PrismaClient, User } from '@prisma/client';
import {
  AUTH_LIMITS,
  addSeconds,
  normalizePhone,
  type RegisterInput,
  type UserRole,
} from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import type { MailService } from '../mail/service.js';
import {
  pendingAcceptances,
  recordAcceptances,
  requiredAcceptances,
  type PendingAcceptance,
} from '../legal/documents.js';
import { hashPassword, needsRehash, verifyPassword, wastePasswordTime } from './password.js';
import { generateOpaqueToken, hashToken, signAccessToken } from './tokens.js';
import {
  createSession,
  revokeAllSessions,
  rotateSession,
  type SessionContext,
} from './sessions.js';

export interface AuthDeps {
  prisma: PrismaClient;
  mail: MailService;
  now: () => Date;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  locale: string;
  emailVerified: boolean;
  hasPhone: boolean;
  bio: string | null;
  cityId: string | null;
  createdAt: Date;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  pendingLegalAcceptances: PendingAcceptance[];
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    locale: user.locale,
    emailVerified: user.emailVerifiedAt !== null,
    // Le numéro n'est jamais renvoyé en clair, même à son propriétaire, hors
    // de la page de réglages dédiée.
    hasPhone: user.phone !== null,
    bio: user.bio,
    cityId: user.cityId,
    createdAt: user.createdAt,
  };
}

async function issueEmailToken(
  deps: AuthDeps,
  userId: string,
  purpose: EmailTokenPurpose,
  ttlSeconds: number,
  payload?: string,
): Promise<string> {
  const now = deps.now();
  const token = generateOpaqueToken();

  // Un nouveau jeton invalide les précédents de même nature : deux liens de
  // réinitialisation valables en même temps doublent la fenêtre d'attaque.
  await deps.prisma.emailToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: now },
  });

  await deps.prisma.emailToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hashToken(token),
      payload: payload ?? null,
      expiresAt: addSeconds(now, ttlSeconds),
      createdAt: now,
    },
  });

  return token;
}

async function consumeEmailToken(deps: AuthDeps, token: string, purpose: EmailTokenPurpose) {
  const now = deps.now();
  const record = await deps.prisma.emailToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!record || record.purpose !== purpose || record.usedAt || record.expiresAt <= now) {
    throw HttpError.badRequest('INVALID_TOKEN', 'Ce lien est invalide ou a expiré');
  }

  await deps.prisma.emailToken.update({ where: { id: record.id }, data: { usedAt: now } });
  return record;
}

function assertUsable(user: User, now: Date): void {
  if (user.status === 'BANNED') {
    throw HttpError.forbidden('ACCOUNT_BANNED', 'Ce compte a été banni');
  }
  if (user.status === 'DELETED' || user.anonymizedAt) {
    throw HttpError.unauthorized('INVALID_CREDENTIALS', 'Identifiants incorrects');
  }
  if (user.status === 'SUSPENDED' && user.suspendedUntil && user.suspendedUntil > now) {
    throw HttpError.forbidden(
      'ACCOUNT_SUSPENDED',
      `Ce compte est suspendu jusqu’au ${user.suspendedUntil.toISOString().slice(0, 10)}`,
    );
  }
}

async function buildAuthResult(
  deps: AuthDeps,
  user: User,
  context: SessionContext,
): Promise<AuthResult> {
  const now = deps.now();
  const { token: refreshToken, session } = await createSession(deps.prisma, user.id, now, context);

  const accessToken = await signAccessToken({
    userId: user.id,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
    sessionId: session.id,
  });

  return {
    user: toPublicUser(user),
    accessToken,
    refreshToken,
    expiresIn: AUTH_LIMITS.accessTokenTtlSeconds,
    pendingLegalAcceptances: await pendingAcceptances(deps.prisma, user.id, now),
  };
}

export async function register(
  deps: AuthDeps,
  input: RegisterInput,
  context: SessionContext & { userAgent?: string | undefined } = {},
): Promise<AuthResult> {
  const now = deps.now();

  // Les versions acceptées doivent être celles en vigueur : accepter une
  // version périmée affichée par un onglet resté ouvert ne vaut pas accord.
  const documents = await requiredAcceptances(deps.prisma, now);
  for (const document of documents) {
    const claimed = input.acceptedLegalVersions[document.type as 'CGU' | 'CONFIDENTIALITE'];
    if (claimed !== document.version) {
      throw HttpError.conflict(
        'LEGAL_VERSION_OUTDATED',
        'Les conditions ont changé depuis l’affichage du formulaire. Rechargez la page.',
      );
    }
  }

  const existing = await deps.prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // Ne pas révéler qu'un compte existe : l'inscription « réussit » et
    // l'utilisateur légitime reçoit un e-mail lui rappelant qu'il a un compte.
    throw HttpError.conflict(
      'EMAIL_TAKEN',
      'Un compte existe déjà avec cette adresse. Essayez de vous connecter.',
    );
  }

  const user = await deps.prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName,
      phone: input.phone ? normalizePhone(input.phone) : null,
      locale: input.locale,
      adultDeclaredAt: now,
      createdAt: now,
      notificationPrefs: { create: {} },
    },
  });

  await recordAcceptances(deps.prisma, user.id, documents, now, context);

  const token = await issueEmailToken(
    deps,
    user.id,
    'EMAIL_VERIFICATION',
    AUTH_LIMITS.emailVerificationTtlSeconds,
  );
  await deps.mail.sendEmailVerification(user, token);

  return buildAuthResult(deps, user, context);
}

export async function login(
  deps: AuthDeps,
  email: string,
  password: string,
  context: SessionContext = {},
): Promise<AuthResult> {
  const now = deps.now();
  const user = await deps.prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Même coût de calcul que pour un compte existant : sans cela, le temps de
    // réponse permettrait d'énumérer les adresses inscrites.
    await wastePasswordTime(password);
    throw HttpError.unauthorized('INVALID_CREDENTIALS', 'Identifiants incorrects');
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    throw HttpError.unauthorized('INVALID_CREDENTIALS', 'Identifiants incorrects');
  }

  assertUsable(user, now);

  if (needsRehash(user.passwordHash)) {
    await deps.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password) },
    });
  }

  // Une connexion annule l'avertissement d'inactivité : le compte sert encore.
  await deps.prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: now, inactivityWarnedAt: null },
  });

  return buildAuthResult(deps, user, context);
}

export async function refresh(
  deps: AuthDeps,
  presentedToken: string,
  context: SessionContext = {},
): Promise<AuthResult> {
  const now = deps.now();
  const result = await rotateSession(deps.prisma, presentedToken, now, context);

  if (result.outcome === 'REUSE_DETECTED') {
    // Toute la chaîne a été révoquée : l'utilisateur devra se reconnecter sur
    // tous ses appareils. C'est le prix d'une détection de vol qui ne peut pas
    // distinguer le voleur du propriétaire.
    throw HttpError.unauthorized(
      'SESSION_REUSE',
      'Une anomalie de session a été détectée. Reconnectez-vous.',
    );
  }

  if (result.outcome !== 'ROTATED') {
    throw HttpError.unauthorized('SESSION_EXPIRED', 'Session expirée, reconnectez-vous');
  }

  const user = await deps.prisma.user.findUnique({ where: { id: result.session.userId } });
  if (!user) throw HttpError.unauthorized();
  assertUsable(user, now);

  const accessToken = await signAccessToken({
    userId: user.id,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
    sessionId: result.session.id,
  });

  return {
    user: toPublicUser(user),
    accessToken,
    refreshToken: result.token,
    expiresIn: AUTH_LIMITS.accessTokenTtlSeconds,
    pendingLegalAcceptances: await pendingAcceptances(deps.prisma, user.id, now),
  };
}

export async function verifyEmail(deps: AuthDeps, token: string): Promise<PublicUser> {
  const record = await consumeEmailToken(deps, token, 'EMAIL_VERIFICATION');
  const user = await deps.prisma.user.update({
    where: { id: record.userId },
    data: { emailVerifiedAt: record.user.emailVerifiedAt ?? deps.now() },
  });
  return toPublicUser(user);
}

export async function resendVerification(deps: AuthDeps, userId: string): Promise<void> {
  const user = await deps.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerifiedAt) {
    throw HttpError.conflict('ALREADY_VERIFIED', 'Cette adresse est déjà vérifiée');
  }

  const token = await issueEmailToken(
    deps,
    user.id,
    'EMAIL_VERIFICATION',
    AUTH_LIMITS.emailVerificationTtlSeconds,
  );
  await deps.mail.sendEmailVerification(user, token);
}

/**
 * La réponse est toujours la même, que l'adresse existe ou non : le formulaire
 * de mot de passe oublié ne doit pas servir à tester si quelqu'un est inscrit.
 */
export async function requestPasswordReset(deps: AuthDeps, email: string): Promise<void> {
  const user = await deps.prisma.user.findUnique({ where: { email } });
  if (!user || user.status === 'BANNED' || user.anonymizedAt) return;

  const token = await issueEmailToken(
    deps,
    user.id,
    'PASSWORD_RESET',
    AUTH_LIMITS.passwordResetTtlSeconds,
  );
  await deps.mail.sendPasswordReset(user, token);
}

export async function resetPassword(
  deps: AuthDeps,
  token: string,
  newPassword: string,
): Promise<void> {
  const record = await consumeEmailToken(deps, token, 'PASSWORD_RESET');
  const now = deps.now();

  await deps.prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  // Un mot de passe réinitialisé après un vol ne sert à rien si les sessions
  // ouvertes par le voleur survivent.
  await revokeAllSessions(deps.prisma, record.userId, now, 'PASSWORD_RESET');
  await deps.mail.sendPasswordChanged(record.user);
}

export async function changePassword(
  deps: AuthDeps,
  userId: string,
  currentPassword: string,
  newPassword: string,
  context: SessionContext = {},
): Promise<{ refreshToken: string }> {
  const user = await deps.prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw HttpError.badRequest('INVALID_PASSWORD', 'Mot de passe actuel incorrect');
  }

  const now = deps.now();
  await deps.prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  await revokeAllSessions(deps.prisma, userId, now, 'PASSWORD_CHANGED');
  await deps.mail.sendPasswordChanged(user);

  // L'appareil courant reste connecté : fermer sa propre session en changeant
  // son mot de passe serait déroutant.
  const { token } = await createSession(deps.prisma, userId, now, context);
  return { refreshToken: token };
}

export async function requestEmailChange(
  deps: AuthDeps,
  userId: string,
  newEmail: string,
  currentPassword: string,
): Promise<void> {
  const user = await deps.prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw HttpError.badRequest('INVALID_PASSWORD', 'Mot de passe incorrect');
  }
  if (newEmail === user.email) {
    throw HttpError.badRequest('SAME_EMAIL', 'Cette adresse est déjà la vôtre');
  }
  if (await deps.prisma.user.findUnique({ where: { email: newEmail } })) {
    throw HttpError.conflict('EMAIL_TAKEN', 'Cette adresse est déjà utilisée');
  }

  const token = await issueEmailToken(
    deps,
    userId,
    'EMAIL_CHANGE',
    AUTH_LIMITS.emailChangeTtlSeconds,
    newEmail,
  );

  // Le lien part sur la NOUVELLE adresse : c'est elle qu'il s'agit de prouver.
  await deps.mail.sendEmailChangeConfirmation(
    { email: newEmail, displayName: user.displayName, locale: user.locale },
    token,
  );
}

export async function confirmEmailChange(deps: AuthDeps, token: string): Promise<PublicUser> {
  const record = await consumeEmailToken(deps, token, 'EMAIL_CHANGE');
  if (!record.payload) {
    throw HttpError.badRequest('INVALID_TOKEN', 'Ce lien est invalide');
  }

  if (await deps.prisma.user.findUnique({ where: { email: record.payload } })) {
    throw HttpError.conflict(
      'EMAIL_TAKEN',
      'Cette adresse est désormais utilisée par un autre compte',
    );
  }

  const user = await deps.prisma.user.update({
    where: { id: record.userId },
    data: { email: record.payload, emailVerifiedAt: deps.now() },
  });

  return toPublicUser(user);
}

export async function acceptPendingLegal(
  deps: AuthDeps,
  userId: string,
  context: SessionContext = {},
): Promise<void> {
  const now = deps.now();
  const documents = await requiredAcceptances(deps.prisma, now);
  await recordAcceptances(deps.prisma, userId, documents, now, context);
}
