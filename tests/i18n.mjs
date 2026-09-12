import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../lib/i18n.ts', import.meta.url));
const module = { exports: {} };
new Function(
  'require',
  'module',
  'exports',
  ts.transpileModule(fs.readFileSync('lib/i18n.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText,
)(require, module, module.exports);
const { translate, detectLocale } = module.exports;
assert.equal(detectLocale(['en-US', 'ja']), 'en');
assert.equal(detectLocale(['ja-JP', 'en']), 'ja');
assert.equal(detectLocale(['fr', 'en-GB']), 'en');
assert.equal(detectLocale(['ko']), 'ja');
assert.equal(detectLocale([]), 'ja');
assert.equal(
  translate('あと2か所。次のスポットへ出かけよう。', 'en'),
  '2 locations to go. Find your next stamp!',
);
assert.equal(translate('QRコードを読み取る', 'ja'), 'QRコードを読み取る');
assert.equal(translate('QRコードを読み取る', 'en'), 'Scan QR code');
assert.equal(translate('学校独自の場所', 'en'), '学校独自の場所');
const en = JSON.parse(fs.readFileSync('lib/en.json', 'utf8'));
let count = 0;
// Every screen that renders Japanese UI copy through t(). A file added here
// fails the run until each of its strings has an English entry.
for (const path of [
  'app/page.tsx',
  'app/admin/page.tsx',
  'components/enrollment.tsx',
  'components/recovery.tsx',
  'components/scanner.tsx',
  'components/reward.tsx',
  'components/rally-demo.tsx',
  'components/floor-map.tsx',
  'components/admin-stamps.tsx',
  'components/admin-wiki.tsx',
  'components/participant/passport-card.tsx',
  'components/participant/stamp-book.tsx',
  'components/participant/places-list.tsx',
  'components/participant/reward-panel.tsx',
  'components/participant/rally-nav.tsx',
  'components/participant/crowd-report.tsx',
  'components/participant/settings-dialog.tsx',
  'components/admin/admin-login.tsx',
  'components/admin/participants-panel.tsx',
  'components/admin/spots-panel.tsx',
  'components/admin/settings-panel.tsx',
  'components/admin/spot-dialog.tsx',
  'components/admin/person-dialog.tsx',
  'components/admin/poster-dialog.tsx',
  'components/theme-toggle.tsx',
]) {
  const sf = ts.createSourceFile(
    path,
    fs.readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const check = (arg) => {
    if (!arg) return;
    // `t(condition ? 'あ' : 'い')` is as common as a plain literal, so both
    // branches count.
    if (ts.isConditionalExpression(arg)) {
      check(arg.whenTrue);
      check(arg.whenFalse);
      return;
    }
    if (!ts.isStringLiteral(arg)) return;
    assert.ok(
      en[arg.text] !== undefined,
      'Missing translation in ' + path + ': ' + arg.text,
    );
    count++;
  };
  function walk(n) {
    if (ts.isCallExpression(n) && n.expression.getText(sf) === 't')
      check(n.arguments[0]);
    ts.forEachChild(n, walk);
  }
  walk(sf);
}
console.log(
  'PASS: language negotiation, fallback, dynamic progress, data preservation and ' +
    count +
    ' localized UI strings.',
);
// `npm run dev:https` serves the same port over a self-signed certificate. Only
// localhost is probed, so trusting that certificate here cannot expose anything
// beyond this machine's own dev server.
const origin = await (async () => {
  try {
    await fetch('http://localhost:3000/', { redirect: 'manual' });
    return 'http://localhost:3000';
  } catch {}
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  try {
    await fetch('https://localhost:3000/', { redirect: 'manual' });
    return 'https://localhost:3000';
  } catch {}
  throw Error('Dev server not reachable on port 3000.');
})();
for (const path of ['/', '/admin', '/admin/wiki', '/admin/wiki/reward']) {
  const r = await fetch(origin + path);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Language/);
  console.log('PASS: HTTP 200 with language selector ' + path);
}
