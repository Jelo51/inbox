import { z } from 'zod';
import { LEGAL_DOCUMENT_TYPES } from '../constants/enums.js';
import { localeSchema } from './common.js';

/**
 * Publication d'une nouvelle version d'un document légal depuis le back-office.
 *
 * Le corps est du Markdown pouvant contenir des marqueurs `{{...}}` : l'identité
 * de l'éditeur est injectée au rendu, pas ici. Une version publiée n'est jamais
 * réécrite — c'est le numéro de version qui change.
 */
export const publishLegalDocumentSchema = z.object({
  type: z.enum(LEGAL_DOCUMENT_TYPES),
  locale: localeSchema,
  version: z
    .string()
    .trim()
    .regex(/^\d+\.\d+$/, 'Format attendu : 1.0, 1.1, 2.0…'),
  title: z.string().trim().min(3).max(150),
  body: z.string().min(50).max(200_000),
  /**
   * Publier à l'avance une version qui n'entrera en vigueur que plus tard est
   * volontairement possible : c'est ce qui permet de prévenir les utilisateurs
   * avant que de nouvelles conditions s'appliquent.
   */
  effectiveAt: z.coerce.date(),
});
export type PublishLegalDocumentInput = z.infer<typeof publishLegalDocumentSchema>;
