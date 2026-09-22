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

/**
 * Efface les comptes créés par une suite, sans toucher au jeu de démonstration.
 *
 * Les reçus doivent partir en premier : `Receipt.payment` est en `Restrict`,
 * délibérément — une pièce comptable ne disparaît pas parce qu'on supprime un
 * compte. En production, la suppression d'un compte anonymise le profil et
 * conserve paiements et reçus le temps de l'obligation légale ; ici, c'est un
 * raccourci de test assumé.
 */
export async function deleteTestUsers(prisma: PrismaClient, emailPattern: string): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { contains: emailPattern } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;

  await prisma.receipt.deleteMany({ where: { payment: { userId: { in: userIds } } } });
  await prisma.payment.deleteMany({ where: { userId: { in: userIds } } });
  // `Report.authorId` est en SetNull : supprimer l'auteur laisserait le
  // signalement derrière lui, et avec lui les messages transmis en clair.
  await prisma.report.deleteMany({ where: { authorId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
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
