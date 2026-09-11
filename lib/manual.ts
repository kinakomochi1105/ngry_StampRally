import { markdownText, renderMarkdown, type Heading } from './markdown';
/**
 * The administrator wiki reads its pages from `content/manual/*.md`, so a manual
 * is reviewed and versioned like the rest of the repository instead of living in
 * the database. Nothing writes to that directory at runtime: the serverless
 * filesystem on Vercel is read-only, and keeping the pages in Git is what makes
 * a bad edit revertable.
 */
export type ManualMeta = {
  slug: string;
  title: string;
  category: string;
  audience: string;
  summary: string;
  updated: string;
  order: number;
  tags: string[];
  file: string;
};
export type ManualPage = ManualMeta & {
  html: string;
  headings: Heading[];
  markdown: string;
  text: string;
};
export type ManualSection = { category: string; pages: ManualMeta[] };
export type ManualHit = ManualMeta & { snippet: string };
const required = [
  'title',
  'category',
  'audience',
  'summary',
  'updated',
  'order',
] as const;
/** `tags: [受付, QR]` or `tags: 受付, QR`; both spellings are accepted. */
const tagList = (value: string) =>
  value
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(/[,、]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
export function parseManual(slug: string, source: string): ManualPage {
  const file = `content/manual/${slug}.md`;
  const normalized = source.replaceAll('\r\n', '\n').replace(/^\uFEFF/, '');
  const header = /^---\n([\s\S]*?)\n---\n?/.exec(normalized);
  // A malformed page throws instead of rendering blank: `tests/manual.mjs` and
  // the request that opens the wiki both surface the file name that way.
  if (!header) throw new Error(`${file}: 先頭のメタ情報（---）がありません。`);
  const values = new Map<string, string>();
  for (const line of header[1].split('\n')) {
    const pair = /^([a-z]+):\s*(.*)$/.exec(line.trim());
    if (pair) values.set(pair[1], pair[2].trim());
  }
  const missing = required.filter((key) => !values.get(key));
  if (missing.length)
    throw new Error(`${file}: メタ情報 ${missing.join(', ')} がありません。`);
  const updated = values.get('updated') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(updated))
    throw new Error(`${file}: updated は YYYY-MM-DD で書いてください。`);
  const order = Number(values.get('order'));
  if (!Number.isInteger(order))
    throw new Error(`${file}: order は整数で書いてください。`);
  const markdown = normalized.slice(header[0].length).trim();
  if (!markdown) throw new Error(`${file}: 本文がありません。`);
  const { html, headings } = renderMarkdown(markdown);
  return {
    slug,
    file,
    title: values.get('title') ?? '',
    category: values.get('category') ?? '',
    audience: values.get('audience') ?? '',
    summary: values.get('summary') ?? '',
    updated,
    order,
    tags: tagList(values.get('tags') ?? ''),
    html,
    headings,
    markdown,
    text: markdownText(markdown),
  };
}
async function readPages() {
  const [fs, path] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
  ]);
  // The markdown is not imported by any module, so Next only ships it to the
  // serverless function because `outputFileTracingIncludes` in next.config.ts
  // names the directory.
  const roots = [
    path.join(process.cwd(), 'content', 'manual'),
    path.join(process.cwd(), 'Server', 'content', 'manual'),
  ];
  for (const root of roots) {
    let names: string[];
    try {
      names = await fs.readdir(root);
    } catch {
      continue;
    }
    const pages = await Promise.all(
      names
        .filter((name) => name.endsWith('.md'))
        .map(async (name) => {
          const slug = name.slice(0, -3);
          if (!/^[a-z0-9-]{1,64}$/.test(slug))
            throw new Error(
              `content/manual/${name}: ファイル名は英小文字・数字・ハイフンだけにしてください。`,
            );
          return parseManual(
            slug,
            await fs.readFile(path.join(root, name), 'utf8'),
          );
        }),
    );
    if (!pages.length) throw new Error('運営マニュアルのページがありません。');
    return pages.sort(
      (a, b) => a.order - b.order || a.slug.localeCompare(b.slug),
    );
  }
  throw new Error('運営マニュアルのフォルダーが見つかりません。');
}
let cached: Promise<ManualPage[]> | undefined;
export function manualPages() {
  // Pages never change while a deployment is live, so one read per instance is
  // enough in production. In development they are read every time, which keeps
  // an edit visible without restarting the server.
  if (process.env.NODE_ENV !== 'production') return readPages();
  cached ??= readPages().catch((error: unknown) => {
    // A failed read must not be cached, or one cold-start hiccup would hide the
    // manual for the life of the instance.
    cached = undefined;
    throw error;
  });
  return cached;
}
const meta = (page: ManualPage): ManualMeta => ({
  slug: page.slug,
  file: page.file,
  title: page.title,
  category: page.category,
  audience: page.audience,
  summary: page.summary,
  updated: page.updated,
  order: page.order,
  tags: page.tags,
});
export async function manualIndex() {
  const pages = await manualPages();
  const sections: ManualSection[] = [];
  for (const page of pages) {
    // Pages arrive in `order`, so the first page of a category also fixes where
    // that category sits in the sidebar.
    const section = sections.find((s) => s.category === page.category);
    if (section) section.pages.push(meta(page));
    else sections.push({ category: page.category, pages: [meta(page)] });
  }
  return {
    sections,
    count: pages.length,
    updated: pages.reduce(
      (latest, p) => (p.updated > latest ? p.updated : latest),
      '',
    ),
  };
}
export async function manualPage(slug: string) {
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return null;
  const pages = await manualPages();
  const index = pages.findIndex((page) => page.slug === slug);
  if (index < 0) return null;
  const page = pages[index];
  return {
    ...meta(page),
    html: page.html,
    headings: page.headings,
    markdown: page.markdown,
    previous: index > 0 ? meta(pages[index - 1]) : null,
    next: index + 1 < pages.length ? meta(pages[index + 1]) : null,
  };
}
/** Full-width/half-width and upper/lower case differences are ignored. */
const fold = (value: string) => value.normalize('NFKC').toLowerCase();
export async function searchManual(query: string): Promise<ManualHit[]> {
  const needle = fold(query.trim());
  if (needle.length < 1) return [];
  const hits: (ManualHit & { score: number })[] = [];
  for (const page of await manualPages()) {
    const score =
      (fold(page.title).includes(needle) ? 8 : 0) +
      (page.tags.some((tag) => fold(tag).includes(needle)) ? 4 : 0) +
      (fold(page.summary).includes(needle) ? 3 : 0) +
      (fold(page.category + ' ' + page.audience).includes(needle) ? 2 : 0) +
      (fold(page.text).includes(needle) ? 1 : 0);
    if (!score) continue;
    // Case folding keeps the string length, so the offset still points at the
    // same place in the original text; NFKC is only used for matching.
    const at = page.text.toLowerCase().indexOf(query.trim().toLowerCase());
    hits.push({
      ...meta(page),
      score,
      snippet:
        at < 0
          ? page.summary
          : (at > 30 ? '…' : '') +
            page.text.slice(Math.max(0, at - 30), at + 90).trim() +
            '…',
    });
  }
  return hits
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, 20)
    .map(({ score: _score, ...hit }) => hit);
}
