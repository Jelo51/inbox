import { describe, expect, it } from 'vitest';
import {
  buildBackup,
  fingerprintOf,
  generateIdentity,
  open,
  restoreBackup,
  seal,
  toBase64,
} from '../../app/utils/e2ee';

/**
 * Ces tests portent sur la promesse centrale du produit : ce que le serveur
 * transporte, il ne peut pas l'ouvrir. Ils vérifient aussi que le format de
 * sauvegarde produit ici est exactement celui que l'API sait relire — les deux
 * implémentations doivent rester d'accord.
 */

const MESSAGE = 'Rendez-vous samedi 10h devant la pharmacie, j apporte 250 000 FCFA';

describe('empreinte de clé', () => {
  it('produit huit groupes de quatre caractères hexadécimaux', () => {
    const identity = generateIdentity();
    expect(identity.fingerprint).toMatch(/^[0-9A-F]{4}( [0-9A-F]{4}){7}$/);
  });

  it('est déterministe et propre à chaque clé', () => {
    const a = generateIdentity();
    const b = generateIdentity();

    expect(fingerprintOf(a.publicKey)).toBe(a.fingerprint);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });
});

describe('chiffrement des messages', () => {
  it('le destinataire ouvre le message, personne d’autre', () => {
    const alice = generateIdentity();
    const bob = generateIdentity();
    const intrus = generateIdentity();

    const boite = seal(MESSAGE, bob.publicKey, alice.secretKey);

    expect(open(boite, alice.publicKey, bob.secretKey)).toBe(MESSAGE);
    expect(open(boite, alice.publicKey, intrus.secretKey)).toBeNull();
  });

  it('le chiffré ne laisse rien filtrer du clair', () => {
    const alice = generateIdentity();
    const bob = generateIdentity();
    const boite = seal(MESSAGE, bob.publicKey, alice.secretKey);

    expect(boite.ciphertext).not.toContain('pharmacie');
    expect(boite.ciphertext).not.toContain(MESSAGE);
    // Deux chiffrés du même texte diffèrent : le nonce est tiré au sort.
    const encore = seal(MESSAGE, bob.publicKey, alice.secretKey);
    expect(encore.ciphertext).not.toBe(boite.ciphertext);
  });

  it('refuse un message altéré au lieu de renvoyer n’importe quoi', () => {
    const alice = generateIdentity();
    const bob = generateIdentity();
    const boite = seal(MESSAGE, bob.publicKey, alice.secretKey);

    const falsifie = {
      ...boite,
      ciphertext:
        boite.ciphertext.slice(0, -4) + (boite.ciphertext.endsWith('AAAA') ? 'BBBB' : 'AAAA'),
    };

    expect(open(falsifie, alice.publicKey, bob.secretKey)).toBeNull();
  });

  it('l’expéditeur relit son propre message grâce à la copie qui lui est destinée', () => {
    const alice = generateIdentity();
    const bob = generateIdentity();

    const pourBob = seal(MESSAGE, bob.publicKey, alice.secretKey);
    const pourMoi = seal(MESSAGE, alice.publicKey, alice.secretKey);

    expect(open(pourBob, alice.publicKey, bob.secretKey)).toBe(MESSAGE);
    expect(open(pourMoi, alice.publicKey, alice.secretKey)).toBe(MESSAGE);
  });
});

describe('sauvegarde de la clé privée', () => {
  it('restaure la clé avec la bonne phrase secrète', () => {
    const identity = generateIdentity();
    const backup = buildBackup(identity, 'une phrase secrete assez longue 2026');

    const restaure = restoreBackup(backup, 'une phrase secrete assez longue 2026');
    expect(restaure).not.toBeNull();
    expect(toBase64(restaure!)).toBe(toBase64(identity.secretKey));
  });

  it('échoue silencieusement avec une mauvaise phrase, sans indice exploitable', () => {
    const identity = generateIdentity();
    const backup = buildBackup(identity, 'la bonne phrase secrete 2026');

    expect(restoreBackup(backup, 'la mauvaise phrase secrete 2026')).toBeNull();
  });

  it('ne laisse pas la clé privée apparaître dans le blob', () => {
    const identity = generateIdentity();
    const backup = buildBackup(identity, 'phrase secrete de test 2026');

    const serialise = JSON.stringify(backup);
    expect(serialise).not.toContain(toBase64(identity.secretKey));
  });

  it('annonce des paramètres de dérivation conformes à ceux acceptés par l’API', () => {
    const backup = buildBackup(generateIdentity(), 'phrase secrete de test 2026');

    expect(backup.kdf).toBe('argon2id');
    // Les bornes du schéma Zod côté serveur : au moins 19 Mio et deux passes.
    expect(backup.kdfParams.memoryKiB).toBeGreaterThanOrEqual(19456);
    expect(backup.kdfParams.iterations).toBeGreaterThanOrEqual(2);
    expect(backup.kdfParams.parallelism).toBeGreaterThanOrEqual(1);
  });

  it('deux sauvegardes de la même clé diffèrent : le sel est tiré au sort', () => {
    const identity = generateIdentity();
    const a = buildBackup(identity, 'meme phrase secrete 2026');
    const b = buildBackup(identity, 'meme phrase secrete 2026');

    expect(a.salt).not.toBe(b.salt);
    expect(a.encryptedPrivateKey).not.toBe(b.encryptedPrivateKey);
    // Et pourtant les deux se restaurent.
    expect(restoreBackup(a, 'meme phrase secrete 2026')).not.toBeNull();
    expect(restoreBackup(b, 'meme phrase secrete 2026')).not.toBeNull();
  });
});
