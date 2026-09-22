import type { PrismaClient } from '@prisma/client';

/**
 * Export des données personnelles (RGPD art. 15 et 20, loi n° 2024/017).
 *
 * Le format est du JSON : c'est ce qui se relit le plus sûrement dix ans plus
 * tard, sans outil particulier. Les messages en sortent **chiffrés**, avec la
 * sauvegarde de clé : nous ne détenons pas de quoi les déchiffrer, et c'est
 * précisément la propriété que l'export doit refléter plutôt que masquer.
 */
export async function exportAccountData(
  prisma: PrismaClient,
  userId: string,
  generatedAt: Date,
): Promise<Record<string, unknown>> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      city: { select: { slug: true, name: true } },
      notificationPrefs: true,
      keyBackup: true,
    },
  });

  const [
    listings,
    favorites,
    conversations,
    messages,
    phoneReveals,
    blocks,
    reports,
    subscriptions,
    payments,
    acceptances,
    consents,
    publicKeys,
    sessions,
  ] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: userId },
      include: {
        images: { select: { publicId: true, position: true, width: true, height: true } },
        category: { select: { slug: true } },
        city: { select: { slug: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.favorite.findMany({
      where: { userId },
      select: { listingId: true, createdAt: true },
    }),
    prisma.conversation.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      select: {
        id: true,
        listingId: true,
        buyerId: true,
        sellerId: true,
        createdAt: true,
        lastMessageAt: true,
      },
    }),
    prisma.message.findMany({
      where: { conversation: { OR: [{ buyerId: userId }, { sellerId: userId }] } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.phoneReveal.findMany({
      where: { viewerId: userId },
      select: { listingId: true, revealedAt: true },
    }),
    prisma.block.findMany({
      where: { authorId: userId },
      select: { targetId: true, createdAt: true },
    }),
    prisma.report.findMany({
      where: { authorId: userId },
      select: {
        target: true,
        targetId: true,
        reason: true,
        comment: true,
        status: true,
        createdAt: true,
        disclosureConsentAt: true,
      },
    }),
    prisma.subscription.findMany({ where: { userId } }),
    prisma.payment.findMany({
      where: { userId },
      include: { receipt: { select: { number: true, issuedAt: true } } },
    }),
    prisma.legalAcceptance.findMany({
      where: { userId },
      select: { type: true, version: true, acceptedAt: true, ipPrefix: true },
    }),
    prisma.consentRecord.findMany({
      where: { userId },
      select: { analytics: true, policyVersion: true, createdAt: true, expiresAt: true },
    }),
    prisma.publicKey.findMany({
      where: { userId },
      select: { key: true, fingerprint: true, deviceLabel: true, createdAt: true, retiredAt: true },
    }),
    prisma.session.findMany({
      where: { userId },
      select: {
        userAgent: true,
        ipPrefix: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    }),
  ]);

  return {
    lisezMoi: {
      genereLe: generatedAt.toISOString(),
      format: 'JSON (UTF-8)',
      messages:
        'Les messages sont chiffrés de bout en bout. Le champ « ciphertext » est ' +
        'illisible sans votre clé privée, que nous ne détenons pas. La ' +
        'sauvegarde chiffrée de cette clé figure sous « sauvegardeDeCle » : ' +
        'elle s’ouvre avec votre phrase secrète, que nous ne connaissons pas ' +
        'non plus.',
      adressesIp:
        'Aucune adresse IP complète n’est conservée : seul un préfixe /24 (IPv4) ' +
        'ou /48 (IPv6) figure ici.',
      motDePasse:
        'Votre mot de passe n’est pas exporté : seule une empreinte argon2id en ' +
        'est conservée, et elle n’est pas une donnée qui vous soit utile.',
    },

    compte: {
      email: user.email,
      nomAffiche: user.displayName,
      telephone: user.phone,
      biographie: user.bio,
      langue: user.locale,
      ville: user.city?.slug ?? null,
      role: user.role,
      statut: user.status,
      emailVerifieLe: user.emailVerifiedAt,
      majoriteDeclareeLe: user.adultDeclaredAt,
      inscritLe: user.createdAt,
      derniereConnexion: user.lastLoginAt,
    },

    preferencesDeNotification: user.notificationPrefs,
    annonces: listings,
    favoris: favorites,
    conversations,
    messages,
    numerosReveles: phoneReveals,
    blocages: blocks,
    signalementsEffectues: reports,
    abonnements: subscriptions,
    paiements: payments,
    acceptationsLegales: acceptances,
    consentements: consents,
    clesPubliques: publicKeys,
    sauvegardeDeCle: user.keyBackup,
    sessions,
  };
}
