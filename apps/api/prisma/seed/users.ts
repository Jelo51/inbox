import type { PrismaClient, User } from '@prisma/client';
import argon2 from 'argon2';

/**
 * Paramètres argon2id. Ceux recommandés par l'OWASP : 19 Mio de mémoire,
 * deux passes, un fil. Ils sont volontairement les mêmes qu'en production
 * pour que le seed reflète le coût réel de la vérification.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export interface SeedAccounts {
  user: User;
  pro: User;
  admin: User;
}

/**
 * Comptes de démonstration. Les mots de passe ne sont documentés que dans le
 * README de développement, et le seed refuse de tourner en production.
 */
const ACCOUNTS = [
  {
    key: 'user' as const,
    email: 'utilisateur@inbox.cm',
    password: 'Demo-Utilisateur-2026',
    displayName: 'Awa Mbarga',
    role: 'USER' as const,
    phone: '677112233',
    citySlug: 'douala',
    bio: "J'achète et je revends surtout du matériel informatique et de la téléphonie.",
  },
  {
    key: 'pro' as const,
    email: 'pro@inbox.cm',
    password: 'Demo-Professionnel-2026',
    displayName: 'Atangana Électronique',
    role: 'PRO' as const,
    phone: '699445566',
    citySlug: 'douala',
    bio: 'Boutique à Bonanjo depuis 2015. Téléphonie, informatique et énergie solaire.',
  },
  {
    key: 'admin' as const,
    email: 'admin@inbox.cm',
    password: 'Demo-Administrateur-2026',
    displayName: 'Équipe Inbox',
    role: 'ADMIN' as const,
    phone: null,
    citySlug: 'yaounde',
    bio: null,
  },
];

export async function seedUsers(prisma: PrismaClient, now: Date): Promise<SeedAccounts> {
  const accounts: Partial<SeedAccounts> = {};

  for (const account of ACCOUNTS) {
    const city = await prisma.city.findUnique({ where: { slug: account.citySlug } });
    const passwordHash = await argon2.hash(account.password, ARGON2_OPTIONS);

    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {},
      create: {
        email: account.email,
        passwordHash,
        displayName: account.displayName,
        role: account.role,
        phone: account.phone,
        bio: account.bio,
        cityId: city?.id ?? null,
        locale: 'fr',
        // Comptes de démonstration déjà vérifiés : sans cela, impossible de
        // publier ni d'écrire, et le jeu de données serait inutilisable.
        emailVerifiedAt: now,
        adultDeclaredAt: now,
        lastLoginAt: now,
        notificationPrefs: { create: {} },
      },
    });

    accounts[account.key] = user;
  }

  return accounts as SeedAccounts;
}

export const SEED_CREDENTIALS = ACCOUNTS.map((a) => ({
  email: a.email,
  password: a.password,
  role: a.role,
}));
