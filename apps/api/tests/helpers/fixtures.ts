import type { PrismaClient } from '@prisma/client';

/**
 * Les documents légaux conditionnent l'inscription : sans CGU ni politique de
 * confidentialité publiées, le formulaire est indisponible. Les tests publient
 * donc leurs propres versions, dont le contenu n'a aucune importance ici.
 */
export async function publishLegalDocuments(
  prisma: PrismaClient,
  version = '1.0-test',
): Promise<void> {
  const now = new Date(Date.now() - 60_000);

  for (const type of ['CGU', 'CONFIDENTIALITE'] as const) {
    await prisma.legalDocument.upsert({
      where: { type_locale_version: { type, locale: 'fr', version } },
      update: { publishedAt: now, effectiveAt: now },
      create: {
        type,
        locale: 'fr',
        version,
        title: type === 'CGU' ? 'Conditions générales' : 'Politique de confidentialité',
        body: 'Contenu de test.',
        effectiveAt: now,
        publishedAt: now,
        requiresAcceptance: true,
      },
    });
  }
}

/** Efface les comptes créés par une suite, sans toucher au jeu de démonstration. */
export async function deleteTestUsers(prisma: PrismaClient, emailPattern: string): Promise<void> {
  await prisma.user.deleteMany({ where: { email: { contains: emailPattern } } });
}

export async function deleteTestLegalDocuments(
  prisma: PrismaClient,
  versionPattern = '-test',
): Promise<void> {
  await prisma.legalAcceptance.deleteMany({
    where: { document: { version: { contains: versionPattern } } },
  });
  await prisma.legalDocument.deleteMany({ where: { version: { contains: versionPattern } } });
}

let counter = 0;

/** Adresse unique par test, pour que les suites ne se marchent pas dessus. */
export function uniqueEmail(prefix = 'essai'): string {
  counter += 1;
  return `${prefix}-${process.pid}-${counter}-${Date.now()}@essai-inbox.test`;
}

export const VALID_PASSWORD = 'Motdepasse-Solide-2026';
