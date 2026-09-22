/**
 * Rendu du sous-ensemble de Markdown utilisé par les documents légaux.
 *
 * Pas de dépendance : le sous-ensemble est petit et connu — titres, paragraphes,
 * listes, tableaux, gras, liens, séparateurs — et une bibliothèque complète
 * apporterait surtout des constructions que nos textes n'emploient pas.
 *
 * **Tout est échappé avant d'être mis en forme.** Les documents viennent du
 * back-office, donc d'une source de confiance ; c'est précisément la raison
 * pour laquelle il ne faut pas s'en remettre à cette confiance : un jour, un
 * texte viendra d'ailleurs.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Gras, code, puis liens — dans cet ordre, sur du texte déjà échappé. */
function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, href: string) => {
      // Seuls les schémas inoffensifs : `javascript:` dans un lien suffirait.
      const safe = /^(https?:\/\/|mailto:|\/)/.test(href);
      return safe ? `<a href="${href}">${label}</a>` : label;
    });
}

function renderTable(rows: string[]): string {
  const cells = (row: string) =>
    row
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim());

  const [header, , ...body] = rows;
  const head = cells(header ?? '')
    .map((cell) => `<th scope="col">${inline(cell)}</th>`)
    .join('');

  const lines = body
    .map(
      (row) =>
        `<tr>${cells(row)
          .map((cell) => `<td>${inline(cell)}</td>`)
          .join('')}</tr>`,
    )
    .join('');

  return `<table><thead><tr>${head}</tr></thead><tbody>${lines}</tbody></table>`;
}

export function renderMarkdown(source: string): string {
  const out: string[] = [];
  const lines = source.split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      out.push('<hr>');
      index += 1;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith('|')) {
      const rows: string[] = [];
      while (index < lines.length && (lines[index] ?? '').trimStart().startsWith('|')) {
        rows.push(lines[index]!);
        index += 1;
      }
      out.push(renderTable(rows));
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index] ?? '')) {
        // Une puce peut courir sur plusieurs lignes : la suite est indentée.
        let item = (lines[index] ?? '').replace(/^\s*[-*]\s+/, '');
        index += 1;
        while (index < lines.length && /^\s{2,}\S/.test(lines[index] ?? '')) {
          item += ' ' + (lines[index] ?? '').trim();
          index += 1;
        }
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index] ?? '')) {
        items.push(`<li>${inline((lines[index] ?? '').replace(/^\s*\d+\.\s+/, ''))}</li>`);
        index += 1;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      (lines[index] ?? '').trim() !== '' &&
      !/^(#{1,4}\s|---+\s*$|\s*[-*]\s|\s*\d+\.\s)/.test(lines[index] ?? '') &&
      !(lines[index] ?? '').trimStart().startsWith('|')
    ) {
      paragraph.push((lines[index] ?? '').trim());
      index += 1;
    }
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }

  return out.join('\n');
}
