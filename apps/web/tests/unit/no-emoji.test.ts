import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Le cahier des charges interdit les emoji dans l'interface, les e-mails et les
 * documents légaux. Une relecture humaine laisserait passer le premier oubli :
 * ce test parcourt les sources et échoue s'il en trouve un.
 */

const webRoot = fileURLToPath(new URL('../..', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));

/**
 * Emoji au sens d'Unicode : `Extended_Pictographic` couvre les pictogrammes,
 * les symboles météo, les drapeaux et les émoticônes, sans attraper les
 * lettres accentuées ni la ponctuation typographique française.
 */
const EMOJI = /\p{Extended_Pictographic}/u;

/** Deux caractères de présentation qui accompagnent toujours un emoji. */
const EMOJI_MODIFIERS = /[\u{FE0F}\u{20E3}]|\p{Emoji_Modifier}/u;

function walk(dir: string, extensions: string[], skip: string[] = []): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (skip.includes(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, extensions, skip));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

function offenders(files: string[]): string[] {
  return files.filter((file) => {
    const content = readFileSync(file, 'utf8');
    return EMOJI.test(content) || EMOJI_MODIFIERS.test(content);
  });
}

describe('aucun emoji dans le produit', () => {
  it('les traductions n’en contiennent pas', () => {
    const files = walk(join(webRoot, 'i18n'), ['.json']);
    expect(files.length).toBeGreaterThan(0);
    expect(offenders(files)).toEqual([]);
  });

  it('les composants et les pages n’en contiennent pas', () => {
    const files = walk(join(webRoot, 'app'), ['.vue', '.ts'], ['node_modules']);
    expect(files.length).toBeGreaterThan(0);
    expect(offenders(files)).toEqual([]);
  });

  it('les documents de conformité n’en contiennent pas', () => {
    const files = walk(join(repoRoot, 'docs', 'conformite'), ['.md']);
    expect(offenders(files)).toEqual([]);
  });
});

describe('jetons de design', () => {
  it('la palette de la maquette est bien celle de Tailwind', async () => {
    const config = await import('../../tailwind.config.js').catch(
      () => import('../../tailwind.config.ts' as string),
    );
    const colors = (config.default as { theme: { extend: { colors: Record<string, unknown> } } })
      .theme.extend.colors;

    expect(colors.orange).toMatchObject({
      DEFAULT: '#FF6E14',
      hover: '#E85A02',
      soft: '#FFF3EB',
    });
    expect(colors.ink).toBe('#171A1F');
    expect(colors.muted).toBe('#4A5159');
    expect(colors.grey).toBe('#7C848D');
    expect(colors.canvas).toBe('#F6F6F7');
    expect(colors.line).toBe('#E5E6E8');
    expect(colors.success).toBe('#1E9E62');
    expect(colors.pending).toBe('#B27400');
    expect(colors.danger).toBe('#D33A2C');
  });
});
