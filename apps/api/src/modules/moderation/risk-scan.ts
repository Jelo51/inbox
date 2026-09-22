/**
 * Repérage automatique à la soumission d'une annonce.
 *
 * Ce filtre SIGNALE, il ne DÉCIDE pas : une annonce repérée reste en attente et
 * remonte en tête de la file de modération, où un humain tranche. Refuser
 * automatiquement sur la foi de quelques mots-clés produirait des refus
 * injustes que personne ne relirait.
 */

export interface RiskRule {
  /** Identifiant stable, stocké en base et affiché au modérateur. */
  id: string;
  label: string;
  /** 1 = à regarder, 2 = suspect, 3 = très probablement interdit. */
  severity: 1 | 2 | 3;
  patterns: RegExp[];
}

/**
 * Les expressions sont écrites sans accent et comparées sur un texte normalisé,
 * pour qu'« argent double » attrape aussi « argent doublé ».
 */
export const RISK_RULES: readonly RiskRule[] = [
  {
    id: 'PROMESSE_RENDEMENT',
    label: 'Promesse de gain ou de rendement garanti',
    severity: 3,
    patterns: [
      /\bargent\s+double\b/,
      /\bdouble[rz]?\s+(votre|ton|son)\s+argent\b/,
      /\brendement\s+garanti\b/,
      /\bgain\s+garanti\b/,
      /\b100\s*%\s*garanti\b/,
      /\bsans\s+aucun\s+risque\b/,
      /\bplacement\s+s[ûu]r\b/,
      /\bdouble\s+your\s+money\b/,
      /\bguaranteed\s+(returns?|profit)\b/,
    ],
  },
  {
    id: 'ACOMPTE_AVANT_RENCONTRE',
    label: 'Acompte exigé avant toute rencontre ou vérification',
    severity: 2,
    patterns: [
      /\bacompte\s+(obligatoire|avant)\b/,
      /\bavance\s+obligatoire\b/,
      /\bpaiement\s+avant\s+(envoi|livraison|rencontre)\b/,
      /\bpas\s+de\s+(rencontre|test)\s+(possible|avant)\b/,
      /\bfrais\s+de\s+(dossier|reservation)\b/,
      /\bupfront\s+payment\b/,
    ],
  },
  {
    id: 'PRODUIT_INTERDIT',
    label: 'Produit possiblement interdit à la vente',
    severity: 3,
    patterns: [
      /\barme\s+(a\s+feu|blanche)\b/,
      /\bmunitions?\b/,
      /\bivoire\b/,
      /\becaille\s+de\s+pangolin\b/,
      /\bpeau\s+de\s+(leopard|panthere)\b/,
      /\bmedicament(s)?\s+(sans\s+ordonnance|contrefait)/,
      /\bviagra\b/,
      /\btramadol\b/,
      /\bchanvre\b/,
      /\bcocaine\b/,
      /\bpasseport\b/,
      /\bcarte\s+nationale\s+d.identite\b/,
      /\bdiplome\s+(vierge|sur\s+mesure)\b/,
      /\bfaux\s+(papiers|documents)\b/,
    ],
  },
  {
    id: 'CONTREFACON',
    label: 'Contrefaçon possible',
    severity: 2,
    patterns: [
      /\b(premiere|1ere)\s+copie\b/,
      /\bcopie\s+conforme\s+de\s+marque\b/,
      /\bimitation\s+parfaite\b/,
      /\breplica\b/,
    ],
  },
  {
    id: 'PRIX_INVRAISEMBLABLE',
    label: 'Formulation typique des prix invraisemblables',
    severity: 2,
    patterns: [
      /\bprix\s+imbattable\b/,
      /\bdedouanement\s+non\s+effectue\b/,
      /\bvenant\s+de\s+l.etranger\b.*\bacompte\b/,
      /\bdouane\s+bloquee?\b/,
    ],
  },
  {
    id: 'HORS_PLATEFORME',
    label: 'Invitation à quitter la messagerie Inbox',
    severity: 1,
    patterns: [
      /\bwhatsapp\b/,
      /\btelegram\b/,
      /\bappelez[- ]moi\s+au\b/,
      /\bcontactez[- ]moi\s+au\s+\+?\d/,
      /\b6\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}\b/,
    ],
  },
  {
    id: 'URGENCE_ARTIFICIELLE',
    label: 'Pression à la décision immédiate',
    severity: 1,
    patterns: [
      /\bplaces\s+limitees\b/,
      /\bderniere\s+chance\b/,
      /\boffre\s+valable\s+aujourd.hui\s+seulement\b/,
    ],
  },
];

export interface RiskMatch {
  rule: string;
  label: string;
  severity: 1 | 2 | 3;
  /** Extrait du texte qui a déclenché la règle, pour le modérateur. */
  matchedOn: string;
}

/** Minuscules, accents retirés, apostrophes typographiques uniformisées. */
export function normalizeForScan(input: string): string {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`]/g, "'").toLowerCase();
}

export function scanForRisk(title: string, description: string): RiskMatch[] {
  const haystack = normalizeForScan(`${title}\n${description}`);
  const matches: RiskMatch[] = [];

  for (const rule of RISK_RULES) {
    for (const pattern of rule.patterns) {
      const found = haystack.match(pattern);
      if (!found) continue;
      matches.push({
        rule: rule.id,
        label: rule.label,
        severity: rule.severity,
        matchedOn: found[0].slice(0, 200),
      });
      break; // Une seule occurrence par règle suffit à signaler.
    }
  }

  return matches.sort((a, b) => b.severity - a.severity);
}

/** Score agrégé, utilisé pour ordonner la file de modération. */
export function riskScore(matches: RiskMatch[]): number {
  return matches.reduce((total, m) => total + m.severity, 0);
}
