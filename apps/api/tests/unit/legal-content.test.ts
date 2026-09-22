import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { LEGAL_DOCUMENT_MANIFEST } from '../../src/modules/legal/manifest.js';
import {
  documentVariables,
  renderLegalBody,
  unresolvedPlaceholders,
} from '../../src/modules/legal/variables.js';

/**
 * Les quatorze textes sont du contenu, pas du code — mais ils partent en
 * production, et une faute s'y voit autant qu'ailleurs. Ces vérifications
 * portent sur ce qu'une relecture humaine laisse passer.
 */

const CONTENT_DIR = new URL('../../legal/', import.meta.url);

async function bodyOf(file: string): Promise<string> {
  return readFile(new URL(file, CONTENT_DIR), 'utf8');
}

/** Valeurs complètes : sert à vérifier qu'aucun marqueur n'est inconnu. */
const VARIABLES: Record<string, string> = {
  'editeur.nom': 'Éditeur Essai',
  'editeur.formeJuridique': '',
  'editeur.capital': '',
  'editeur.rccm': '',
  'editeur.niu': '',
  'editeur.adresse': '1 rue Essai, Douala',
  'editeur.email': 'contact@essai.test',
  'editeur.telephone': '',
  'editeur.qualite': 'personne physique',
  directeurPublication: 'Directeur Essai',
  'contact.donnees': 'donnees@essai.test',
  'contact.abus': 'abus@essai.test',
  'contact.general': 'contact@essai.test',
  'dpo.nom': '',
  'dpo.email': '',
  'hebergeur.nom': 'Hébergeur Essai',
  'hebergeur.adresse': '2 rue Essai, Roubaix',
  'hebergeur.pays': 'France',
  'hebergeur.site': 'https://essai.test',
  'site.nom': 'Inbox',
  'site.domaine': 'inbox.cm',
  'site.url': 'https://inbox.cm',
  'offre.prix': '7 500 FCFA',
  'offre.periode': '30 jours',
  'offre.tva': '',
};

describe('documents légaux', () => {
  it('le manifeste couvre les sept documents dans les deux langues', () => {
    expect(LEGAL_DOCUMENT_MANIFEST).toHaveLength(14);
    expect(new Set(LEGAL_DOCUMENT_MANIFEST.map((entry) => entry.type)).size).toBe(7);
  });

  it('chaque entrée du manifeste a son fichier, et aucun fichier n’est orphelin', async () => {
    const files = (await readdir(CONTENT_DIR)).filter((name) => name.endsWith('.md')).sort();
    expect(files).toEqual(LEGAL_DOCUMENT_MANIFEST.map((entry) => entry.file).sort());
  });

  it('n’emploie aucun marqueur sans valeur', async () => {
    for (const entry of LEGAL_DOCUMENT_MANIFEST) {
      const body = await bodyOf(entry.file);
      const variables = {
        ...VARIABLES,
        ...documentVariables({ version: entry.version, effectiveAt: new Date() }, entry.locale),
      };
      expect(unresolvedPlaceholders(body, variables), entry.file).toEqual([]);
    }
  });

  it('ne laisse aucun marqueur dans le texte rendu', async () => {
    for (const entry of LEGAL_DOCUMENT_MANIFEST) {
      const body = await bodyOf(entry.file);
      const rendered = renderLegalBody(body, {
        ...VARIABLES,
        ...documentVariables({ version: entry.version, effectiveAt: new Date() }, entry.locale),
      });
      expect(rendered, entry.file).not.toMatch(/\{\{/);
    }
  });

  // La règle vaut pour toute l'interface : elle vaut a fortiori pour un texte
  // qui peut être produit devant un juge.
  it('ne contient aucun emoji', async () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const entry of LEGAL_DOCUMENT_MANIFEST) {
      expect(emoji.test(await bodyOf(entry.file)), entry.file).toBe(false);
    }
  });

  it('ne contient aucun marqueur de rédaction inachevée', async () => {
    for (const entry of LEGAL_DOCUMENT_MANIFEST) {
      const body = await bodyOf(entry.file);
      expect(body, entry.file).not.toMatch(/À COMPLÉTER|TODO|Lorem ipsum|XXX/i);
    }
  });

  it('les versions anglaises portent la clause de prévalence du français', async () => {
    for (const entry of LEGAL_DOCUMENT_MANIFEST.filter((e) => e.locale === 'en')) {
      expect(await bodyOf(entry.file), entry.file).toMatch(/French\s+version\s+prevails/);
    }
  });
});

describe('rendu des variables', () => {
  it('fait disparaître la ligne d’une valeur absente plutôt que de laisser le libellé', () => {
    const rendered = renderLegalBody(
      [
        '- **{{editeur.nom}}**',
        '- RCCM : {{editeur.rccm}}',
        '- Adresse : {{editeur.adresse}}',
      ].join('\n'),
      VARIABLES,
    );

    expect(rendered).toContain('Éditeur Essai');
    expect(rendered).toContain('1 rue Essai, Douala');
    expect(rendered).not.toContain('RCCM');
  });

  it('vide aussi une ligne de tableau dont la seule valeur a disparu', () => {
    const rendered = renderLegalBody(
      ['| Objet | Adresse |', '| --- | --- |', '| Délégué | {{dpo.email}} |'].join('\n'),
      VARIABLES,
    );

    expect(rendered).not.toContain('Délégué');
  });

  it('laisse en place un marqueur inconnu, pour qu’il se voie', () => {
    expect(renderLegalBody('Valeur : {{inconnu.marqueur}}', VARIABLES)).toContain(
      '{{inconnu.marqueur}}',
    );
  });

  it('formate la date d’effet dans la langue du document', () => {
    const at = new Date('2026-09-22T12:00:00Z');
    expect(
      documentVariables({ version: '1.0', effectiveAt: at }, 'fr')['document.effectiveAt'],
    ).toBe('22 septembre 2026');
    expect(
      documentVariables({ version: '1.0', effectiveAt: at }, 'en')['document.effectiveAt'],
    ).toBe('22 September 2026');
  });
});
