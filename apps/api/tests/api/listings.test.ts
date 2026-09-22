import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { QUOTA } from '@inbox/shared';
import { buildTestApp } from '../helpers/app.js';
import { createVerifiedAccount, testPhoto, type TestAccount } from '../helpers/accounts.js';
import { deleteTestLegalDocuments, deleteTestUsers } from '../helpers/fixtures.js';

const { app, prisma } = buildTestApp();
const EMAIL_MARKER = '@essai-inbox.test';

let vendeur: TestAccount;
let autre: TestAccount;
let photo: Buffer;

async function uploadPhoto(account: TestAccount): Promise<string> {
  const res = await request(app)
    .post('/api/v1/images')
    .set('Authorization', `Bearer ${account.accessToken}`)
    .attach('file', photo, { filename: 'photo.jpg', contentType: 'image/jpeg' });

  if (res.status !== 201) {
    throw new Error(`téléversement en échec : ${res.status} ${JSON.stringify(res.body)}`);
  }
  return (res.body as { image: { id: string } }).image.id;
}

async function createListing(account: TestAccount, overrides: Record<string, unknown> = {}) {
  const imageId = await uploadPhoto(account);
  return request(app)
    .post('/api/v1/listings')
    .set('Authorization', `Bearer ${account.accessToken}`)
    .send({
      title: 'Ordinateur portable Lenovo ThinkPad T480',
      description:
        'ThinkPad T480 en bon état, 16 Go de mémoire et disque SSD de 512 Go. Batterie tenant environ quatre heures. Chargeur fourni.',
      price: 245000,
      categorySlug: 'electronique',
      citySlug: 'douala',
      condition: 'GOOD',
      imageIds: [imageId],
      ...overrides,
    });
}

beforeAll(async () => {
  photo = await testPhoto();
  vendeur = await createVerifiedAccount(app, prisma, { phone: '677889900' });
  autre = await createVerifiedAccount(app, prisma);
});

afterAll(async () => {
  await deleteTestUsers(prisma, EMAIL_MARKER);
  await deleteTestLegalDocuments(prisma);
  await prisma.$disconnect();
});

describe('téléversement de photos', () => {
  it('accepte une photo et renvoie ses URL', async () => {
    const res = await request(app)
      .post('/api/v1/images')
      .set('Authorization', `Bearer ${vendeur.accessToken}`)
      .attach('file', photo, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.image.url).toContain('/media/');
    expect(res.body.image.width).toBe(600);
  });

  it('refuse un fichier qui n’est pas une image, malgré son extension', async () => {
    const res = await request(app)
      .post('/api/v1/images')
      .set('Authorization', `Bearer ${vendeur.accessToken}`)
      .attach('file', Buffer.from('#!/bin/sh\necho compromis'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNSUPPORTED_FORMAT');
  });

  it('refuse un téléversement anonyme', async () => {
    const res = await request(app)
      .post('/api/v1/images')
      .attach('file', photo, { filename: 'photo.jpg' });
    expect(res.status).toBe(401);
  });
});

describe('dépôt d’une annonce', () => {
  it('crée l’annonce en attente de modération, jamais directement en ligne', async () => {
    const res = await createListing(vendeur);

    expect(res.status).toBe(201);
    expect(res.body.listing.status).toBe('PENDING');
    expect(res.body.listing.slug).toBe('ordinateur-portable-lenovo-thinkpad-t480');
  });

  it('refuse une annonce sans photo', async () => {
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${vendeur.accessToken}`)
      .send({
        title: 'Annonce sans photo',
        description: 'Description suffisamment longue pour passer la validation du schéma.',
        price: 1000,
        categorySlug: 'mode',
        citySlug: 'douala',
        imageIds: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details.imageIds[0]).toMatch(/photo/i);
  });

  it('refuse un prix non entier : le FCFA n’a pas de sous-unité', async () => {
    const imageId = await uploadPhoto(vendeur);
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${vendeur.accessToken}`)
      .send({
        title: 'Article au prix étrange',
        description: 'Description suffisamment longue pour passer la validation du schéma.',
        price: 1500.75,
        categorySlug: 'mode',
        citySlug: 'douala',
        imageIds: [imageId],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details.price[0]).toMatch(/entier/);
  });

  it('refuse de s’approprier la photo d’un autre utilisateur', async () => {
    const imageDeAutre = await uploadPhoto(autre);

    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${vendeur.accessToken}`)
      .send({
        title: 'Annonce avec photo volée',
        description: 'Description suffisamment longue pour passer la validation du schéma.',
        price: 5000,
        categorySlug: 'mode',
        citySlug: 'douala',
        imageIds: [imageDeAutre],
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('IMAGE_NOT_OWNED');
  });

  it('exige une adresse e-mail vérifiée', async () => {
    const nonVerifie = await createVerifiedAccount(app, prisma);
    await prisma.user.update({ where: { id: nonVerifie.id }, data: { emailVerifiedAt: null } });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: nonVerifie.email, password: 'Motdepasse-Solide-2026' });

    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({
        title: 'Annonce depuis un compte non vérifié',
        description: 'Description suffisamment longue pour passer la validation du schéma.',
        price: 1000,
        categorySlug: 'mode',
        citySlug: 'douala',
        imageIds: ['inexistant0000000000000'],
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('signale une annonce manifestement frauduleuse sans la refuser', async () => {
    const res = await createListing(vendeur, {
      title: 'Placement sûr, votre argent doublé',
      description:
        'Vous versez un acompte obligatoire avant l’envoi et vous recevez le double sous quinze jours, sans aucun risque. Places limitées.',
    });

    expect(res.status).toBe(201);
    // Elle est publiable : c'est un humain qui tranchera.
    expect(res.body.listing.status).toBe('PENDING');

    const flags = await prisma.moderationFlag.findMany({
      where: { listingId: res.body.listing.id },
    });
    expect(flags.length).toBeGreaterThan(0);
    expect(flags.map((f) => f.rule)).toContain('PROMESSE_RENDEMENT');
  });
});

describe('contrôle d’accès aux annonces', () => {
  it('interdit de modifier l’annonce d’un autre', async () => {
    const created = await createListing(vendeur);

    const res = await request(app)
      .patch(`/api/v1/listings/${created.body.listing.id}`)
      .set('Authorization', `Bearer ${autre.accessToken}`)
      .send({ price: 1 });

    expect(res.status).toBe(403);
  });

  it('interdit de supprimer l’annonce d’un autre', async () => {
    const created = await createListing(vendeur);

    const res = await request(app)
      .delete(`/api/v1/listings/${created.body.listing.id}`)
      .set('Authorization', `Bearer ${autre.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('interdit de renouveler l’annonce d’un autre', async () => {
    const created = await createListing(vendeur);

    const res = await request(app)
      .post(`/api/v1/listings/${created.body.listing.id}/renew`)
      .set('Authorization', `Bearer ${autre.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('cache une annonce non publiée aux autres visiteurs', async () => {
    const created = await createListing(vendeur);
    const id = created.body.listing.id;

    const parLAuteur = await request(app)
      .get(`/api/v1/listings/${id}`)
      .set('Authorization', `Bearer ${vendeur.accessToken}`);
    expect(parLAuteur.status).toBe(200);

    const parUnAutre = await request(app)
      .get(`/api/v1/listings/${id}`)
      .set('Authorization', `Bearer ${autre.accessToken}`);
    expect(parUnAutre.status).toBe(404);

    const anonyme = await request(app).get(`/api/v1/listings/${id}`);
    expect(anonyme.status).toBe(404);
  });
});

describe('cycle de vie', () => {
  it('refuse une transition interdite', async () => {
    const created = await createListing(vendeur);

    // PENDING ne peut pas passer directement à SOLD.
    const res = await request(app)
      .post(`/api/v1/listings/${created.body.listing.id}/status`)
      .set('Authorization', `Bearer ${vendeur.accessToken}`)
      .send({ status: 'SOLD' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('remet une annonce en ligne en modération quand son contenu change', async () => {
    const created = await createListing(vendeur);
    const id = created.body.listing.id;

    await prisma.listing.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    const res = await request(app)
      .patch(`/api/v1/listings/${id}`)
      .set('Authorization', `Bearer ${vendeur.accessToken}`)
      .send({
        description: 'Une description entièrement nouvelle, assez longue pour être valide.',
      });

    expect(res.status).toBe(200);
    expect(res.body.listing.status).toBe('PENDING');
  });

  it('refuse un renouvellement trop précoce', async () => {
    const created = await createListing(vendeur);
    const id = created.body.listing.id;

    await prisma.listing.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 86_400_000),
      },
    });

    const res = await request(app)
      .post(`/api/v1/listings/${id}/renew`)
      .set('Authorization', `Bearer ${vendeur.accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TOO_EARLY');
  });

  it('accepte le renouvellement dans la fenêtre d’échéance', async () => {
    const created = await createListing(vendeur);
    const id = created.body.listing.id;

    await prisma.listing.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 2 * 86_400_000),
      },
    });

    const res = await request(app)
      .post(`/api/v1/listings/${id}/renew`)
      .set('Authorization', `Bearer ${vendeur.accessToken}`);

    expect(res.status).toBe(200);
    expect(new Date(res.body.listing.expiresAt).getTime()).toBeGreaterThan(
      Date.now() + 50 * 86_400_000,
    );
  });
});

describe('quota mensuel', () => {
  it('compte les annonces publiées dans le mois, et non les brouillons', async () => {
    const compte = await createVerifiedAccount(app, prisma);

    const avant = await request(app)
      .get('/api/v1/listings/quota')
      .set('Authorization', `Bearer ${compte.accessToken}`);
    expect(avant.body.quota.limit).toBe(QUOTA.freeListingsPerMonth);
    expect(avant.body.quota.used).toBe(0);

    const created = await createListing(compte);
    // En attente de modération : rien n'est encore publié.
    const pendant = await request(app)
      .get('/api/v1/listings/quota')
      .set('Authorization', `Bearer ${compte.accessToken}`);
    expect(pendant.body.quota.used).toBe(0);

    await prisma.listing.update({
      where: { id: created.body.listing.id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    const apres = await request(app)
      .get('/api/v1/listings/quota')
      .set('Authorization', `Bearer ${compte.accessToken}`);
    expect(apres.body.quota.used).toBe(1);
    expect(apres.body.quota.remaining).toBe(QUOTA.freeListingsPerMonth - 1);
  });

  it('bloque au-delà du quota, et le compteur vient du serveur', async () => {
    const compte = await createVerifiedAccount(app, prisma);
    const imageId = await uploadPhoto(compte);

    // Dix annonces déjà publiées ce mois-ci.
    const categorie = await prisma.category.findFirstOrThrow();
    const ville = await prisma.city.findFirstOrThrow();
    await prisma.listing.createMany({
      data: Array.from({ length: QUOTA.freeListingsPerMonth }, (_, i) => ({
        slug: `quota-${i}`,
        title: `Annonce de remplissage ${i}`,
        description: 'Description suffisamment longue pour passer la validation du schéma.',
        price: 1000,
        sellerId: compte.id,
        categoryId: categorie.id,
        cityId: ville.id,
        status: 'PUBLISHED' as const,
        publishedAt: new Date(),
      })),
    });

    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${compte.accessToken}`)
      .send({
        title: 'Une annonce de trop',
        description: 'Description suffisamment longue pour passer la validation du schéma.',
        price: 1000,
        categorySlug: 'mode',
        citySlug: 'douala',
        imageIds: [imageId],
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('QUOTA_EXCEEDED');
  });

  it('ne plafonne pas un compte PRO', async () => {
    const pro = await createVerifiedAccount(app, prisma, { role: 'PRO' });

    const res = await request(app)
      .get('/api/v1/listings/quota')
      .set('Authorization', `Bearer ${pro.accessToken}`);

    expect(res.body.quota.limit).toBeNull();
    expect(res.body.quota.remaining).toBeNull();
  });
});

describe('affichage du numéro de téléphone', () => {
  it('ne renvoie qu’un aperçu masqué sur la fiche', async () => {
    const created = await createListing(vendeur);
    await prisma.listing.update({
      where: { id: created.body.listing.id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    const res = await request(app).get(`/api/v1/listings/${created.body.listing.id}`);

    expect(res.status).toBe(200);
    expect(res.body.listing.seller.phonePreview).toBe('+237 6•• •• •• 00');
    // Le numéro complet n'apparaît nulle part dans la réponse.
    expect(JSON.stringify(res.body)).not.toContain('677889900');
  });

  it('révèle le numéro sur action explicite, et trace l’affichage', async () => {
    const created = await createListing(vendeur);
    const id = created.body.listing.id;
    await prisma.listing.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    const res = await request(app)
      .post(`/api/v1/listings/${id}/phone`)
      .set('Authorization', `Bearer ${autre.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('677889900');

    const traces = await prisma.phoneReveal.findMany({ where: { listingId: id } });
    expect(traces).toHaveLength(1);
    expect(traces[0]?.viewerId).toBe(autre.id);
  });
});

describe('favoris', () => {
  it('ajoute et retire un favori, et tient le compteur à jour', async () => {
    const created = await createListing(vendeur);
    const id = created.body.listing.id;
    await prisma.listing.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    const ajout = await request(app)
      .put(`/api/v1/listings/${id}/favorite`)
      .set('Authorization', `Bearer ${autre.accessToken}`);
    expect(ajout.body).toEqual({ isFavorite: true, favoriteCount: 1 });

    // Deux clics ne font pas deux favoris.
    const encore = await request(app)
      .put(`/api/v1/listings/${id}/favorite`)
      .set('Authorization', `Bearer ${autre.accessToken}`);
    expect(encore.body.favoriteCount).toBe(1);

    const liste = await request(app)
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${autre.accessToken}`);
    expect(liste.body.items.map((i: { id: string }) => i.id)).toContain(id);

    const retrait = await request(app)
      .delete(`/api/v1/listings/${id}/favorite`)
      .set('Authorization', `Bearer ${autre.accessToken}`);
    expect(retrait.body).toEqual({ isFavorite: false, favoriteCount: 0 });
  });
});

describe('compteur de vues', () => {
  it('ne compte qu’une fois par session et par jour', async () => {
    const created = await createListing(vendeur);
    const id = created.body.listing.id;
    await prisma.listing.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), viewCount: 0 },
    });

    await request(app).get(`/api/v1/listings/${id}?sid=session-a`);
    await request(app).get(`/api/v1/listings/${id}?sid=session-a`);
    await request(app).get(`/api/v1/listings/${id}?sid=session-b`);

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id } });
    expect(listing.viewCount).toBe(2);
  });

  it('ne compte pas les visites de l’auteur sur sa propre annonce', async () => {
    const created = await createListing(vendeur);
    const id = created.body.listing.id;
    await prisma.listing.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), viewCount: 0 },
    });

    await request(app)
      .get(`/api/v1/listings/${id}?sid=auteur`)
      .set('Authorization', `Bearer ${vendeur.accessToken}`);

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id } });
    expect(listing.viewCount).toBe(0);
  });
});
