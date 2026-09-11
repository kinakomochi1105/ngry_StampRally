---
title: 開催前セットアップ
category: 開催準備
audience: 技術担当
summary: 環境変数、データベース、管理者パスワードを用意して管理画面に入れるようにするまでの手順です。
updated: 2026-09-11
order: 30
tags: [環境変数, データベース, 初期設定]
---

## 必要なもの

- Node.js 24を推奨（アプリの最低要件は22.13）。
- libSQL（Turso）のデータベース、またはローカルの `file:local.db`。
- 管理者パスワードとQR署名用の秘密値。

## ローカルで動かす

```powershell
npm ci
node scripts/setup-secret.mjs
node scripts/setup-admin.mjs
npm run db:migrate
npm run dev
```

`scripts/setup-admin.mjs` が作った初期パスワードはローカルの `outputs/admin-access.txt` に保存されます。公開ディレクトリやGitには入れません。

## 環境変数

| 変数 | 用途 | 注意 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 管理画面のログイン | 16文字以上。変更すると管理者セッションが無効になる |
| `RALLY_SECRET` | QR・Cookieの署名 | 32バイト以上の乱数。**開催中に変えると既存QRとCookieが全部無効** |
| `TURSO_DATABASE_URL` | データベース接続 | ローカルは `file:local.db` |
| `TURSO_AUTH_TOKEN` | Turso利用時の認証 | ローカルファイルなら不要 |

> [!重要]
> `RALLY_SECRET` を開催中に変更すると、印刷済みのQRコードが全部読めなくなり、参加者のログインも切れます。開催前に決めて、開催が終わるまで触らないでください。

## データベース

スキーマを変えたときだけ `npm run db:generate` でマイグレーションを作り、SQLを目で確認します。適用済みのSQLとスナップショットは編集しません。

```powershell
npm run db:migrate
```

本番のTursoへ適用するときは、そのデータベースを指す `TURSO_DATABASE_URL` と `TURSO_AUTH_TOKEN` を環境変数に入れて同じコマンドを実行します。

## 管理画面に入る

1. `/admin` を直接開きます。参加者画面に管理者向けのボタンは表示されません。
2. 管理者パスワードでログインします。セッションは8時間で切れます。
3. 新しいデータベースでは設置場所が空です。「設置場所・QRコード」から実際の場所を追加するか、「仮の6か所を作成」を押して編集します。
4. 「設定・データ管理」で文化祭名、学年、組、出席番号の上限を会場に合わせます。
5. 同じ画面で**係員用の暗証番号**を設定します。未設定のままだと参加者は報酬を受け取れません。

## 開催前チェックリスト

- [ ] `ADMIN_PASSWORD` と `RALLY_SECRET` を本番環境変数に登録した
- [ ] マイグレーションを本番データベースに適用した
- [ ] 学年・組・出席番号の上限が実際の学校に合っている
- [ ] 設置場所を登録し、公開／非公開を意図どおりにした
- [ ] 係員暗証番号を設定した
- [ ] 新規参加登録を受け付ける設定になっている
- [ ] 管理者パスワードを本部責任者と技術担当の2人以上が把握している
- [ ] [リハーサルと実機検証](./rehearsal.md) を実施した

## 静的検査とテスト

```powershell
node --env-file=.env tests/api.mjs
node tests/i18n.mjs
node tests/manual.mjs
npx tsc --noEmit
npx oxlint app components lib db
npm run build
```

`tests/api.mjs` と `tests/i18n.mjs` はローカルのdev serverに接続します。本番に向けて実行できないよう、ローカル接続だけを許可しています。`tests/manual.mjs` はサーバーを使わず、このwikiのMarkdownと変換処理を検査します。
