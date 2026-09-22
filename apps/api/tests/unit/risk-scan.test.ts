import { describe, expect, it } from 'vitest';
import { riskScore, scanForRisk } from '../../src/modules/moderation/risk-scan.js';
import { DEMO_LISTINGS } from '../../prisma/seed/listings-data.js';

describe('repérage automatique des annonces à risque', () => {
  it('repère une promesse de rendement garanti', () => {
    const matches = scanForRisk(
      'Placement sûr',
      'Vous versez un acompte et vous recevez le double sous quinze jours, sans aucun risque.',
    );
    expect(matches.map((m) => m.rule)).toContain('PROMESSE_RENDEMENT');
    expect(riskScore(matches)).toBeGreaterThanOrEqual(3);
  });

  it('ignore les accents et la casse', () => {
    const avec = scanForRisk('Offre', 'Votre argent doublé en quinze jours');
    const sans = scanForRisk('Offre', 'VOTRE ARGENT DOUBLE EN QUINZE JOURS');
    expect(avec.map((m) => m.rule)).toEqual(sans.map((m) => m.rule));
    expect(avec.length).toBeGreaterThan(0);
  });

  it('repère l’acompte exigé sans rencontre possible', () => {
    const matches = scanForRisk(
      'Téléphone neuf',
      "Paiement d'un acompte obligatoire avant l'envoi. Pas de rencontre possible.",
    );
    expect(matches.map((m) => m.rule)).toContain('ACOMPTE_AVANT_RENCONTRE');
  });

  it('repère un numéro de téléphone glissé dans la description', () => {
    const matches = scanForRisk(
      'Vends vélo',
      'Contactez-moi au 677 12 34 56 pour aller plus vite.',
    );
    expect(matches.map((m) => m.rule)).toContain('HORS_PLATEFORME');
  });

  it('ne signale aucune des annonces légitimes du jeu de démonstration', () => {
    const signalees = DEMO_LISTINGS.filter(
      (listing) => scanForRisk(listing.title, listing.description).length > 0,
    ).map((l) => l.title);

    // Un filtre qui crie au loup sur des annonces normales serait ignoré par
    // les modérateurs : le taux de faux positifs fait partie du contrat.
    expect(signalees).toEqual([]);
  });

  it('ne décide rien : il renvoie des indices, pas un verdict', () => {
    const matches = scanForRisk('Vends table', 'Table en bois, bon état.');
    expect(matches).toEqual([]);
    expect(riskScore(matches)).toBe(0);
  });
});
