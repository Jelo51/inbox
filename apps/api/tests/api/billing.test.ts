import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/app.js';
import { createVerifiedAccount, type TestAccount } from '../helpers/accounts.js';
import { deleteTestLegalDocuments, deleteTestUsers } from '../helpers/fixtures.js';
import * as billing from '../../src/modules/billing/service.js';
import { stripeGateway } from '../../src/modules/billing/providers/stripe.js';
import { parseEnv } from '../../src/config/env.js';
import { createLogger } from '../../src/lib/logger.js';

const { app, prisma, transport } = buildTestApp();
const EMAIL_MARKER = '@essai-inbox.test';

let abonne: TestAccount;

/**
 * Confirme un paiement par le même chemin qu'un webhook réel : c'est le
 * serveur qui décide, jamais le navigateur.
 */
async function confirm(account: TestAccount, reference: string, outcome: 'SUCCEEDED' | 'FAILED') {
  return request(app)
    .post('/api/v1/billing/demo/confirm')
    .set('Authorization', `Bearer ${account.accessToken}`)
    .send({ reference, outcome });
}

async function startSubscription(account: TestAccount) {
  return request(app)
    .post('/api/v1/subscription')
    .set('Authorization', `Bearer ${account.accessToken}`)
    .send({ method: 'MTN_MOMO', planCode: 'PRO_MENSUEL', payerPhone: '677001122' });
}

beforeAll(async () => {
  const plan = await prisma.plan.findUnique({ where: { code: 'PRO_MENSUEL' } });
  if (!plan) {
    throw new Error('Offre PRO_MENSUEL absente : lancer `pnpm db:seed` avant les tests.');
  }
  abonne = await createVerifiedAccount(app, prisma);
});

afterAll(async () => {
  await deleteTestUsers(prisma, EMAIL_MARKER);
  await deleteTestLegalDocuments(prisma);
  await prisma.$disconnect();
});

describe('offre Pro', () => {
  it('expose le prix depuis la base, pas depuis le code', async () => {
    const res = await request(app).get('/api/v1/plans');

    expect(res.status).toBe(200);
    const plan = res.body.plans.find((p: { code: string }) => p.code === 'PRO_MENSUEL');
    expect(plan.priceXaf).toBe(7500);
    expect(plan.priceLabel).toMatch(/7.500 FCFA/);

    // L'utilisateur doit savoir s'il se trouve dans un espace de démonstration.
    expect(res.body.demo).toBe(true);
  });
});

describe('le statut Pro ne s’active que sur confirmation serveur', () => {
  it('reste en attente après initiation, sans passer Pro', async () => {
    const compte = await createVerifiedAccount(app, prisma);
    const res = await startSubscription(compte);

    expect(res.status).toBe(201);
    expect(res.body.payment.status).toBe('PENDING');
    expect(res.body.redirectUrl).toContain('/paiement/demonstration');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: compte.id } });
    expect(user.role).toBe('USER');

    const subscription = await prisma.subscription.findFirstOrThrow({
      where: { userId: compte.id },
    });
    expect(subscription.status).toBe('PENDING');
  });

  it('active l’abonnement et le rôle Pro à la confirmation', async () => {
    const started = await startSubscription(abonne);
    const reference = started.body.payment.reference as string;
    transport.clear();

    const confirmed = await confirm(abonne, reference, 'SUCCEEDED');
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.outcome).toBe('APPLIED');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: abonne.id } });
    expect(user.role).toBe('PRO');

    const subscription = await prisma.subscription.findFirstOrThrow({
      where: { userId: abonne.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(subscription.status).toBe('ACTIVE');
    expect(subscription.endsAt).not.toBeNull();

    // L'e-mail de confirmation part, avec le numéro de reçu.
    const message = transport.lastTo(abonne.email);
    expect(message).toBeDefined();
    expect(message?.text).toMatch(/INB-\d{4}-\d{6}/);
  });

  it('remonte les annonces existantes du nouveau Pro', async () => {
    const listings = await prisma.listing.findMany({ where: { sellerId: abonne.id } });
    for (const listing of listings) expect(listing.sellerIsPro).toBe(true);
  });

  it('ne rétrograde pas un administrateur qui s’abonne', async () => {
    const admin = await createVerifiedAccount(app, prisma, { role: 'ADMIN' });
    const started = await startSubscription(admin);
    await confirm(admin, started.body.payment.reference, 'SUCCEEDED');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(user.role).toBe('ADMIN');
  });

  it('marque l’abonnement en échec quand le paiement échoue', async () => {
    const compte = await createVerifiedAccount(app, prisma);
    const started = await startSubscription(compte);

    await confirm(compte, started.body.payment.reference, 'FAILED');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: compte.id } });
    expect(user.role).toBe('USER');

    const subscription = await prisma.subscription.findFirstOrThrow({
      where: { userId: compte.id },
    });
    expect(subscription.status).toBe('PAYMENT_FAILED');
  });
});

describe('idempotence', () => {
  it('une confirmation rejouée ne prolonge pas l’abonnement', async () => {
    const compte = await createVerifiedAccount(app, prisma);
    const started = await startSubscription(compte);
    const reference = started.body.payment.reference as string;

    const premiere = await confirm(compte, reference, 'SUCCEEDED');
    expect(premiere.body.outcome).toBe('APPLIED');

    const apres = await prisma.subscription.findFirstOrThrow({ where: { userId: compte.id } });
    const echeanceInitiale = apres.endsAt!.getTime();

    // Les fournisseurs réémettent tant qu'ils n'ont pas reçu de 200 : le rejeu
    // est le cas courant, pas l'exception.
    for (let i = 0; i < 3; i += 1) {
      const rejeu = await confirm(compte, reference, 'SUCCEEDED');
      expect(rejeu.body.outcome).toBe('DUPLICATE');
    }

    const final = await prisma.subscription.findFirstOrThrow({ where: { userId: compte.id } });
    expect(final.endsAt!.getTime()).toBe(echeanceInitiale);
  });

  it('n’émet qu’un seul reçu par paiement', async () => {
    const compte = await createVerifiedAccount(app, prisma);
    const started = await startSubscription(compte);

    await confirm(compte, started.body.payment.reference, 'SUCCEEDED');
    await confirm(compte, started.body.payment.reference, 'SUCCEEDED');

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { reference: started.body.payment.reference },
      include: { receipt: true },
    });
    const receipts = await prisma.receipt.count({ where: { paymentId: payment.id } });

    expect(receipts).toBe(1);
    expect(payment.receipt).not.toBeNull();
  });
});

describe('reçus', () => {
  it('numérote de façon continue et sans trou', async () => {
    const receipts = await prisma.receipt.findMany({
      orderBy: { sequence: 'asc' },
      select: { number: true, sequence: true, year: true },
    });

    expect(receipts.length).toBeGreaterThan(1);

    const parAnnee = new Map<number, number[]>();
    for (const receipt of receipts) {
      parAnnee.set(receipt.year, [...(parAnnee.get(receipt.year) ?? []), receipt.sequence]);
    }

    for (const [, sequences] of parAnnee) {
      const triees = [...sequences].sort((a, b) => a - b);
      expect(triees[0]).toBe(1);
      for (let i = 1; i < triees.length; i += 1) {
        expect(triees[i]).toBe(triees[i - 1]! + 1);
      }
    }

    expect(receipts[0]?.number).toMatch(/^INB-\d{4}-\d{6}$/);
  });

  it('produit un PDF téléchargeable', async () => {
    const payment = await prisma.payment.findFirstOrThrow({
      where: { userId: abonne.id, status: 'SUCCEEDED' },
    });

    const res = await request(app)
      .get(`/api/v1/payments/${payment.id}/receipt`)
      .set('Authorization', `Bearer ${abonne.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/recu-INB-\d{4}-\d{6}\.pdf/);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('refuse le reçu d’un autre membre', async () => {
    const intrus = await createVerifiedAccount(app, prisma);
    const payment = await prisma.payment.findFirstOrThrow({
      where: { userId: abonne.id, status: 'SUCCEEDED' },
    });

    const res = await request(app)
      .get(`/api/v1/payments/${payment.id}/receipt`)
      .set('Authorization', `Bearer ${intrus.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('fige l’identité de l’éditeur au moment de l’émission', async () => {
    const receipt = await prisma.receipt.findFirstOrThrow();
    const issuer = receipt.issuerSnapshot as { name: string; address: string };

    // Un reçu ne doit pas changer rétroactivement le jour où la société est
    // immatriculée : l'identité est recopiée, pas référencée.
    expect(issuer.name).toBeTruthy();
    expect(issuer.address).toBeTruthy();
  });
});

describe('résiliation', () => {
  it('prend effet en fin de période, sans couper le service payé', async () => {
    const res = await request(app)
      .delete('/api/v1/subscription')
      .set('Authorization', `Bearer ${abonne.accessToken}`)
      .send({ reason: 'Essai' });

    expect(res.status).toBe(200);
    expect(res.body.subscription.cancelledAt).not.toBeNull();
    expect(new Date(res.body.subscription.endsAt).getTime()).toBeGreaterThan(Date.now());

    // Le compte reste Pro jusqu'à l'échéance.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: abonne.id } });
    expect(user.role).toBe('PRO');

    const subscription = await prisma.subscription.findFirstOrThrow({
      where: { userId: abonne.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(subscription.status).toBe('ACTIVE');
  });

  it('refuse une seconde résiliation', async () => {
    const res = await request(app)
      .delete('/api/v1/subscription')
      .set('Authorization', `Bearer ${abonne.accessToken}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_CANCELLED');
  });

  it('retire le rôle Pro à l’échéance', async () => {
    const subscription = await prisma.subscription.findFirstOrThrow({
      where: { userId: abonne.id, status: 'ACTIVE' },
    });

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { endsAt: new Date(Date.now() - 1000) },
    });
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'EXPIRED' },
    });
    await billing.demoteFromPro(prisma, abonne.id);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: abonne.id } });
    expect(user.role).toBe('USER');

    const listings = await prisma.listing.findMany({ where: { sellerId: abonne.id } });
    for (const listing of listings) expect(listing.sellerIsPro).toBe(false);
  });
});

describe('contrôle d’accès et abus', () => {
  it('refuse un abonnement en double', async () => {
    const compte = await createVerifiedAccount(app, prisma);
    const started = await startSubscription(compte);
    await confirm(compte, started.body.payment.reference, 'SUCCEEDED');

    const second = await startSubscription(compte);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_SUBSCRIBED');
  });

  it('refuse qu’un membre confirme le paiement d’un autre', async () => {
    const proprietaire = await createVerifiedAccount(app, prisma);
    const intrus = await createVerifiedAccount(app, prisma);
    const started = await startSubscription(proprietaire);

    const res = await confirm(intrus, started.body.payment.reference, 'SUCCEEDED');
    expect(res.status).toBe(403);
  });

  it('refuse une offre inconnue', async () => {
    const compte = await createVerifiedAccount(app, prisma);
    const res = await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${compte.accessToken}`)
      .send({ method: 'CARD', planCode: 'OFFRE_INVENTEE' });

    expect(res.status).toBe(404);
  });

  it('ignore le montant envoyé par le client', async () => {
    const compte = await createVerifiedAccount(app, prisma);
    const res = await request(app)
      .post('/api/v1/subscription')
      .set('Authorization', `Bearer ${compte.accessToken}`)
      .send({ method: 'MTN_MOMO', planCode: 'PRO_MENSUEL', payerPhone: '677001122', amountXaf: 1 });

    expect(res.status).toBe(201);
    expect(res.body.payment.amountXaf).toBe(7500);
  });
});

describe('vérification de signature des webhooks', () => {
  const env = parseEnv({
    ...process.env,
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  });
  const gateway = stripeGateway(env, createLogger());

  function signed(
    payload: string,
    secret = 'whsec_test_secret',
    timestamp = Math.floor(Date.now() / 1000),
  ) {
    const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
    return { 'stripe-signature': `t=${timestamp},v1=${signature}` };
  }

  const payload = JSON.stringify({
    id: 'evt_test_1',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_1', amount_total: 7500, payment_status: 'paid' } },
  });

  it('accepte une notification correctement signée', () => {
    const event = gateway.verifyWebhook(Buffer.from(payload), signed(payload));

    expect(event).not.toBeNull();
    expect(event?.eventId).toBe('evt_test_1');
    expect(event?.status).toBe('SUCCEEDED');
  });

  it('rejette une signature fabriquée avec un autre secret', () => {
    expect(
      gateway.verifyWebhook(Buffer.from(payload), signed(payload, 'mauvais-secret')),
    ).toBeNull();
  });

  it('rejette une notification sans signature', () => {
    expect(gateway.verifyWebhook(Buffer.from(payload), {})).toBeNull();
  });

  it('rejette un rejeu hors de la fenêtre de cinq minutes', () => {
    const vieux = Math.floor(Date.now() / 1000) - 3600;
    expect(
      gateway.verifyWebhook(Buffer.from(payload), signed(payload, 'whsec_test_secret', vieux)),
    ).toBeNull();
  });

  it('rejette un corps modifié après signature', () => {
    const headers = signed(payload);
    const falsifie = payload.replace('7500', '1');
    expect(gateway.verifyWebhook(Buffer.from(falsifie), headers)).toBeNull();
  });

  it('ignore un type d’événement sans rapport avec l’abonnement', () => {
    const autre = JSON.stringify({
      id: 'evt_test_2',
      type: 'customer.created',
      data: { object: { id: 'cus_1' } },
    });
    expect(gateway.verifyWebhook(Buffer.from(autre), signed(autre))).toBeNull();
  });

  it('refuse un webhook adressé au fournisseur de démonstration', async () => {
    const res = await request(app).post('/api/v1/billing/webhooks/mock').send({});
    expect(res.status).toBe(404);
  });
});
