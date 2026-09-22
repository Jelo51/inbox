import type { LegalDocumentType, PrismaClient } from '@prisma/client';
import type { PublishLegalDocumentInput } from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import { documentVariables, legalVariables, unresolvedPlaceholders } from '../legal/variables.js';
import { recordAudit } from './audit.js';

/**
 * Administration des documents légaux.
 *
 * Publier depuis le back-office plutôt que par un déploiement : un texte
 * juridique change plus souvent qu'un schéma de base, et l'attendre derrière
 * une mise en production conduit à publier en retard.
 */

export async function listLegalDocuments(prisma: PrismaClient) {
  const documents = await prisma.legalDocument.findMany({
    orderBy: [{ type: 'asc' }, { locale: 'asc' }, { effectiveAt: 'desc' }],
    select: {
      id: true,
      type: true,
      locale: true,
      version: true,
      title: true,
      effectiveAt: true,
      publishedAt: true,
      requiresAcceptance: true,
      createdAt: true,
      _count: { select: { acceptances: true } },
    },
  });

  return documents.map(({ _count, ...document }) => ({
    ...document,
    acceptances: _count.acceptances,
  }));
}

export async function legalDocumentBody(
  prisma: PrismaClient,
  id: string,
): Promise<{ id: string; type: LegalDocumentType; locale: string; version: string; body: string }> {
  const document = await prisma.legalDocument.findUnique({
    where: { id },
    select: { id: true, type: true, locale: true, version: true, body: true },
  });

  if (!document) {
    throw HttpError.notFound('UNKNOWN_DOCUMENT', 'Document légal inconnu');
  }

  return document;
}

export interface PublishDeps {
  prisma: PrismaClient;
  now: () => Date;
}

export async function publishLegalDocument(
  deps: PublishDeps,
  actorId: string,
  input: PublishLegalDocumentInput,
  ip?: string,
) {
  const { prisma } = deps;
  const instant = deps.now();

  // Un marqueur sans valeur s'afficherait tel quel sur une page publique.
  const variables = {
    ...(await legalVariables(prisma)),
    ...documentVariables({ version: input.version, effectiveAt: input.effectiveAt }, input.locale),
  };
  const unresolved = unresolvedPlaceholders(input.body, variables);
  if (unresolved.length > 0) {
    throw new HttpError(
      422,
      'UNRESOLVED_PLACEHOLDERS',
      `Marqueurs sans valeur : ${unresolved.join(', ')}`,
    );
  }

  const existing = await prisma.legalDocument.findUnique({
    where: {
      type_locale_version: {
        type: input.type,
        locale: input.locale,
        version: input.version,
      },
    },
    select: { id: true, publishedAt: true },
  });

  // Un utilisateur a accepté une version identifiée : en réécrire le texte
  // ferait mentir la preuve d'acceptation. On exige un nouveau numéro.
  if (existing?.publishedAt) {
    throw new HttpError(
      409,
      'VERSION_ALREADY_PUBLISHED',
      `La version ${input.version} de ce document est déjà publiée. ` +
        'Une version publiée est figée : publiez un nouveau numéro de version.',
    );
  }

  const document = existing
    ? await prisma.legalDocument.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          body: input.body,
          effectiveAt: input.effectiveAt,
          publishedAt: instant,
        },
      })
    : await prisma.legalDocument.create({
        data: {
          type: input.type,
          locale: input.locale,
          version: input.version,
          title: input.title,
          body: input.body,
          effectiveAt: input.effectiveAt,
          publishedAt: instant,
          // Les CGU et la politique de confidentialité restent à acceptation
          // quelle que soit la version : c'est une propriété du document, pas
          // une décision au coup par coup.
          requiresAcceptance: await inheritsAcceptance(prisma, input.type),
        },
      });

  await recordAudit(
    prisma,
    {
      actorId,
      action: 'LEGAL_DOCUMENT_PUBLISHED',
      targetType: 'LegalDocument',
      targetId: document.id,
      metadata: {
        type: document.type,
        locale: document.locale,
        version: document.version,
        effectiveAt: document.effectiveAt.toISOString(),
      },
      ip,
    },
    instant,
  );

  return document;
}

async function inheritsAcceptance(prisma: PrismaClient, type: LegalDocumentType): Promise<boolean> {
  const previous = await prisma.legalDocument.findFirst({
    where: { type },
    orderBy: { effectiveAt: 'desc' },
    select: { requiresAcceptance: true },
  });

  return previous?.requiresAcceptance ?? false;
}
