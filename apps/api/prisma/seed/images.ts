import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

/**
 * Visuels de démonstration.
 *
 * Le jeu de données référençait des photos qui n'existaient pas : l'interface
 * affichait donc des images cassées, ce qui donne une mauvaise impression de
 * l'ensemble alors que le reste fonctionne. On génère ici de vraies images,
 * sobres et déterministes, plutôt que de téléverser des photos sous licence
 * incertaine ou d'appeler un service tiers pour lancer le projet.
 */

const PALETTE = [
  { bg: '#FFF3EB', fg: '#FF6E14' },
  { bg: '#F6F6F7', fg: '#4A5159' },
  { bg: '#EAF5EF', fg: '#1E9E62' },
  { bg: '#FDF3E3', fg: '#B27400' },
  { bg: '#EFF1F4', fg: '#171A1F' },
] as const;

/** Teinte stable pour une annonce donnée : le rendu ne change pas d'un seed à l'autre. */
function paletteFor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Découpe le titre en lignes courtes, pour qu'il tienne dans la vignette. */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = '';

  for (const word of text.split(/\s+/)) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = `${current} ${word}`;
    }
  }

  if (current && lines.length < maxLines) lines.push(current.trim());
  return lines;
}

export async function generateDemoImage(
  title: string,
  index: number,
  total: number,
): Promise<Buffer> {
  const { bg, fg } = paletteFor(title);
  const lines = wrap(title, 22, 3);
  const startY = 300 - (lines.length - 1) * 26;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
  <rect width="1200" height="900" fill="${bg}"/>
  <rect x="40" y="40" width="1120" height="820" fill="none" stroke="${fg}" stroke-opacity="0.18" stroke-width="3" rx="24"/>
  <circle cx="600" cy="220" r="72" fill="${fg}" fill-opacity="0.12"/>
  <text x="600" y="243" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="700"
        fill="${fg}" text-anchor="middle">${escapeXml(title.slice(0, 1).toUpperCase())}</text>
  ${lines
    .map(
      (line, i) =>
        `<text x="600" y="${startY + 180 + i * 52}" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="600" fill="${fg}" fill-opacity="0.85" text-anchor="middle">${escapeXml(line)}</text>`,
    )
    .join('\n  ')}
  <text x="600" y="820" font-family="Helvetica, Arial, sans-serif" font-size="30"
        fill="${fg}" fill-opacity="0.5" text-anchor="middle">Photo ${index} sur ${total} — visuel de démonstration</text>
</svg>`;

  return sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
}

/**
 * Écrit le fichier à l'emplacement attendu par le stockage disque local.
 * Sur un hébergement sans disque persistant, ces fichiers n'existeront pas et
 * l'interface affichera son visuel de remplacement : c'est prévu.
 */
export async function writeDemoImage(publicId: string, data: Buffer): Promise<void> {
  const path = join(process.cwd(), 'uploads', `${publicId}.webp`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}
