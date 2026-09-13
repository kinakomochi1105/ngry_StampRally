import { mkdirSync, writeFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import QRCode from 'qrcode';
import { sampleSpots, event } from '../lib/event.ts';
const secret = process.env.RALLY_SECRET;
if (!secret || secret.length < 32)
  throw new Error('Load RALLY_SECRET with node --env-file=.env');
// Posters carry a link so a phone camera app can open them, which means the
// public address has to be known before printing. RALLY_SITE_URL is the same
// value the server uses for the codes shown in the admin screen.
const site = (process.env.RALLY_SITE_URL ?? '').trim().replace(/\/+$/, '');
if (!/^https?:\/\/[^/?#\s]+$/.test(site))
  throw new Error(
    'Set RALLY_SITE_URL to the public address, e.g. RALLY_SITE_URL=https://rally.example.jp',
  );
mkdirSync('outputs', { recursive: true });
const esc = (s) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
let cards = '';
for (const [index, spot] of sampleSpots.entries()) {
  const signature = createHmac('sha256', secret)
    .update(`qr:${event.id}:${spot.id}`)
    .digest('hex');
  const code = `${site}/s/${spot.id}/${signature}`;
  const qr = await QRCode.toString(code, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 320,
  });
  cards += `<section><p>文化祭 STAMP RALLY / ${index + 1}</p><h1>${esc(spot.name)}</h1><h2>${esc(spot.location)}</h2>${qr}<h2>スマホのカメラで読み取ってください。<br>スタンプラリーのサイトが開き、自動でスタンプが押されます。</h2><p>${esc(site)}</p><p>${esc(spot.description)}</p><small>開催準備用サンプル。本番の場所へ差し替えてから印刷してください。</small></section>`;
}
writeFileSync(
  'outputs/qr-posters.html',
  `<!doctype html><html lang="ja"><meta charset="utf-8"><title>文化祭 設置用QRコード</title><style>body{font-family:Meiryo,sans-serif;color:#18223b;margin:0}section{box-sizing:border-box;text-align:center;padding:32px;margin:24px auto;max-width:700px;border:2px solid #294aee;break-after:page}h1{font-size:32px}h2{font-size:20px}svg{display:block;margin:30px auto;max-width:100%;height:auto}small{font-size:12px}@media print{section{margin:0;border:0;height:270mm;display:flex;flex-direction:column;align-items:center;justify-content:center}button{display:none}}</style><button onclick="window.print()">印刷する</button>${cards}</html>`,
);
console.log(
  'Generated outputs/qr-posters.html (6 posters). Keep QR data restricted to organizers until installation.',
);
