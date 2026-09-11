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
assert.equal(translate('QRを読み取る', 'ja'), 'QRを読み取る');
assert.equal(translate('QRを読み取る', 'en'), 'Scan QR code');
assert.equal(translate('学校独自の場所', 'en'), '学校独自の場所');
const en = JSON.parse(fs.readFileSync('lib/en.json', 'utf8'));
let count = 0;
for (const path of [
  'app/page.tsx',
  'app/admin/page.tsx',
  'components/enrollment.tsx',
  'components/recovery.tsx',
  'components/scanner.tsx',
  'components/reward.tsx',
]) {
  const sf = ts.createSourceFile(
    path,
    fs.readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function walk(n) {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(sf) === 't' &&
      n.arguments[0] &&
      ts.isStringLiteral(n.arguments[0])
    ) {
      assert.ok(
        en[n.arguments[0].text] !== undefined,
        'Missing translation: ' + n.arguments[0].text,
      );
      count++;
    }
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
for (const path of ['/', '/admin']) {
  const r = await fetch(origin + path);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Language/);
  console.log('PASS: HTTP 200 with language selector ' + path);
}
