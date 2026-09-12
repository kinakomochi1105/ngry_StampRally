'use client';
import Link from 'next/link';
import {
  ArrowLeft,
  Crosshair,
  Hand,
  Lightbulb,
  MapPin,
  QrCode,
  Stamp,
  Trophy,
} from 'lucide-react';
import { LanguageSelect, useI18n } from '@/components/language';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

/**
 * The written guide, for the questions a three-screen walkthrough cannot
 * answer: what the camera needs, why a stamp was refused, how a pass moves to
 * another phone. The demo in the settings sheet shows the happy path once at
 * registration; this page stays put, so a visitor stuck in a corridor can read
 * it at their own pace.
 *
 * It fetches nothing. Every word here is about the app itself, never about
 * this festival's locations, so the page is safe to open before the access
 * word — and it still works when the network does not.
 */

/** The rally from arrival to reward, one card per move. */
const steps = [
  {
    icon: MapPin,
    title: '設置場所をさがす',
    body: '「設置場所」を開くと、QRコードが置かれている教室と案内が並びます。「フロアマップ」に切り替えると、階ごとの位置と今の混み具合も見られます。',
  },
  {
    icon: QrCode,
    title: 'QRコードを読み取る',
    body: '設置場所に着いたら立ち止まって「読み取る」を押し、カメラを許可します。QRコード全体が枠に入るように構えると、数秒で読み取れます。',
  },
  {
    icon: Stamp,
    title: 'スタンプ帳に増える',
    body: '読み取れたスタンプはその場で保存されます。「スタンプ帳」を開けば、獲得済みの場所と残りの場所をいつでも見返せます。',
  },
  {
    icon: Trophy,
    title: '全部集めて特典と交換',
    body: '「特典」タブに残りの個数が出ます。コンプリートしたら「報酬を受け取る」を押し、係員に画面を見せてください。',
  },
];

/** The three things that fix almost every failed scan. */
const tips = [
  {
    icon: Crosshair,
    title: '枠の中央に合わせる',
    body: '四角い枠の真ん中にQRコード全体が入るよう、端末を少し離して構えてください。近づけすぎるとピントが合いません。',
  },
  {
    icon: Lightbulb,
    title: '明るい場所で',
    body: '暗いところでは読み取れないことがあります。窓際や照明の下など、QRコードに光が当たる場所で試してください。',
  },
  {
    icon: Hand,
    title: '数秒だけ止める',
    body: '歩きながらでは像がぶれて読み取れません。立ち止まって端末を止めると、すぐに読み取れます。',
  },
];

/** Answers in the order the reception desk actually gets asked them. */
const questions = [
  {
    q: 'QRコードがうまく読み取れません',
    a: '端末を少し離して、枠の中央にQRコード全体が入るようにしてください。暗い場所ではピントが合いにくいので、明るい方へ向けると読み取れることがあります。それでも読めないときは、読み取り画面の「撮影済みのQRコード画像を選ぶ」から写真で読み取れます。',
  },
  {
    q: 'カメラが起動しません',
    a: 'ブラウザのカメラ権限が許可されているかご確認ください（端末の設定 → ブラウザ → カメラ）。通信環境によってはカメラ映像を表示できないことがあり、そのときは撮影した写真から読み取る画面に自動で切り替わります。',
  },
  {
    q: '同じスタンプを何度でも取れますか',
    a: '1か所につき1個までです。獲得済みのQRコードを読み取ったときは、その場でお知らせします。スタンプ帳の数は増えません。',
  },
  {
    q: '登録やログインは必要ですか',
    a: '最初にニックネームなどを登録すると、参加情報をこの端末のブラウザに保存します。パスワードは使いません。氏名・連絡先・位置情報は集めず、カメラの映像も送信しません。',
  },
  {
    q: '端末を変えたい・Cookieを消してしまいました',
    a: '設定の「再ログイン・端末の変更」で復旧コードを発行しておくと、ニックネームと復旧コードで同じスタンプ帳に戻れます。復旧コードを紛失した場合は、元の端末で再発行するか受付へご相談ください。',
  },
  {
    q: '混み具合はどうやって決まりますか',
    a: '直近のQRコード読み取り件数と、参加者からの報告の平均で表示します。報告がある場所は報告を優先します。正確な待ち時間を示すものではないため、目安としてご覧ください。',
  },
  {
    q: '特典はどうやって受け取りますか',
    a: '全てのスタンプを集めると「特典」タブに「報酬を受け取る」が出ます。押すと係員用の画面になり、係員が暗証番号を入力すると交換が確定します。交換できるのは1回だけです。',
  },
];

export default function Help() {
  const { t } = useI18n();
  return (
    <main className="participant-app help-page">
      <a className="skip-link" href="#main-content">
        {t('本文へ移動')}
      </a>
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Stamp size={21} aria-hidden="true" />
          </span>
          <span className="brand-text">
            <strong>{t('使い方ガイド')}</strong>
            <small>STAMP RALLY</small>
          </span>
        </Link>
        <div className="topbar-actions">
          <ThemeToggle />
          <LanguageSelect />
        </div>
      </header>

      <div className="app-body">
        <div className="app-main" id="main-content">
          <Link href="/" className="back-link">
            <ArrowLeft size={18} aria-hidden="true" />
            {t('スタンプラリーに戻る')}
          </Link>

          <section className="help-hero">
            <p className="eyebrow">HOW TO USE</p>
            <h1>{t('スタンプを集めて、文化祭を歩きつくそう。')}</h1>
            <p className="help-lead">
              {t(
                '設置場所のQRコードを読み取ると、スタンプ帳が1つずつ埋まっていきます。混み具合も見られるので、いま空いている場所から回れます。',
              )}
            </p>
          </section>

          <section className="help-section" aria-labelledby="help-steps">
            <h2 id="help-steps">{t('4ステップで遊べる')}</h2>
            <ol className="help-steps">
              {steps.map(({ icon: Icon, title, body }, i) => (
                <li key={title}>
                  <span className="help-step-mark" aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <p className="eyebrow">STEP {i + 1}</p>
                  <strong>{t(title)}</strong>
                  <p>{t(body)}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="help-section" aria-labelledby="help-tips">
            <h2 id="help-tips">{t('読み取りのコツ')}</h2>
            <ul className="help-tips">
              {tips.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <span className="help-tip-mark" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <strong>{t(title)}</strong>
                  <p>{t(body)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="help-section" aria-labelledby="help-faq">
            <h2 id="help-faq">{t('よくある質問')}</h2>
            <div className="help-faq">
              {questions.map(({ q, a }) => (
                <details className="help-answer" key={q}>
                  <summary>{t(q)}</summary>
                  <p>{t(a)}</p>
                </details>
              ))}
            </div>
          </section>

          <div className="help-cta">
            <Button
              className="primary-action"
              render={<Link href="/" />}
              nativeButton={false}
            >
              {t('スタンプラリーに戻る')}
            </Button>
          </div>

          <footer>
            <span>{t('生徒会総務部')}</span>
            <span>{t('歩きスマホはお控えください。')}</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
