import type { LegalDocument, LegalDocumentType, PrismaClient } from '@prisma/client';
import { LEGAL_DOCUMENTS_REQUIRING_ACCEPTANCE, truncateIp } from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';

/**
 * Un document est « en vigueur » s'il est publié et si sa date d'effet est
 * passée. Publier à l'avance une version qui n'entrera en vigueur que plus tard
 * doit être possible : c'est ce qui permet de prévenir les utilisateurs.
 */
export async function currentDocument(
  prisma: PrismaClient,
  type: LegalDocumentType,
  locale: string,
  now: Date,
): Promise<LegalDocument | null> {
  return prisma.legalDocument.findFirst({
    where: {
      type,
      locale,
      publishedAt: { not: null },
      effectiveAt: { lte: now },
    },
    orderBy: { effectiveAt: 'desc' },
  });
}

export async function documentHistory(
  prisma: PrismaClient,
  type: LegalDocumentType,
  locale: string,
): Promise<Pick<LegalDocument, 'version' | 'effectiveAt' | 'publishedAt' | 'title'>[]> {
  return prisma.legalDocument.findMany({
    where: { type, locale, publishedAt: { not: null } },
    select: { version: true, effectiveAt: true, publishedAt: true, title: true },
    orderBy: { effectiveAt: 'desc' },
  });
}

/**
 * Documents dont l'acceptation explicite est exigée à l'inscription : CGU et
 * politique de confidentialité. La version française fait foi, c'est donc elle
 * qui est retenue pour l'acceptation, quelle que soit la langue d'affichage.
 */
export async function requiredAcceptances(
  prisma: PrismaClient,
  now: Date,
): Promise<LegalDocument[]> {
  const documents: LegalDocument[] = [];

  for (const type of LEGAL_DOCUMENTS_REQUIRING_ACCEPTANCE) {
    const document = await currentDocument(prisma, type as LegalDocumentType, 'fr', now);
    if (!document) {
      throw new HttpError(
        503,
        'LEGAL_DOCUMENTS_UNAVAILABLE',
        'Les conditions générales ne sont pas encore publiées : ' +
          'l’inscription est indisponible. Contactez l’administrateur du site.',
      );
    }
    documents.push(document);
  }

  return documents;
}

export interface AcceptanceContext {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * Enregistre l'acceptation : qui, quel document, quelle version, quand, et
 * l'adresse IP tronquée. Tronquée, parce que la preuve de l'acte n'exige pas
 * de conserver une donnée directement identifiante.
 */
export async function recordAcceptances(
  prisma: PrismaClient,
  userId: string,
  documents: LegalDocument[],
  now: Date,
  context: AcceptanceContext = {},
): Promise<void> {
  for (const document of documents) {
    await prisma.legalAcceptance.upsert({
      where: { userId_documentId: { userId, documentId: document.id } },
      update: {},
      create: {
        userId,
        documentId: document.id,
        type: document.type,
        version: document.version,
        ipPrefix: truncateIp(context.ip),
        userAgent: context.userAgent?.slice(0, 255) ?? null,
        acceptedAt: now,
      },
    });
  }
}

export interface PendingAcceptance {
  type: LegalDocumentType;
  version: string;
  title: string;
  effectiveAt: Date;
}

/**
 * Documents qu'une nouvelle version rend à réaccepter. Appelé à la connexion :
 * tant qu'il reste quelque chose ici, le compte est utilisable en lecture mais
 * le front impose l'écran de réacceptation.
 */
export async function pendingAcceptances(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<PendingAcceptance[]> {
  const pending: PendingAcceptance[] = [];

  for (const type of LEGAL_DOCUMENTS_REQUIRING_ACCEPTANCE) {
    const document = await currentDocument(prisma, type as LegalDocumentType, 'fr', now);
    if (!document) continue;

    const accepted = await prisma.legalAcceptance.findUnique({
      where: { userId_documentId: { userId, documentId: document.id } },
      select: { id: true },
    });

    if (!accepted) {
      pending.push({
        type: document.type,
        version: document.version,
        title: document.title,
        effectiveAt: document.effectiveAt,
      });
    }
  }

  return pending;
}
