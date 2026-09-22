import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/app.js';
import { createVerifiedAccount, testPhoto, type TestAccount } from '../helpers/accounts.js';
import { deleteTestLegalDocuments, deleteTestUsers } from '../helpers/fixtures.js';

const { app, prisma, transport } = buildTestApp();
const EMAIL_MARKER = '@essai-inbox.test';

let moderateur: TestAccount;
let admin: TestAccount;
let vendeur: TestAccount;
let particulier: TestAccount;
let photo: Buffer;

/** Dépose une annonce en attente de modération. */
async function submitListing(account: TestAccount, overrides: Record<string, unknown> = {}) {
  const upload = await request(app)
    .post('/api/v1/images')
    .set('Authorization', `Bearer ${account.accessToken}`)
    .attach('file', photo, { filename: 'p.jpg', contentType: 'image/jpeg' });

  const res = await request(app)
    .post('/api/v1/listings')
    .set('Authorization', `Bearer ${account.accessToken}`)
    .send({
      title: 'Ordinateur portable Dell Latitude 5490',
      description:
        'Dell Latitude 5490 en bon état, 16 Go de mémoire, disque SSD de 512 Go, chargeur fourni.',
      price: 210000,
      categorySlug: 'electronique',
      citySlug: 'douala',
      imageIds: [upload.body.image.id],
      ...overrides,
    });

  return res.body.listing.id as string;
}

beforeAll(async () => {
  photo = await testPhoto();
  moderateur = await createVerifiedAccount(app, prisma, { role: 'MODERATOR' });
  admin = await createVerifiedAccount(app, prisma, { role: 'ADMIN' });
  vendeur = await createVerifiedAccount(app, prisma, { displayName: 'Vendeur Essai' });
  particulier = await createVerifiedAccount(app, prisma);
});

beforeEach(() => {
  transport.clear();
});

afterAll(async () => {
  // Le journal d'audit n'est volontairement pas nettoyé : la base refuse de
  // supprimer une entrée avant la fin de sa durée de conservation. Les entrées
  // de test survivent donc à leurs auteurs, dont l'identifiant passe à null —
  // c'est le comportement attendu en production, pas un effet de bord.
  await deleteTestUsers(prisma, EMAIL_MARKER);
  await deleteTestLegalDocuments(prisma);
  await prisma.$disconnect();
});

describe('accès au back-office', () => {
  const routes = [
    ['get', '/api/v1/admin/stats'],
    ['get', '/api/v1/admin/moderation/queue'],
    ['get', '/api/v1/admin/reports'],
    ['get', '/api/v1/admin/users'],
    ['get', '/api/v1/admin/audit'],
  ] as const;

  it.each(routes)('refuse %s %s à un visiteur anonyme', async (method, route) => {
    const res = await request(app)[method](route);
    expect(res.status).toBe(401);
  });

  it.each(routes)('refuse %s %s à un compte particulier', async (method, route) => {
    const res = await request(app)
      [method](route)
      .set('Authorization', `Bearer ${particulier.accessToken}`);
    expect(res.status).toBe(403);
  });

  it.each(routes)('accepte %s %s pour un modérateur', async (method, route) => {
    const res = await request(app)
      [method](route)
      .set('Authorization', `Bearer ${moderateur.accessToken}`);
    expect(res.status).toBe(200);
  });

  it('refuse les routes réservées aux administrateurs à un modérateur', async () => {
    const paiements = await request(app)
      .get('/api/v1/admin/payments')
      .set('Authorization', `Bearer ${moderateur.accessToken}`);
    expect(paiements.status).toBe(403);

    const revenus = await request(app)
      .get('/api/v1/admin/stats/revenue')
      .set('Authorization', `Bearer ${moderateur.accessToken}`);
    expect(revenus.status).toBe(403);
  });

  it('accepte ces mêmes routes pour un administrateur', async () => {
    const res = await request(app)
      .get('/api/v1/admin/payments')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
  });

  it('refuse un compte Pro, qui n’est pas un rôle de modération', async () => {
    const pro = await createVerifiedAccount(app, prisma, { role: 'PRO' });
    const res = await request(app)
      .get('/api/v1/admin/moderation/queue')
      .set('Authorization', `Bearer ${pro.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('file de modération', () => {
  it('place les annonces repérées par le filtre automatique en tête', async () => {
    await submitListing(vendeur);
    await submitListing(vendeur, {
      title: 'Placement sûr, votre argent doublé en 15 jours',
      description:
        'Vous versez un acompte obligatoire avant l’envoi, et vous recevez le double sous quinze jours, sans aucun risque.',
    });

    const res = await request(app)
      .get('/api/v1/admin/moderation/queue')
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .query({ limit: 50 });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0].riskScore).toBeGreaterThan(0);
    expect(res.body.items[0].flags.map((f: { rule: string }) => f.rule)).toContain(
      'PROMESSE_RENDEMENT',
    );
  });

  it('donne au modérateur le contexte du vendeur', async () => {
    const res = await request(app)
      .get('/api/v1/admin/moderation/queue')
      .set('Authorization', `Bearer ${moderateur.accessToken}`);

    const item = res.body.items[0];
    expect(item.seller).toMatchObject({ displayName: expect.any(String) });
    expect(typeof item.seller.listingCount).toBe('number');
    expect(typeof item.seller.reportCount).toBe('number');
  });
});

describe('décision de modération', () => {
  it('publie l’annonce, prévient l’auteur et inscrit la décision au journal', async () => {
    const listingId = await submitListing(vendeur);

    const res = await request(app)
      .post(`/api/v1/admin/moderation/listings/${listingId}`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({ decision: 'APPROVE' });

    expect(res.status).toBe(200);
    expect(res.body.listing.status).toBe('PUBLISHED');

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.publishedAt).not.toBeNull();
    expect(listing.expiresAt).not.toBeNull();
    expect(listing.moderatedById).toBe(moderateur.id);

    expect(transport.lastTo(vendeur.email)?.subject).toMatch(/en ligne/i);

    const audit = await prisma.auditLog.findFirst({
      where: { targetId: listingId, action: 'LISTING_APPROVED' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(moderateur.id);
  });

  it('exige un motif pour refuser', async () => {
    const listingId = await submitListing(vendeur);

    const res = await request(app)
      .post(`/api/v1/admin/moderation/listings/${listingId}`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({ decision: 'REJECT' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuse un motif hors de la liste', async () => {
    const listingId = await submitListing(vendeur);

    const res = await request(app)
      .post(`/api/v1/admin/moderation/listings/${listingId}`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({ decision: 'REJECT', reason: 'PARCE_QUE' });

    expect(res.status).toBe(400);
  });

  it('refuse l’annonce et transmet le motif à l’auteur', async () => {
    const listingId = await submitListing(vendeur);

    const res = await request(app)
      .post(`/api/v1/admin/moderation/listings/${listingId}`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({
        decision: 'REJECT',
        reason: 'SUSPECTED_SCAM',
        note: 'Acompte exigé avant rencontre',
      });

    expect(res.status).toBe(200);
    expect(res.body.listing.status).toBe('REJECTED');

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.rejectionReason).toBe('SUSPECTED_SCAM');
    expect(listing.rejectionNote).toBe('Acompte exigé avant rencontre');

    // L'auteur reçoit le motif, en clair : sans lui, il resoumettra à l'identique.
    const message = transport.lastTo(vendeur.email);
    expect(message?.text).toMatch(/arnaque/i);
    expect(message?.text).toContain('Acompte exigé avant rencontre');

    const audit = await prisma.auditLog.findFirst({
      where: { targetId: listingId, action: 'LISTING_REJECTED' },
    });
    expect(audit?.reason).toBe('SUSPECTED_SCAM');
  });

  it('empêche deux modérateurs de trancher la même annonce', async () => {
    const listingId = await submitListing(vendeur);

    const premiere = await request(app)
      .post(`/api/v1/admin/moderation/listings/${listingId}`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({ decision: 'APPROVE' });
    expect(premiere.status).toBe(200);

    const seconde = await request(app)
      .post(`/api/v1/admin/moderation/listings/${listingId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ decision: 'REJECT', reason: 'DUPLICATE' });

    expect(seconde.status).toBe(409);
    expect(seconde.body.error.code).toBe('ALREADY_MODERATED');
  });

  it('retire une annonce déjà en ligne', async () => {
    const listingId = await submitListing(vendeur);
    await request(app)
      .post(`/api/v1/admin/moderation/listings/${listingId}`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({ decision: 'APPROVE' });

    const res = await request(app)
      .post(`/api/v1/admin/moderation/listings/${listingId}/takedown`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({ reason: 'Produit interdit constaté après publication' });

    expect(res.status).toBe(200);
    expect(res.body.listing.status).toBe('REJECTED');

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.publishedAt).toBeNull();
  });
});

describe('signalements', () => {
  let reportId: string;

  beforeAll(async () => {
    const listingId = await submitListing(vendeur);
    await request(app)
      .post(`/api/v1/admin/moderation/listings/${listingId}`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({ decision: 'APPROVE' });

    const res = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${particulier.accessToken}`)
      .send({
        target: 'LISTING',
        targetId: listingId,
        reason: 'SCAM',
        comment: 'Le vendeur demande un acompte',
      });

    reportId = res.body.report.id;
  });

  it('liste les signalements ouverts', async () => {
    const res = await request(app)
      .get('/api/v1/admin/reports')
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .query({ status: 'OPEN' });

    expect(res.status).toBe(200);
    expect(res.body.items.some((r: { id: string }) => r.id === reportId)).toBe(true);
  });

  it('affiche la cible du signalement au détail', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/reports/${reportId}`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.report.listing).not.toBeNull();
    expect(res.body.report.listing.title).toBeTruthy();
    expect(res.body.report.disclosedMessages).toEqual([]);
  });

  it('traite le signalement et l’inscrit au journal', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/reports/${reportId}/resolve`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({ status: 'RESOLVED', note: 'Annonce retirée' });

    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe('RESOLVED');

    const audit = await prisma.auditLog.findFirst({
      where: { targetId: reportId, action: 'REPORT_RESOLVED' },
    });
    expect(audit?.reason).toBe('Annonce retirée');
  });

  it('refuse de traiter deux fois le même signalement', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/reports/${reportId}/resolve`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({ status: 'DISMISSED' });

    expect(res.status).toBe(409);
  });
});

describe('gestion des membres', () => {
  it('masque les adresses dans la liste, les montre au détail', async () => {
    const liste = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .query({ search: vendeur.email });

    expect(liste.status).toBe(200);
    const trouve = liste.body.items.find((u: { id: string }) => u.id === vendeur.id);
    expect(trouve.emailMasked).toContain('•');
    expect(JSON.stringify(liste.body)).not.toContain(vendeur.email);

    const detail = await request(app)
      .get(`/api/v1/admin/users/${vendeur.id}`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`);
    expect(detail.body.user.email).toBe(vendeur.email);
  });

  it('suspend un membre, ferme ses sessions et le prévient', async () => {
    const cible = await createVerifiedAccount(app, prisma);

    const res = await request(app)
      .post(`/api/v1/admin/users/${cible.id}/suspend`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({ days: 7, reason: 'Annonces répétées non conformes' });

    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('SUSPENDED');

    // La décision prend effet tout de suite : sans cela, la personne resterait
    // connectée jusqu'à l'expiration de son jeton d'accès.
    const sessions = await prisma.session.count({
      where: { userId: cible.id, revokedAt: null },
    });
    expect(sessions).toBe(0);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${cible.accessToken}`);
    expect(me.status).toBe(401);

    expect(transport.lastTo(cible.email)?.text).toMatch(/suspendu/i);
  });

  it('bannit un membre et retire ses annonces du site', async () => {
    const cible = await createVerifiedAccount(app, prisma);
    const listingId = await submitListing(cible);
    await request(app)
      .post(`/api/v1/admin/moderation/listings/${listingId}`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({ decision: 'APPROVE' });

    const res = await request(app)
      .post(`/api/v1/admin/users/${cible.id}/ban`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({ reason: 'Fraude caractérisée' });

    expect(res.status).toBe(200);

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.status).toBe('REJECTED');
    expect(listing.publishedAt).toBeNull();
  });

  it('protège les membres de l’équipe', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/users/${admin.id}/ban`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({ reason: 'Tentative de neutralisation de la modération' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CANNOT_MODERATE_STAFF');
  });

  it('réserve le changement de rôle aux administrateurs', async () => {
    const cible = await createVerifiedAccount(app, prisma);

    const parModerateur = await request(app)
      .post(`/api/v1/admin/users/${cible.id}/role`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({ role: 'MODERATOR', reason: 'Renfort équipe' });
    expect(parModerateur.status).toBe(403);

    const parAdmin = await request(app)
      .post(`/api/v1/admin/users/${cible.id}/role`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ role: 'PRO', reason: 'Régularisation' });
    expect(parAdmin.status).toBe(200);
    expect(parAdmin.body.user.role).toBe('PRO');
  });

  it('empêche un administrateur de changer son propre rôle', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/users/${admin.id}/role`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ role: 'USER', reason: 'Erreur' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SELF_ROLE_CHANGE');
  });

  it('lève une suspension', async () => {
    const cible = await createVerifiedAccount(app, prisma);
    await request(app)
      .post(`/api/v1/admin/users/${cible.id}/suspend`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .send({ days: 3, reason: 'Vérification en cours' });

    const res = await request(app)
      .post(`/api/v1/admin/users/${cible.id}/unsuspend`)
      .set('Authorization', `Bearer ${moderateur.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('ACTIVE');
  });
});

describe('journal d’audit', () => {
  it('conserve chaque décision avec son auteur et son motif', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${moderateur.accessToken}`)
      .query({ limit: 50 });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);

    const entree = res.body.items[0];
    expect(entree.actor).not.toBeNull();
    expect(entree.action).toBeTruthy();
    expect(entree.targetType).toBeTruthy();
  });

  it('ne conserve aucune adresse IP complète', async () => {
    const entrees = await prisma.auditLog.findMany({
      where: { ipPrefix: { not: null } },
      take: 20,
    });

    for (const entree of entrees) {
      expect(entree.ipPrefix === null || /\.0$|::$/.test(entree.ipPrefix)).toBe(true);
    }
  });

  it('est en écriture seule : la base refuse toute modification', async () => {
    const entree = await prisma.auditLog.findFirstOrThrow();

    await expect(
      prisma.auditLog.update({ where: { id: entree.id }, data: { reason: 'falsifié' } }),
    ).rejects.toThrow();

    // Et la suppression avant la fin de la durée de conservation aussi.
    await expect(prisma.auditLog.delete({ where: { id: entree.id } })).rejects.toThrow();
  });

  it('laisse détacher l’auteur, et rien d’autre', async () => {
    // `ON DELETE SET NULL` s'applique par un UPDATE de la ligne enfant : sans
    // cette tolérance, un compte ayant modéré ne pourrait plus jamais être
    // supprimé, ce qui est incompatible avec le droit à l'effacement.
    const entree = await prisma.auditLog.findFirstOrThrow({ where: { actorId: { not: null } } });

    await expect(
      prisma.auditLog.update({ where: { id: entree.id }, data: { actorId: null } }),
    ).resolves.toMatchObject({ id: entree.id, actorId: null });

    // Le reste de la ligne reste intouchable.
    const apres = await prisma.auditLog.findUniqueOrThrow({ where: { id: entree.id } });
    expect(apres.action).toBe(entree.action);
    expect(apres.reason).toBe(entree.reason);

    await expect(
      prisma.auditLog.update({ where: { id: entree.id }, data: { reason: 'falsifié' } }),
    ).rejects.toThrow();
  });

  it('permet de supprimer un compte qui a modéré', async () => {
    const ancien = await createVerifiedAccount(app, prisma, { role: 'MODERATOR' });
    const listingId = await submitListing(vendeur);

    await request(app)
      .post(`/api/v1/admin/moderation/listings/${listingId}`)
      .set('Authorization', `Bearer ${ancien.accessToken}`)
      .send({ decision: 'APPROVE' });

    const avant = await prisma.auditLog.count({ where: { actorId: ancien.id } });
    expect(avant).toBeGreaterThan(0);

    await expect(prisma.user.delete({ where: { id: ancien.id } })).resolves.toBeTruthy();

    // La décision reste au journal, détachée de son auteur.
    const orphelines = await prisma.auditLog.count({
      where: { targetId: listingId, action: 'LISTING_APPROVED', actorId: null },
    });
    expect(orphelines).toBeGreaterThan(0);
  });

  it('n’expose aucune route d’écriture du journal', async () => {
    const post = await request(app)
      .post('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ action: 'FAUX' });
    expect(post.status).toBe(404);

    const suppression = await request(app)
      .delete('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(suppression.status).toBe(404);
  });
});

describe('tableau de bord', () => {
  it('agrège les chiffres attendus', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${moderateur.accessToken}`);

    expect(res.status).toBe(200);
    const stats = res.body.stats;

    expect(stats.users.total).toBeGreaterThan(0);
    expect(stats.listings.byStatus.PUBLISHED).toBeGreaterThan(0);
    expect(stats.byCategory.length).toBe(8);
    expect(stats.byCity.length).toBe(12);
    expect(typeof stats.moderation.pending).toBe('number');
    expect(typeof stats.revenue.totalXaf).toBe('number');
  });

  it('donne les revenus par mois aux administrateurs', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats/revenue')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.months)).toBe(true);
  });
});

describe('portée des gardes du back-office', () => {
  it('une route inconnue reste un 404, pas un 401', async () => {
    // Les gardes du back-office sont montés sur le préfixe `/admin`. Montés sur
    // le routeur nu, ils s'appliqueraient à toute requête qui le traverse : une
    // URL inconnue répondrait 401, et tout module ajouté ensuite hériterait
    // silencieusement de l'authentification.
    const res = await request(app).get('/api/v1/route-qui-nexiste-pas');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('les routes publiques restent accessibles sans authentification', async () => {
    const catalogue = await request(app).get('/api/v1/catalog');
    expect(catalogue.status).toBe(200);

    const annonces = await request(app).get('/api/v1/listings').query({ limit: 1 });
    expect(annonces.status).toBe(200);
  });
});
