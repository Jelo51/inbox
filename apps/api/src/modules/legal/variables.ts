import type { PrismaClient } from '@prisma/client';
import { formatPrice } from '@inbox/shared';
import { hostIdentity, publisherIdentity } from '../../lib/publisher.js';

/**
 * Variables injectées dans les documents légaux **au rendu**, pas à la
 * publication.
 *
 * C'est ce qui permet de changer l'identité de l'éditeur — le jour où la SARL
 * est immatriculée — sans réécrire les sept documents ni republier une version.
 * Le corps stocké en base contient les marqueurs `{{...}}` ; seule la page
 * rendue contient les valeurs.
 */

export type LegalVariables = Record<string, string>;

export async function legalVariables(prisma: PrismaClient): Promise<LegalVariables> {
  const editeur = publisherIdentity();
  const hebergeur = hostIdentity();

  const plan = await prisma.plan.findUnique({ where: { code: 'PRO_MENSUEL' } });

  return {
    'editeur.nom': editeur.name,
    'editeur.formeJuridique': editeur.legalForm ?? '',
    'editeur.capital': editeur.capital ?? '',
    'editeur.rccm': editeur.rccm ?? '',
    'editeur.niu': editeur.niu ?? '',
    'editeur.adresse': editeur.address,
    'editeur.email': editeur.email,
    'editeur.telephone': editeur.phone ?? '',
    'editeur.qualite': editeur.kind === 'COMPANY' ? 'société' : 'personne physique',
    directeurPublication: editeur.publicationDirector,

    'contact.donnees': editeur.privacyEmail,
    'contact.abus': editeur.abuseEmail,
    'contact.general': editeur.email,
    'dpo.nom': editeur.dpoName ?? '',
    'dpo.email': editeur.dpoEmail ?? '',

    'hebergeur.nom': hebergeur.name,
    'hebergeur.adresse': hebergeur.address,
    'hebergeur.pays': hebergeur.country,
    'hebergeur.site': hebergeur.website ?? '',

    'site.nom': 'Inbox',
    'site.domaine': new URL(process.env.APP_URL ?? 'https://inbox.cm').host,
    'site.url': (process.env.APP_URL ?? 'https://inbox.cm').replace(/\/$/, ''),

    'offre.prix': plan ? formatPrice(plan.priceXaf) : '',
    'offre.periode': plan ? `${plan.periodDays} jours` : '',
    'offre.tva':
      plan && plan.vatRateBp > 0 ? `${(plan.vatRateBp / 100).toString().replace('.', ',')} %` : '',
  };
}

/**
 * Variables propres à une version donnée d'un document. Séparées des
 * précédentes parce qu'elles changent d'un document à l'autre, et d'une langue
 * à l'autre pour la date.
 */
export function documentVariables(
  document: { version: string; effectiveAt: Date },
  locale: string,
): LegalVariables {
  const formatter = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Douala',
  });

  return {
    'document.version': document.version,
    'document.effectiveAt': formatter.format(document.effectiveAt),
  };
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z.]+)\s*\}\}/g;

/**
 * Une ligne dont la valeur a disparu n'apporte plus rien : « RCCM : » suivi de
 * rien est pire qu'une absence. On ne supprime que les lignes purement
 * structurelles — puce vide, libellé sans valeur, ligne de tableau dont toutes
 * les cellules sauf l'intitulé sont vides.
 */
function hasNoRemainingValue(line: string): boolean {
  if (/^\s*[-*]?\s*$/.test(line)) return true;
  if (/^\s*[-*]?\s*\*{0,2}[^:|]{1,60}\*{0,2}\s*:\s*$/.test(line)) return true;

  if (/^\s*\|.*\|\s*$/.test(line)) {
    const cells = line.trim().slice(1, -1).split('|');
    return cells.slice(1).every((cell) => cell.trim() === '');
  }

  return false;
}

/**
 * Remplace les marqueurs et supprime les lignes vidées de leur valeur.
 *
 * Une variable non renseignée — le RCCM tant que la société n'est pas
 * immatriculée — fait disparaître sa ligne entière. Un marqueur inconnu, lui,
 * est laissé tel quel : il vaut mieux qu'il se voie en relecture que de le
 * faire disparaître silencieusement.
 */
export function renderLegalBody(body: string, variables: LegalVariables): string {
  const kept: string[] = [];

  for (const line of body.split('\n')) {
    let emptied = false;

    const rendered = line.replace(PLACEHOLDER, (match, key: string) => {
      const value = variables[key];
      if (value === undefined) return match;
      if (value === '') emptied = true;
      return value;
    });

    if (emptied && hasNoRemainingValue(rendered)) continue;
    kept.push(rendered);
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Marqueurs restés sans valeur : utilisé par un test, pour qu'aucun ne parte en production. */
export function unresolvedPlaceholders(body: string, variables: LegalVariables): string[] {
  const found = new Set<string>();

  for (const match of body.matchAll(PLACEHOLDER)) {
    const key = match[1]!;
    if (variables[key] === undefined) found.add(key);
  }

  return [...found];
}
