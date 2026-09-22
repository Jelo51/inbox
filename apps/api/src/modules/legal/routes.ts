import { Router } from 'express';
import type { LegalDocumentType, PrismaClient } from '@prisma/client';
import { LOCALES, legalDocumentSlug, legalDocumentTypeFrom } from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import { currentDocument, documentHistory } from './documents.js';
import { documentVariables, legalVariables, renderLegalBody } from './variables.js';
import { hostIdentity, publisherIdentity } from '../../lib/publisher.js';
import { now } from '../../lib/clock.js';

const KNOWN_LOCALES = new Set<string>(LOCALES);

/** Le front adresse les documents par leur slug ; l'administration, par leur type. */
function parseType(value: string): LegalDocumentType {
  const type = legalDocumentTypeFrom(value);
  if (!type) {
    throw HttpError.notFound('UNKNOWN_DOCUMENT', 'Document légal inconnu');
  }
  return type as LegalDocumentType;
}

function parseLocale(value: unknown): string {
  return typeof value === 'string' && KNOWN_LOCALES.has(value) ? value : 'fr';
}

/**
 * Lecture publique des documents légaux. Ils vivent en base et non dans le
 * code : publier une nouvelle version ne demande pas de déploiement, et
 * l'historique reste consultable.
 */
export function legalRouter(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * Identité de l'éditeur et de l'hébergeur. Rien de plus que ce que les
   * mentions légales affichent déjà : la page de contact s'en sert plutôt que
   * de recopier ces valeurs dans le front, où elles se périmeraient.
   */
  router.get('/legal', (_req, res) => {
    const editeur = publisherIdentity();
    const hebergeur = hostIdentity();

    res.json({
      publisher: {
        kind: editeur.kind,
        name: editeur.name,
        legalForm: editeur.legalForm ?? null,
        rccm: editeur.rccm ?? null,
        address: editeur.address,
        email: editeur.email,
        phone: editeur.phone ?? null,
        publicationDirector: editeur.publicationDirector,
        privacyEmail: editeur.privacyEmail,
        abuseEmail: editeur.abuseEmail,
        dpoName: editeur.dpoName ?? null,
        dpoEmail: editeur.dpoEmail ?? null,
      },
      host: {
        name: hebergeur.name,
        address: hebergeur.address,
        country: hebergeur.country,
        website: hebergeur.website ?? null,
      },
    });
  });

  router.get('/legal/:type', (req, res, next) => {
    void (async () => {
      try {
        const type = parseType(req.params.type ?? '');
        const locale = parseLocale(req.query.locale);
        const document = await currentDocument(prisma, type, locale, now());

        if (!document) {
          throw HttpError.notFound(
            'DOCUMENT_NOT_PUBLISHED',
            'Ce document n’est pas encore publié dans cette langue',
          );
        }

        // L'identité de l'éditeur est injectée ici, pas à la publication :
        // une immatriculation ne doit pas obliger à republier sept documents.
        const variables = {
          ...(await legalVariables(prisma)),
          ...documentVariables(document, document.locale),
        };

        res.json({
          document: {
            type: document.type,
            slug: legalDocumentSlug(document.type),
            locale: document.locale,
            version: document.version,
            title: document.title,
            body: renderLegalBody(document.body, variables),
            effectiveAt: document.effectiveAt,
            publishedAt: document.publishedAt,
            requiresAcceptance: document.requiresAcceptance,
          },
        });
      } catch (err) {
        next(err);
      }
    })();
  });

  router.get('/legal/:type/versions', (req, res, next) => {
    void (async () => {
      try {
        const type = parseType(req.params.type ?? '');
        const locale = parseLocale(req.query.locale);
        res.json({ versions: await documentHistory(prisma, type, locale) });
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
