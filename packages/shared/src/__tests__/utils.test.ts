import { describe, expect, it } from 'vitest';
import { formatPrice, formatPriceWithUnit } from '../utils/money.js';
import { formatPhone, maskPhone, normalizePhone } from '../utils/phone.js';
import { buildListingPath, extractIdFromSlug, slugify } from '../utils/slug.js';
import { startOfMonthDouala } from '../utils/clock.js';
import { maskEmail, truncateIp } from '../utils/privacy.js';

/** L'espace de groupement de `fr-FR` est une espace insécable étroite (U+202F). */
const NNBSP = ' ';

describe('formatage des montants', () => {
  it('formate en FCFA avec séparateur de milliers', () => {
    expect(formatPrice(385000)).toBe(`385${NNBSP}000 FCFA`);
    expect(formatPrice(0)).toBe('0 FCFA');
    expect(formatPrice(7500)).toBe(`7${NNBSP}500 FCFA`);
  });

  it('ajoute l’unité de prix dans la langue demandée', () => {
    expect(formatPriceWithUnit(120000, 'PER_MONTH', 'fr')).toBe(`120${NNBSP}000 FCFA /mois`);
    expect(formatPriceWithUnit(120000, 'PER_MONTH', 'en')).toBe(`120${NNBSP}000 FCFA /month`);
    expect(formatPriceWithUnit(120000, 'NONE')).toBe(`120${NNBSP}000 FCFA`);
  });

  it('refuse un montant non fini', () => {
    expect(() => formatPrice(Number.NaN)).toThrow(TypeError);
  });
});

describe('numéros camerounais', () => {
  it('normalise les écritures courantes', () => {
    expect(normalizePhone('+237 677 12 34 56')).toBe('677123456');
    expect(normalizePhone('677123456')).toBe('677123456');
    expect(normalizePhone('237677123456')).toBe('677123456');
  });

  it('rejette un numéro qui n’est pas un mobile camerounais', () => {
    expect(normalizePhone('+33 6 12 34 56 78')).toBeNull();
    expect(normalizePhone('277123456')).toBeNull();
    expect(normalizePhone('67712345')).toBeNull();
  });

  it('formate et masque', () => {
    expect(formatPhone('677123456')).toBe('+237 677 12 34 56');
    expect(maskPhone('677123456')).toBe('+237 6•• •• •• 56');
  });
});

describe('slugs', () => {
  it('retire les accents et la ponctuation', () => {
    expect(slugify('Téléphone Samsung — état neuf !')).toBe('telephone-samsung-etat-neuf');
  });

  it('tronque sans couper un mot en deux', () => {
    const s = slugify('appartement meuble tres lumineux au centre ville de douala bonapriso', 40);
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith('-')).toBe(false);
  });

  it('retombe sur une valeur utilisable si le titre ne donne rien', () => {
    expect(slugify('!!!')).toBe('annonce');
  });

  it('retrouve l’identifiant dans l’URL', () => {
    const path = buildListingPath('iphone-13-pro', 'clx9k2p0000008l3h4f5g6h7');
    expect(path).toBe('/annonce/iphone-13-pro-clx9k2p0000008l3h4f5g6h7');
    expect(extractIdFromSlug('iphone-13-pro-clx9k2p0000008l3h4f5g6h7')).toBe(
      'clx9k2p0000008l3h4f5g6h7',
    );
  });
});

describe('quota mensuel', () => {
  it('cale le début de mois sur le fuseau de Douala, pas sur UTC', () => {
    // 1er mars 00:30 à Douala (UTC+1) = 28 février 23:30 UTC : le mois a bien basculé.
    const start = startOfMonthDouala(new Date('2026-02-28T23:30:00Z'));
    expect(start.toISOString()).toBe('2026-02-28T23:00:00.000Z');
  });

  it('ne bascule pas avant minuit à Douala', () => {
    const start = startOfMonthDouala(new Date('2026-02-28T22:30:00Z'));
    expect(start.toISOString()).toBe('2026-01-31T23:00:00.000Z');
  });
});

describe('minimisation des données', () => {
  it('tronque les adresses IPv4 au /24', () => {
    expect(truncateIp('196.29.177.42')).toBe('196.29.177.0');
    expect(truncateIp('::ffff:196.29.177.42')).toBe('196.29.177.0');
  });

  it('tronque les adresses IPv6 au /48', () => {
    expect(truncateIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3::');
  });

  it('renvoie null sur une entrée inexploitable', () => {
    expect(truncateIp(undefined)).toBeNull();
    expect(truncateIp('pas-une-ip')).toBeNull();
  });

  it('masque une adresse e-mail pour le back-office', () => {
    expect(maskEmail('flavien@example.cm')).toBe('f•••••n@example.cm');
  });
});
