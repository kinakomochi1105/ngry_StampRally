---
title: 配信とインフラ
category: 技術・インフラ
audience: 技術担当
summary: Vercel + Turso での配信とLAN内HTTPS、マイグレーション、CI。どれを選ぶかの判断材料付きです。
updated: 2026-09-13
order: 150
tags: [Vercel, Turso, HTTPS, CI]
---

## なぜHTTPSが必須か

ブラウザは安全なコンテキスト（HTTPSまたはlocalhost）でしかカメラを許可しません。`http://192.168.x.x` で開くとQRの連続読み取りができません。**配信方式の選択は、事実上カメラが使えるかどうかの選択です。**

## 選択肢の比較

| 方式 | 向く場面 | 注意 |
| --- | --- | --- |
| Vercel（本番） | 通常の開催 | インターネット必須。無料枠の上限を確認 |
| LAN内HTTPS（自己署名） | スタッフ検証・小規模 | **端末ごとに警告画面が出る** |

以前あった Cloudflare Tunnel での配信は廃止しました。手元のPCを公開する経路は、転送ヘッダーの偽装で試行回数の制限をすり抜けられる弱点があったためです。

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
$env:TURSO_DATABASE_URL='libsql://<db>.turso.io'; $env:TURSO_AUTH_TOKEN='<token>'; npm run db:migrate:remote
```

3. Vercelのプロジェクト設定（Production）で次を登録します。値の意味は[開催前セットアップ](./setup.md)にまとめています。
   - `TURSO_DATABASE_URL`・`TURSO_AUTH_TOKEN`
   - `ADMIN_PASSWORD`・`RALLY_SECRET`
   - `NICKNAME_BLOCKLIST_KEY`・`NICKNAME_BLOCKLIST_IV`（未設定だと新規登録がすべて失敗します）
   - 必要なら `RALLY_SITE_URL`・`RALLY_EVENT_ID`
4. リポジトリを接続すると `npm run build` が走ります。実行リージョンは東京（`hnd1`）に固定しています。

マニュアルのMarkdownと禁止語ファイルはどのモジュールからも import しないため、`next.config.ts` の `outputFileTracingIncludes` で配信物に含めています。ページを増やしても設定の変更は不要ですが、**フォルダーを移したら設定も直してください。**

### 列を増やす変更をデプロイするとき

`build` スクリプトは `next build` が**成功したあと**に未適用のマイグレーションを流します。ビルドが失敗したときに、データベースだけが先に新しくなることはありません。Vercelのビルドには環境変数が渡るため、**本番（Production）へのデプロイでは git push するだけで本番データベースにも適用されます。**

- **プレビューデプロイでは適用しません。** 未レビューのブランチが本番のスキーマを変えないためです。プレビュー専用のデータベースを割り当てている場合だけ、そのプレビューの環境変数に `MIGRATE_PREVIEW_DATABASE=1` を設定します。
- 環境変数が無いビルド（クローンしただけの状態など）では移行を飛ばします。
- 本番ビルドで `TURSO_DATABASE_URL` が無い場合は、**ビルドを失敗させます**。
- 適用後、`drizzle/` にあるマイグレーションの数とデータベースの記録数が合わなければ失敗します。

手元から明示的に当てたいときは次を使います。新しいコードを先に配信すると存在しない列を読みに行き、参加者の画面が503（「スタンプ帳を読み込めませんでした」）になります。

```powershell
$env:TURSO_DATABASE_URL='libsql://<db>.turso.io'
$env:TURSO_AUTH_TOKEN='<token>'
npm run db:migrate:remote
```

`db:migrate:remote` は**どのデータベースに接続したか・適用前後の件数と記録数**を表示します。`drizzle-kit migrate`（`npm run db:migrate`）は環境変数を設定し忘れると黙ってローカルの `local.db` を更新して成功と表示するため、本番へ当てるときはこちらを使ってください（トークンは文字数だけ表示し、値は出しません）。

列の追加は既存データを書き換えません。適用後に `https://<本番URL>/api/passport` が200を返すか確認してください。503のままなら、Vercelのプロジェクト → Logs で `no such column` が出ていないか見ます。出ている場合は、**適用したデータベースとVercelの `TURSO_DATABASE_URL` が別物**です。表示された接続先と、`contents` 行の件数（本番なら設置場所が0件ではないはず）を照らし合わせてください。

`turso db shell` で直接 `ALTER TABLE` を打つのは避けてください。`__drizzle_migrations` に記録が残らないため、次回の移行が「列が重複している」と言って止まります。

## LAN内HTTPS

```powershell
npm run setup:https
npm run dev:https
```

この端末のLAN IPをすべてSANに含む証明書を `.certs/` に作ります（秘密鍵はGit管理外）。表示された `https://192.168.x.x:3000/` を開きます。

Vercel以外で動かしているときは、転送ヘッダーの接続元IPを信用しません（誰でも書き換えられるため）。そのため試行回数の制限は**すべての端末で1つの枠を共有**します。多人数での本番運用には向きません。

## CI

GitHub へ push するか Pull Request を作ると、`.github/workflows/ci.yml` が次を実行します。

1. `npm run typecheck`（型検査）と `npm run lint`（静的検査）
2. `npm test`（単体テストとこのwikiの検査。サーバー不要）
3. `npm run build` のあと本番サーバーを起動し、`npm run test:api` と `npm run test:i18n`

CIでは秘密値・データベース・暗号化した禁止語リストをその場で使い捨てで作るため、リポジトリに秘密を登録する必要はありません。

## 障害時の確認順

1. 本番URLが開くか（携帯回線の端末で）。
2. 開かない → Vercelのデプロイ状況を確認。
3. 開くがデータが出ない → データベース。`TURSO_DATABASE_URL`・トークンの有効期限を確認。
4. Vercelのログに赤い `✗ API ...` 行が出ていればそこに原因が出ています。参加者向けの応答は日本語の定型文に置き換えているため、画面からは原因が分かりません。ログにはSQL文と原因だけを出し、ニックネームなどの値は出しません。
5. 管理画面の「設定・データ管理」の上部に赤い警告が出ていないか確認します（禁止語リストの鍵が未設定だと、ここに表示されます）。

## ビルドに関する制限

作業コピーがexFATのドライブにあると、シンボリックリンクを作れずNext.jsのビルドとdev serverが起動しません。NTFSのパスに置くか、Vercelのリモートビルドを使ってください。
