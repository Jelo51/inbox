import { PrismaClient } from '@prisma/client';
import { publishLegalDocuments } from '../src/modules/legal/publish.js';

/**
 * Publication des documents légaux.
 *
 * Séparé du seed à dessein : le seed refuse de tourner en production, alors que
 * ce chargement-ci y est indispensable — sans documents publiés, l'inscription
 * répond 503.
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const at = new Date();

  try {
    const results = await publishLegalDocuments(prisma, at);

    for (const result of results) {
      const label = `${result.type} (${result.locale}) v${result.version}`;
      console.log(`  ${result.outcome.padEnd(9)} ${label}`);
    }

    const published = results.filter((r) => r.outcome !== 'unchanged').length;
    console.log('');
    console.log(
      published === 0
        ? `${results.length} documents déjà à jour.`
        : `${published} document(s) publié(s) sur ${results.length}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
