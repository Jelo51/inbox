import { PrismaClient } from '@prisma/client';
import { seedCatalog } from './seed/catalog.js';
import { SEED_CREDENTIALS, seedUsers } from './seed/users.js';
import { seedListings } from './seed/listings.js';

/**
 * Jeu de données de démonstration.
 *
 * Il refuse catégoriquement de s'exécuter en production : ces comptes ont des
 * mots de passe connus et publiés dans le README de développement.
 */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Le seed contient des comptes de démonstration aux mots de passe connus : ' +
        'il ne doit jamais tourner en production.',
    );
  }

  const prisma = new PrismaClient();
  const now = new Date();

  try {
    const existing = await prisma.listing.count();
    if (existing > 0) {
      console.log(`Seed ignoré : ${existing} annonces sont déjà présentes.`);
      console.log('Pour repartir de zéro : pnpm --filter @inbox/api exec prisma migrate reset');
      return;
    }

    console.log('Catalogue (catégories, villes, offre Pro)…');
    await seedCatalog(prisma);

    console.log('Comptes de démonstration…');
    const accounts = await seedUsers(prisma, now);

    console.log('Annonces…');
    const stats = await seedListings(prisma, accounts, now);

    console.log('');
    console.log('Jeu de démonstration chargé :');
    console.log(`  ${stats.published} annonces publiées`);
    console.log(`  ${stats.pending} annonces en attente de modération`);
    console.log(`  ${stats.flagged} annonces repérées par le filtre automatique`);
    console.log('');
    console.log('Comptes (voir aussi le README de développement) :');
    for (const account of SEED_CREDENTIALS) {
      console.log(`  ${account.role.padEnd(6)} ${account.email}  ${account.password}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
