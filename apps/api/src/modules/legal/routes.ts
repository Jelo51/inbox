import { Router } from 'express';
import type { LegalDocumentType, PrismaClient } from '@prisma/client';
import { LEGAL_DOCUMENT_TYPES, LOCALES } from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import { currentDocument, documentHistory } from './documents.js';
import { now } from '../../lib/clock.js';

const TYPES = new Set<string>(LEGAL_DOCUMENT_TYPES);
const KNOWN_LOCALES = new Set<string>(LOCALES);

function parseType(value: string): LegalDocumentType {
  if (!TYPES.has(value)) {
    throw HttpError.notFound('UNKNOWN_DOCUMENT', 'Document légal inconnu');
  }
  return value as LegalDocumentType;
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

        res.json({
          document: {
            type: document.type,
            locale: document.locale,
            version: document.version,
            title: document.title,
            body: document.body,
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
