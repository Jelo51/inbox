import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../app/utils/markdown';

/**
 * Le rendu des documents légaux produit du HTML inséré tel quel dans la page.
 * L'échappement est donc la propriété qui compte le plus ici — plus encore que
 * la fidélité de la mise en forme.
 */
describe('rendu Markdown', () => {
  it('échappe le HTML plutôt que de le laisser s’exécuter', () => {
    const html = renderMarkdown('Un texte avec <script>alert(1)</script> dedans.');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('refuse un lien dont le schéma n’est pas inoffensif', () => {
    const html = renderMarkdown('[cliquez](javascript:alert(1))');

    expect(html).not.toContain('javascript:');
    expect(html).toContain('cliquez');
  });

  it('accepte les liens http, mailto et relatifs', () => {
    expect(renderMarkdown('[a](https://inbox.cm)')).toContain('href="https://inbox.cm"');
    expect(renderMarkdown('[b](mailto:contact@inbox.cm)')).toContain('href="mailto:');
    expect(renderMarkdown('[c](/legal/cookies)')).toContain('href="/legal/cookies"');
  });

  it('rend les titres, le gras et les listes', () => {
    const html = renderMarkdown(['## Titre', '', '- **Un** point', '- Un autre'].join('\n'));

    expect(html).toContain('<h2>Titre</h2>');
    expect(html).toContain('<strong>Un</strong>');
    expect(html).toContain('<li><strong>Un</strong> point</li>');
    expect(html).toContain('<li>Un autre</li>');
  });

  it('rend un tableau avec un en-tête', () => {
    const html = renderMarkdown(
      ['| Motif | Sens |', '| --- | --- |', '| Doublon | Déjà publiée |'].join('\n'),
    );

    expect(html).toContain('<th scope="col">Motif</th>');
    expect(html).toContain('<td>Déjà publiée</td>');
  });

  it('regroupe les lignes d’un même paragraphe', () => {
    const html = renderMarkdown('Une phrase\ncoupée en deux lignes.\n\nUne autre.');

    expect(html).toContain('<p>Une phrase coupée en deux lignes.</p>');
    expect(html).toContain('<p>Une autre.</p>');
  });

  it('rattache à sa puce une ligne de continuation indentée', () => {
    const html = renderMarkdown('- Un point qui court\n  sur deux lignes.');

    expect(html).toContain('<li>Un point qui court sur deux lignes.</li>');
  });

  it('rend les listes numérotées du sommaire', () => {
    const html = renderMarkdown('1. Objet\n2. Inscription');

    expect(html).toContain('<ol><li>Objet</li><li>Inscription</li></ol>');
  });
});
