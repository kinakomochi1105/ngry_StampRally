import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
// The wiki's two modules are plain TypeScript with no framework imports, so they
// run here the same way `tests/i18n.mjs` runs the translation helper: transpile
// and evaluate. No server is needed — the pages come from the repository.
const nodeRequire = createRequire(new URL('../lib/manual.ts', import.meta.url));
function load(path, stubs = {}) {
  const module = { exports: {} };
  new Function(
    'require',
    'module',
    'exports',
    ts.transpileModule(fs.readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    }).outputText,
  )((id) => stubs[id] ?? nodeRequire(id), module, module.exports);
  return module.exports;
}
const markdown = load('lib/markdown.ts');
const manual = load('lib/manual.ts', { './markdown': markdown });
const { renderMarkdown, markdownText } = markdown;
const { parseManual, manualPages, manualIndex, manualPage, searchManual } =
  manual;

// --- Rendering -------------------------------------------------------------
const escaped = renderMarkdown('<script>alert(1)</script> & "quoted"');
assert.ok(!escaped.html.includes('<script'), 'HTML must not survive rendering');
assert.match(escaped.html, /&lt;script&gt;/);
assert.match(escaped.html, /&amp;/);

const headings = renderMarkdown('## 当日の流れ\n本文\n### 受付\n本文');
assert.deepEqual(
  headings.headings.map((h) => [h.level, h.text, h.id]),
  [
    [3, '当日の流れ', 'manual-section-1'],
    [4, '受付', 'manual-section-2'],
  ],
);
assert.match(headings.html, /<h3 id="manual-section-1">当日の流れ<\/h3>/);

const lists = renderMarkdown('- 親\n  - 子\n- [ ] 未実施\n- [x] 済み');
assert.match(lists.html, /<li>親<ul><li>子<\/li><\/ul><\/li>/);
assert.match(lists.html, /<li class="wiki-task">未実施<\/li>/);
assert.match(lists.html, /<li class="wiki-task done">済み<\/li>/);
assert.match(renderMarkdown('1. 一つ\n2. 二つ').html, /^<ol><li>一つ<\/li>/);

const table = renderMarkdown('| 症状 | 対応 |\n| --- | ---: |\n| A | B |');
assert.match(table.html, /<div class="wiki-table"><table><thead>/);
assert.match(table.html, /<th style="text-align:right">対応<\/th>/);
assert.match(table.html, /<td>A<\/td><td style="text-align:right">B<\/td>/);

const callout = renderMarkdown('> [!重要]\n> 暗証番号を設定してください。');
assert.match(callout.html, /class="wiki-callout" data-tone="重要"/);
assert.match(callout.html, /暗証番号を設定してください。/);
assert.match(
  renderMarkdown('> ふつうの引用').html,
  /<blockquote><p>ふつうの引用<\/p><\/blockquote>/,
);

const code = renderMarkdown('```\nnpm run dev -- **太字ではない**\n```');
assert.match(
  code.html,
  /<pre><code>npm run dev -- \*\*太字ではない\*\*<\/code>/,
);
assert.ok(
  !renderMarkdown('`**強調しない**`').html.includes('<strong>'),
  'code spans must stay literal',
);
assert.match(renderMarkdown('**太字**と*斜体*').html, /<strong>太字<\/strong>/);

// Links: other manual pages carry a slug, web links open externally, and
// anything else stays text.
assert.match(
  renderMarkdown('[受付](./reception.md)').html,
  /<a href="#" data-slug="reception">受付<\/a>/,
);
assert.match(
  renderMarkdown('[外部](https://example.com/a)').html,
  /<a href="https:\/\/example\.com\/a" target="_blank" rel="noreferrer">/,
);
for (const bad of [
  '[危険](javascript:alert(1))',
  '[危険](data:text/html,<script>)',
]) {
  assert.ok(!renderMarkdown(bad).html.includes('<a '), 'rejected: ' + bad);
}
assert.equal(
  markdownText('## 見出し\n- `コード` と [リンク](https://example.com)'),
  '見出し コード と リンク',
);
// Search snippets are read as sentences, so table pipes, checkboxes and callout
// markers must not survive into them.
assert.equal(
  markdownText('| 症状 | 対応 |\n| --- | --- |\n| A | B |'),
  '症状 対応 A B',
);
assert.equal(markdownText('- [ ] 点検する\n- [x] 済み'), '点検する 済み');
assert.equal(
  markdownText('> [!重要] 設定してください。'),
  '設定してください。',
);
assert.equal(
  markdownText('`ADMIN_PASSWORD` を変更する'),
  'ADMIN_PASSWORD を変更する',
);

// --- Front matter ----------------------------------------------------------
const page = parseManual(
  'sample',
  [
    '---',
    'title: 見本',
    'category: 当日運営',
    'audience: 本部',
    'summary: 見本の要約。',
    'updated: 2026-09-11',
    'order: 40',
    'tags: [受付, QR]',
    '---',
    '',
    '## 本文',
  ].join('\n'),
);
assert.equal(page.title, '見本');
assert.equal(page.order, 40);
assert.deepEqual(page.tags, ['受付', 'QR']);
assert.equal(page.file, 'content/manual/sample.md');
const broken = {
  メタ情報がない: '## 本文だけ',
  'updated の書式':
    '---\ntitle: a\ncategory: b\naudience: c\nsummary: d\nupdated: 2026/09/11\norder: 1\n---\n本文',
  'order が数値でない':
    '---\ntitle: a\ncategory: b\naudience: c\nsummary: d\nupdated: 2026-09-11\norder: さん\n---\n本文',
  本文が空: '---\ntitle: a\ncategory: b\naudience: c\nsummary: d\nupdated: 2026-09-11\norder: 1\n---\n',
};
for (const [label, source] of Object.entries(broken))
  assert.throws(
    () => parseManual('sample', source),
    /content\/manual\/sample\.md/,
    label + ' must be reported with the file name',
  );

// --- The pages in this repository -----------------------------------------
const pages = await manualPages();
assert.ok(pages.length >= 15, 'expected a manual for every area');
const slugs = new Set(pages.map((p) => p.slug));
assert.equal(slugs.size, pages.length, 'slugs must be unique');
const orders = pages.map((p) => p.order);
assert.equal(
  new Set(orders).size,
  orders.length,
  'order values must be unique',
);
assert.deepEqual(
  orders,
  [...orders].sort((a, b) => a - b),
  'pages are sorted',
);
for (const p of pages) {
  assert.ok(p.summary.length <= 120, p.slug + ': summary is too long');
  assert.ok(
    !p.html.includes('<script'),
    p.slug + ': HTML leaked into the page',
  );
  assert.ok(p.headings.length > 0, p.slug + ': needs at least one heading');
  // Rendered links only: an example written inside a code span is not a link.
  for (const [, target] of p.html.matchAll(/data-slug="([a-z0-9-]+)"/g))
    assert.ok(slugs.has(target), `${p.slug}: link to missing ./${target}.md`);
}
// A category must not be split up: its pages have to sit together in `order`.
const index = await manualIndex();
assert.equal(index.count, pages.length, 'the index must list every page');
assert.equal(
  new Set(index.sections.map((s) => s.category)).size,
  index.sections.length,
  'each category appears once in the sidebar',
);
assert.match(index.updated, /^\d{4}-\d{2}-\d{2}$/);

const first = await manualPage(pages[0].slug);
assert.equal(first.previous, null);
assert.equal(first.next.slug, pages[1].slug);
assert.equal((await manualPage(pages[1].slug)).previous.slug, pages[0].slug);
assert.equal(await manualPage('../../etc/passwd'), null);
assert.equal(await manualPage('存在しない'), null);
assert.equal(await manualPage('nothing-here'), null);

const hits = await searchManual('復旧コード');
assert.ok(hits.length > 0, 'search must find the recovery code pages');
assert.ok(
  hits.some((hit) => hit.slug === 'reception'),
  'the reception page answers recovery code questions',
);
assert.ok(hits[0].snippet.length > 0, 'results carry a snippet');
assert.equal((await searchManual('  ')).length, 0);
assert.ok(
  (await searchManual('ＱＲコード')).length > 0,
  'full-width input must match',
);

console.log(
  'PASS: markdown escaping, headings, lists, tables, callouts, links, front ' +
    `matter validation and ${pages.length} manual pages in ${index.sections.length} categories.`,
);
