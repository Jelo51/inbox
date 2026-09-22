import { readFile } from 'node:fs/promises';
import type { PrismaClient } from '@prisma/client';
import type { LegalDocumentEntry } from './manifest.js';
import { LEGAL_DOCUMENT_MANIFEST } from './manifest.js';
import { documentVariables, legalVariables, unresolvedPlaceholders } from './variables.js';

/**
 * Dossier des textes, hors de `src/` : `tsc` ne recopie pas les fichiers
 * Markdown dans `dist/`. Le chemin relatif vaut aussi bien depuis `src/` que
 * depuis `dist/`, tous deux à trois niveaux sous `apps/api`.
 */
const CONTENT_DIR = new URL('../../../legal/', import.meta.url);

export type PublishOutcome = 'created' | 'published' | 'updated' | 'unchanged';

export interface PublishedDocument {
  type: string;
  locale: string;
  version: string;
  outcome: PublishOutcome;
}

async function readBody(entry: LegalDocumentEntry): Promise<string> {
  return (await readFile(new URL(entry.file, CONTENT_DIR), 'utf8')).trimEnd() + '\n';
}

/**
 * Charge les documents légaux en base.
 *
 * Contrairement au seed, cette opération n'a rien d'une donnée de
 * démonstration : elle doit tourner en production, c'est elle qui rend
 * l'inscription possible. Elle est idempotente.
 *
 * **Une version publiée n'est jamais réécrite.** Un utilisateur a accepté une
 * version identifiée ; en changer le texte a posteriori ferait mentir la
 * preuve d'acceptation. Modifier un texte publié impose donc d'incrémenter sa
 * version dans le manifeste, ce que le chargeur exige explicitement plutôt que
 * d'écraser en silence.
 */
export async function publishLegalDocuments(
  prisma: PrismaClient,
  at: Date,
  entries: LegalDocumentEntry[] = LEGAL_DOCUMENT_MANIFEST,
): Promise<PublishedDocument[]> {
  const variables = await legalVariables(prisma);
  const results: PublishedDocument[] = [];

  for (const entry of entries) {
    const body = await readBody(entry);

    // Un marqueur sans valeur atteindrait la page publique tel quel : mieux
    // vaut faire échouer le chargement que publier « {{editeur.nom}} ».
    const unresolved = unresolvedPlaceholders(body, {
      ...variables,
      ...documentVariables({ version: entry.version, effectiveAt: at }, entry.locale),
    });
    if (unresolved.length > 0) {
      throw new Error(
        `${entry.file} : marqueurs sans valeur — ${unresolved.join(', ')}. ` +
          'Complétez les variables d’environnement de l’éditeur ou corrigez le texte.',
      );
    }

    const existing = await prisma.legalDocument.findUnique({
      where: {
        type_locale_version: {
          type: entry.type,
          locale: entry.locale,
          version: entry.version,
        },
      },
    });

    if (!existing) {
      await prisma.legalDocument.create({
        data: {
          type: entry.type,
          locale: entry.locale,
          version: entry.version,
          title: entry.title,
          body,
          effectiveAt: at,
          publishedAt: at,
          requiresAcceptance: entry.requiresAcceptance,
        },
      });
      results.push({ ...entry, outcome: 'created' });
      continue;
    }

    if (existing.publishedAt !== null) {
      if (existing.body !== body || existing.title !== entry.title) {
        throw new Error(
          `${entry.file} : la version ${entry.version} est déjà publiée et son texte a changé. ` +
            'Une version publiée est figée : incrémentez la version dans le manifeste.',
        );
      }
      results.push({ ...entry, outcome: 'unchanged' });
      continue;
    }

    // Brouillon : tant qu'il n'est pas publié, rien ne s'appuie dessus.
    await prisma.legalDocument.update({
      where: { id: existing.id },
      data: {
        title: entry.title,
        body,
        publishedAt: at,
        requiresAcceptance: entry.requiresAcceptance,
      },
    });
    results.push({ ...entry, outcome: 'published' });
  }

  return results;
}
