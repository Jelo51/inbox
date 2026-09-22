import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/app.js';

const { app, prisma } = buildTestApp();

/**
 * Cette suite s'appuie sur le jeu de démonstration chargé par `pnpm db:seed`.
 * Elle ne crée rien et ne supprime rien : elle vérifie le comportement de la
 * recherche sur des données réalistes.
 */
beforeAll(async () => {
  const published = await prisma.listing.count({ where: { status: 'PUBLISHED' } });
  if (published === 0) {
    throw new Error('Jeu de démonstration absent : lancer `pnpm db:seed` avant les tests.');
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('recherche plein texte', () => {
  it('trouve malgré les accents manquants dans la requête', async () => {
    const avec = await request(app).get('/api/v1/listings').query({ q: 'électronique' });
    const sans = await request(app).get('/api/v1/listings').query({ q: 'electronique' });

    expect(avec.status).toBe(200);
    expect(sans.body.total).toBe(avec.body.total);
    expect(sans.body.total).toBeGreaterThan(0);
  });

  it('applique la racinisation française', async () => {
    // « meublé » et « meublés » doivent ramener le même ensemble.
    const singulier = await request(app).get('/api/v1/listings').query({ q: 'meuble' });
    const pluriel = await request(app).get('/api/v1/listings').query({ q: 'meubles' });

    expect(singulier.body.total).toBe(pluriel.body.total);
  });

  it('classe par pertinence : le titre pèse plus que la description', async () => {
    const res = await request(app).get('/api/v1/listings').query({ q: 'toyota' });

    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0].title.toLowerCase()).toContain('toyota');
  });

  it('ne renvoie rien plutôt que tout quand la requête ne correspond à rien', async () => {
    const res = await request(app).get('/api/v1/listings').query({ q: 'xyzzyqwertyinexistant' });

    expect(res.body.total).toBe(0);
    expect(res.body.items).toEqual([]);
  });
});

describe('filtres', () => {
  it('filtre par ville', async () => {
    const res = await request(app).get('/api/v1/listings').query({ city: 'douala' });

    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) expect(item.citySlug).toBe('douala');
  });

  it('filtre par catégorie', async () => {
    const res = await request(app).get('/api/v1/listings').query({ category: 'vehicules' });

    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) expect(item.categorySlug).toBe('vehicules');
  });

  it('filtre par fourchette de prix', async () => {
    const res = await request(app)
      .get('/api/v1/listings')
      .query({ priceMin: 100000, priceMax: 300000 });

    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.price).toBeGreaterThanOrEqual(100000);
      expect(item.price).toBeLessThanOrEqual(300000);
    }
  });

  it('refuse une fourchette de prix inversée', async () => {
    const res = await request(app)
      .get('/api/v1/listings')
      .query({ priceMin: 300000, priceMax: 100000 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuse une ville inconnue plutôt que de l’ignorer en silence', async () => {
    const res = await request(app).get('/api/v1/listings').query({ city: 'atlantide' });
    expect(res.status).toBe(400);
  });
});

describe('tri', () => {
  it('trie par prix croissant', async () => {
    const res = await request(app).get('/api/v1/listings').query({ sort: 'price_asc', limit: 20 });

    const prix = res.body.items.map((i: { price: number }) => i.price);
    expect(prix).toEqual([...prix].sort((a, b) => a - b));
  });

  it('trie par prix décroissant', async () => {
    const res = await request(app).get('/api/v1/listings').query({ sort: 'price_desc', limit: 20 });

    const prix = res.body.items.map((i: { price: number }) => i.price);
    expect(prix).toEqual([...prix].sort((a, b) => b - a));
  });

  it('fait remonter les annonces PRO à pertinence égale', async () => {
    const res = await request(app).get('/api/v1/listings').query({ limit: 60 });

    const proIndices = res.body.items
      .map((item: { sellerIsPro: boolean }, index: number) => (item.sellerIsPro ? index : -1))
      .filter((i: number) => i >= 0);
    const particulierIndices = res.body.items
      .map((item: { sellerIsPro: boolean }, index: number) => (item.sellerIsPro ? -1 : index))
      .filter((i: number) => i >= 0);

    expect(proIndices.length).toBeGreaterThan(0);
    expect(particulierIndices.length).toBeGreaterThan(0);
    // Sans mot-clé, le tri par défaut place les PRO avant les particuliers.
    expect(Math.max(...proIndices)).toBeLessThan(Math.min(...particulierIndices));
  });
});

describe('pagination par curseur', () => {
  it('enchaîne les pages sans doublon ni saut', async () => {
    const premiere = await request(app).get('/api/v1/listings').query({ limit: 10 });
    expect(premiere.body.items).toHaveLength(10);
    expect(premiere.body.nextCursor).toBeTruthy();
    expect(premiere.body.total).toBeGreaterThan(10);

    const seconde = await request(app)
      .get('/api/v1/listings')
      .query({ limit: 10, cursor: premiere.body.nextCursor });

    const idsPremiere = premiere.body.items.map((i: { id: string }) => i.id);
    const idsSeconde = seconde.body.items.map((i: { id: string }) => i.id);

    expect(idsSeconde.length).toBeGreaterThan(0);
    expect(idsPremiere.some((id: string) => idsSeconde.includes(id))).toBe(false);

    // Le total n'est calculé que sur la première page : il ne bouge pas pendant
    // le défilement et la requête coûte cher.
    expect(seconde.body.total).toBeUndefined();
  });

  it('ignore un curseur illisible plutôt que d’échouer', async () => {
    const res = await request(app)
      .get('/api/v1/listings')
      .query({ limit: 5, cursor: 'curseur-invente' });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('plafonne la taille de page demandée', async () => {
    const res = await request(app).get('/api/v1/listings').query({ limit: 500 });
    expect(res.status).toBe(400);
  });
});

describe('visibilité', () => {
  it('ne renvoie que des annonces publiées', async () => {
    const enAttente = await prisma.listing.count({ where: { status: 'PENDING' } });
    expect(enAttente).toBeGreaterThan(0);

    const res = await request(app).get('/api/v1/listings').query({ limit: 60 });
    const ids = res.body.items.map((i: { id: string }) => i.id);

    const publiees = await prisma.listing.count({
      where: { id: { in: ids }, status: 'PUBLISHED' },
    });
    expect(publiees).toBe(ids.length);
  });
});
