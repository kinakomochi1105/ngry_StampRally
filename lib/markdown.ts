/**
 * Markdown renderer for the built-in administrator wiki.
 *
 * The manual pages are repository files written by the organizers, but they are
 * still handed to `dangerouslySetInnerHTML`, so every character of the source is
 * escaped first and only the handful of tags understood here is inserted
 * afterwards. Raw HTML inside a page therefore shows up as text instead of
 * markup, which keeps a pasted snippet from ever becoming an element. A
 * markdown package would have to come with a sanitizer as well; the subset the
 * manuals use is small enough to keep the wiki dependency-free.
 */
export type Heading = { id: string; level: number; text: string };
export type Rendered = { html: string; headings: Heading[] };
/** Blockquote callouts: `> [!注意] …`. The key is also the printed label. */
const callouts = ['重要', '注意', '参考', '手順'];
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
/**
 * Only absolute web links and in-document references are kept. A `javascript:`
 * or `data:` URL in a page is left as plain text rather than becoming a link.
 */
const safeHref = (href: string) =>
  /^(?:https?:\/\/[^\s"']+|[#/][^\s"']*)$/.test(href) ? href : null;
/**
 * Placeholder for an extracted code span. A private-use character is used so
 * that nothing a page can contain collides with it; `renderMarkdown` also drops
 * the character from the source before parsing.
 */
const marker = String.fromCharCode(0xe000);
const markerPattern = new RegExp(marker + '(\\d+)' + marker, 'g');
function inline(source: string) {
  // Code spans are pulled out before anything else so their contents stay
  // literal: `**` inside a span must not turn into bold.
  const codes: string[] = [];
  const masked = source.replace(/`([^`]+)`/g, (_all, code: string) => {
    codes.push('<code>' + escapeHtml(code) + '</code>');
    return marker + (codes.length - 1) + marker;
  });
  const html = escapeHtml(masked)
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (all, label: string, href: string) => {
        // `[受付](./reception.md)` links to another manual page. The wiki is one
        // client component, so the click is handled there instead of navigating.
        const page = /^\.\/([a-z0-9-]{1,64})\.md$/.exec(href);
        if (page) return `<a href="#" data-slug="${page[1]}">${label}</a>`;
        const target = safeHref(href);
        if (!target) return all;
        return target.startsWith('http')
          ? `<a href="${target}" target="_blank" rel="noreferrer">${label}</a>`
          : `<a href="${target}">${label}</a>`;
      },
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return html.replace(
    markerPattern,
    (_all, index: string) => codes[Number(index)] ?? '',
  );
}
type Item = { indent: number; ordered: boolean; text: string };
const itemPattern = /^(\s*)(?:([-*])|(\d+)\.)\s+(.*)$/;
/**
 * Renders one list level and returns the index of the first line that belongs
 * to a shallower level, so nested bullets become nested lists.
 */
function renderItems(
  items: Item[],
  from: number,
  indent: number,
): [string, number] {
  const tag = items[from].ordered ? 'ol' : 'ul';
  const parts: string[] = [];
  let index = from;
  while (index < items.length && items[index].indent >= indent) {
    const item = items[index];
    if (item.indent > indent) {
      const [nested, next] = renderItems(items, index, item.indent);
      const last = parts.length - 1;
      if (last < 0) return [`<${tag}><li>${nested}</li></${tag}>`, next];
      parts[last] = parts[last].replace(/<\/li>$/, nested + '</li>');
      index = next;
      continue;
    }
    // `- [ ] 点検する` / `- [x] 点検済み` become printable checklist rows.
    const task = /^\[([ xX])\]\s+(.*)$/.exec(item.text);
    parts.push(
      task
        ? `<li class="wiki-task${task[1] === ' ' ? '' : ' done'}">${inline(task[2])}</li>`
        : `<li>${inline(item.text)}</li>`,
    );
    index++;
  }
  return [`<${tag}>${parts.join('')}</${tag}>`, index];
}
const cells = (row: string) =>
  row
    .replace(/^\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());
const alignment = (rule: string) =>
  rule.startsWith(':') && rule.endsWith(':')
    ? ' style="text-align:center"'
    : rule.endsWith(':')
      ? ' style="text-align:right"'
      : '';
export function renderMarkdown(source: string): Rendered {
  const lines = source
    .replaceAll('\r\n', '\n')
    .replaceAll(marker, '')
    .split('\n');
  const html: string[] = [];
  const headings: Heading[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (!paragraph.length) return;
    html.push(
      '<p>' + inline(paragraph.join('\n')).replaceAll('\n', '<br />') + '</p>',
    );
    paragraph = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```'))
        body.push(lines[i++]);
      html.push('<pre><code>' + escapeHtml(body.join('\n')) + '</code></pre>');
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    // `#` starts at <h2>: the panel around the page already owns the <h1>/<h2>
    // pair, so the document outline continues below it.
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length + 1;
      const text = heading[2].trim();
      // Japanese headings give no usable slug, so anchors are positional and
      // stay stable as long as the page's heading order does not change.
      const id = 'manual-section-' + (headings.length + 1);
      headings.push({ id, level, text });
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      continue;
    }
    if (/^(?:-{3,}|\*{3,})\s*$/.test(line)) {
      flush();
      html.push('<hr />');
      continue;
    }
    if (line.startsWith('|') && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      flush();
      const header = cells(line);
      const rules = cells(lines[i + 1]);
      const body: string[] = [];
      i += 2;
      while (i < lines.length && lines[i].startsWith('|'))
        body.push(lines[i++]);
      i--;
      html.push(
        '<div class="wiki-table"><table><thead><tr>' +
          header
            .map(
              (cell, n) =>
                `<th${alignment(rules[n] ?? '')}>${inline(cell)}</th>`,
            )
            .join('') +
          '</tr></thead><tbody>' +
          body
            .map(
              (row) =>
                '<tr>' +
                cells(row)
                  .map(
                    (cell, n) =>
                      `<td${alignment(rules[n] ?? '')}>${inline(cell)}</td>`,
                  )
                  .join('') +
                '</tr>',
            )
            .join('') +
          '</tbody></table></div>',
      );
      continue;
    }
    if (line.startsWith('>')) {
      flush();
      const quoted: string[] = [];
      while (i < lines.length && lines[i].startsWith('>'))
        quoted.push(lines[i++].replace(/^>\s?/, ''));
      i--;
      const tagged = /^\[!([^\]]+)\]\s*(.*)$/.exec(quoted[0] ?? '');
      const label = tagged && callouts.includes(tagged[1]) ? tagged[1] : null;
      if (label) quoted[0] = tagged?.[2] ?? '';
      const text = quoted.filter((l, n) => l.trim() || n).join('\n');
      html.push(
        label
          ? `<div class="wiki-callout" data-tone="${label}"><strong>${label}</strong><p>${inline(text.trim()).replaceAll('\n', '<br />')}</p></div>`
          : `<blockquote><p>${inline(text.trim()).replaceAll('\n', '<br />')}</p></blockquote>`,
      );
      continue;
    }
    if (itemPattern.test(line)) {
      flush();
      const items: Item[] = [];
      while (
        i < lines.length &&
        (itemPattern.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))
      ) {
        const match = itemPattern.exec(lines[i]);
        if (match)
          items.push({
            indent: match[1].length,
            ordered: match[2] === undefined,
            text: match[4],
          });
        // An indented line without a marker continues the item above it.
        else if (items.length)
          items[items.length - 1].text += ' ' + lines[i].trim();
        i++;
      }
      i--;
      html.push(renderItems(items, 0, items[0].indent)[0]);
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return { html: html.join('\n'), headings };
}
/**
 * Plain text of a page, used for search matching and for the snippet shown in
 * a search result. Table pipes, checkboxes and callout markers are dropped so
 * the snippet reads as a sentence rather than as markup.
 */
export function markdownText(source: string) {
  // Line endings do not matter here: the final pass collapses all whitespace.
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\|[\s:|-]+\|\s*$/gm, ' ')
    .replace(/^[>#\s-]*/gm, '')
    .replace(/\[!([^\]]+)\]/g, '')
    .replace(/\[[ xX]\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
