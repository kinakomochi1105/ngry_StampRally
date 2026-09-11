---
title: 配信とインフラ
category: 技術・インフラ
audience: 技術担当
summary: Vercel + Turso での配信、Cloudflare Tunnel、LAN内HTTPS。どれを選ぶかの判断材料付きです。
updated: 2026-09-11
order: 150
tags: [Vercel, Turso, HTTPS, トンネル]
---

## なぜHTTPSが必須か

ブラウザは安全なコンテキスト（HTTPSまたはlocalhost）でしかカメラを許可しません。`http://192.168.x.x` で開くとQRの連続読み取りができません。**配信方式の選択は、事実上カメラが使えるかどうかの選択です。**

## 選択肢の比較

| 方式 | 向く場面 | 注意 |
| --- | --- | --- |
| Vercel（本番） | 通常の開催 | インターネット必須。無料枠の上限を確認 |
| Cloudflare Tunnel | 手元のPCで動かしたい | 常時2プロセス。回線が切れると止まる |
| LAN内HTTPS（自己署名） | スタッフ検証・小規模 | **端末ごとに警告画面が出る** |

> [!注意]
> 自己署名証明書では参加者の端末ごとに1回、「この接続ではプライバシーが保護されません」という警告が出ます。1000人規模でこれを案内するのは現実的ではなく、警告を無視する習慣をつけさせることにもなります。スタッフ端末での検証や小規模開催に留めてください。

## Vercelへの配信

1. Tursoでデータベースを作り、URLとトークンを取得します。

```bash
turso db create ngry-stamprally
turso db show ngry-stamprally --url
turso db tokens create ngry-stamprally
```

2. そのデータベースへマイグレーションを適用します。

```powershell
$env:TURSO_DATABASE_URL='libsql://<db>.turso.io'; $env:TURSO_AUTH_TOKEN='<token>'; npm run db:migrate
```

3. Vercelのプロジェクト設定で `TURSO_DATABASE_URL`・`TURSO_AUTH_TOKEN`・`ADMIN_PASSWORD`・`RALLY_SECRET` を登録します。
4. リポジトリを接続すると `next build` が走ります。追加の設定ファイルは不要です。実行リージョンは東京（`hnd1`）に固定しています。

マニュアルのMarkdownはどのモジュールからも import しないため、`next.config.ts` の `outputFileTracingIncludes` で `content/manual` を配信物に含めています。ページを増やしても設定の変更は不要ですが、**フォルダーを移したら設定も直してください。**

## Cloudflare Tunnel

```powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel login
cloudflared tunnel create festival-rally
cloudflared tunnel route dns festival-rally <your-domain>
Copy-Item cloudflared.example.yml cloudflared.yml
```

開催中は2プロセスを並行して動かします。

```powershell
npm run dev      # 別ウィンドウで
npm run tunnel
```

ドメインを用意せず試すだけなら `npm run tunnel:quick` で使い捨てURLが出ます。`.trycloudflare.com` は既定の許可ホストに入れてあります。別のホスト名を使うときだけ許可リストを上書きします。

```powershell
$env:RALLY_ALLOWED_HOSTS='example.com,.trycloudflare.com'; npm run dev
```

Cloudflareはエッジでhttpsを終端し、ローカルへはhttpで転送します。そのためサーバーから見たURLはhttpのままですが、`lib/server.ts` が `X-Forwarded-Proto`・`X-Forwarded-Host`・`CF-Visitor` を優先して見るため、Cookieの `Secure` 属性とオリジン照合（CSRF対策）は正しく動きます。

## LAN内HTTPS

```powershell
npm run setup:https
npm run dev:https
```

この端末のLAN IPをすべてSANに含む証明書を `.certs/` に作ります（秘密鍵はGit管理外）。表示された `https://192.168.x.x:3000/` を開きます。

## 障害時の確認順

1. 本番URLが開くか（携帯回線の端末で）。
2. 開かない → 配信基盤の状態を確認（Vercelのデプロイ状況、Cloudflareのトンネル）。
3. 開くがデータが出ない → データベース。`TURSO_DATABASE_URL`・トークンの有効期限を確認。
4. サーバーのログに赤い `✗ API ...` 行が出ていればそこに原因が出ています。参加者向けの応答は日本語の定型文に置き換えているため、画面からは原因が分かりません。

## ビルドに関する制限

作業コピーがexFATのドライブにあると、シンボリックリンクを作れずNext.jsのビルドとdev serverが起動しません。NTFSのパスに複製するか、Vercelのリモートビルドを使ってください。
