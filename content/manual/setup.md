---
title: 開催前セットアップ
category: 開催準備
audience: 技術担当
summary: 環境変数、データベース、管理者パスワードを用意して管理画面に入れるようにするまでの手順です。
updated: 2026-09-13
order: 30
tags: [環境変数, データベース, 初期設定]
---

## 必要なもの

- Node.js 24を推奨（アプリの最低要件は22.13）。
- libSQL（Turso）のデータベース、またはローカルの `file:local.db`。
- 管理者パスワードとQR署名用の秘密値。
- 禁止語ファイル `Config/forbidden` の鍵と初期化ベクトル（EncryptorToolの `config.toml` にある値）。

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
| `NICKNAME_BLOCKLIST_KEY` | 禁止語ファイルの鍵（32バイト） | **未設定・不一致だと新規登録がすべて失敗する** |
| `NICKNAME_BLOCKLIST_IV` | 禁止語ファイルの初期化ベクトル（16バイト） | 同上 |
| `RALLY_SITE_URL` | QRに入れる公開アドレス | 未設定なら管理画面を開いているアドレス |
| `RALLY_EVENT_ID` | 文化祭の識別子 | 未設定なら `festival-2026`。**変えると既存QRとCookieが全部無効**。翌年の開催で新しい値にすると、前年のデータはそのまま残る |

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
2. 端末名（例：本部PC）と管理者パスワードでログインします。セッションは8時間で切れます。端末名は操作履歴に残ります。
3. 新しいデータベースでは設置場所が空です。「設置場所・QRコード」から実際の場所を追加するか、「仮の6か所を作成」を押して編集します。
4. 「設定・データ管理」で文化祭名、学年、組、出席番号の上限を会場に合わせます。
5. 同じ画面で**係員用の暗証番号**を設定します。報酬はふだん「景品引き換え」でバーコードを読み取って記録しますが、スキャナも管理画面も使えない窓口では暗証番号での確定が予備になります（[報酬の受け取り運用](./reward.md)）。暗証番号は6〜8桁です。
6. 景品窓口の係員に渡す**引き換え係のパスワード**を設定します。このパスワードでログインした端末は景品引き換えしか使えません。
7. 画面上部に赤い警告（禁止語リストを読み込めない等）が出ていないことを確認します。

## 開催前チェックリスト

- [ ] `ADMIN_PASSWORD`・`RALLY_SECRET`・`NICKNAME_BLOCKLIST_KEY`・`NICKNAME_BLOCKLIST_IV` を本番環境変数に登録した
- [ ] マイグレーションを本番データベースに適用した
- [ ] 学年・組・出席番号の上限が実際の学校に合っている
- [ ] 設置場所を登録し、公開／非公開を意図どおりにした
- [ ] 係員暗証番号（6〜8桁）と引き換え係のパスワードを設定した
- [ ] 新規参加登録を受け付ける設定になっている
- [ ] 管理者パスワードを本部責任者と技術担当の2人以上が把握している
- [ ] [リハーサルと実機検証](./rehearsal.md) を実施した

## 静的検査とテスト

```powershell
npm run typecheck
npm run lint
npm test
npm run test:api
npm run test:i18n
```

- `npm test` はサーバーを使わない検査です。ニックネーム判定・引き換えコード・QRの解釈・CSVの数式対策・設定の読み込み・署名・管理セッションの単体テストと、このwikiのMarkdownと変換処理を検査します。
- `npm run test:api` と `npm run test:i18n` はローカルのdev server（`npm run dev`）に接続します。本番に向けて実行できないよう、ローカル接続だけを許可しています。
- テストはデータを書き込みます。`.env.local` に本番のTursoの値を入れている場合は、`.env.development.local` に `TURSO_DATABASE_URL=file:local.db` を書いて、dev serverがローカルのデータベースを使うようにしてください（`.env.development.local` は開発時だけ `.env.local` より優先されます）。
- 同じ検査は GitHub へ push するたびにCIでも実行されます（[配信とインフラ](./infrastructure.md)）。
