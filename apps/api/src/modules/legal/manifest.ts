import type { LegalDocumentType, Locale } from '@inbox/shared';
import { LEGAL_DOCUMENT_SLUGS } from '@inbox/shared';

/**
 * Les quatorze documents légaux : sept textes, deux langues.
 *
 * Le corps vit dans les fichiers Markdown voisins, pas dans ce fichier : un
 * texte juridique se relit, se compare et se fait relire par un juriste, ce
 * qu'un littéral TypeScript rend pénible.
 *
 * Le titre est ici et non dans le Markdown parce qu'il sert aussi à l'écran de
 * réacceptation et aux courriers, où l'on n'affiche pas le corps.
 */
export interface LegalDocumentEntry {
  type: LegalDocumentType;
  locale: Locale;
  /** Nom du fichier Markdown, relatif à ce dossier. */
  file: string;
  version: string;
  title: string;
  /**
   * Seuls les CGU et la politique de confidentialité sont soumis à
   * acceptation : les autres s'imposent sans qu'on ait à les faire signer.
   */
  requiresAcceptance: boolean;
}

interface DocumentDefinition {
  type: LegalDocumentType;
  version: string;
  requiresAcceptance: boolean;
  titles: Record<Locale, string>;
}

const DEFINITIONS: DocumentDefinition[] = [
  {
    type: 'MENTIONS_LEGALES',
    version: '1.0',
    requiresAcceptance: false,
    titles: { fr: 'Mentions légales', en: 'Legal notice' },
  },
  {
    type: 'CGU',
    version: '1.0',
    requiresAcceptance: true,
    titles: { fr: "Conditions générales d'utilisation", en: 'Terms of use' },
  },
  {
    type: 'CGV',
    version: '1.0',
    requiresAcceptance: false,
    titles: { fr: 'Conditions générales de vente', en: 'Terms of sale' },
  },
  {
    type: 'CONFIDENTIALITE',
    version: '1.0',
    requiresAcceptance: true,
    titles: { fr: 'Politique de confidentialité', en: 'Privacy policy' },
  },
  {
    type: 'COOKIES',
    version: '1.0',
    requiresAcceptance: false,
    titles: { fr: 'Politique relative aux cookies', en: 'Cookie policy' },
  },
  {
    type: 'REGLES_PUBLICATION',
    version: '1.0',
    requiresAcceptance: false,
    titles: { fr: 'Règles de publication', en: 'Publication rules' },
  },
  {
    type: 'CONSEILS_SECURITE',
    version: '1.0',
    requiresAcceptance: false,
    titles: { fr: 'Conseils de sécurité', en: 'Safety advice' },
  },
];

export const LEGAL_DOCUMENT_MANIFEST: LegalDocumentEntry[] = DEFINITIONS.flatMap((definition) =>
  (['fr', 'en'] as const).map((locale) => ({
    type: definition.type,
    locale,
    file: `${LEGAL_DOCUMENT_SLUGS[definition.type]}.${locale}.md`,
    version: definition.version,
    title: definition.titles[locale],
    requiresAcceptance: definition.requiresAcceptance,
  })),
);
