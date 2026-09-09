'use client';
import { useI18n } from '@/components/language';
import { useState } from 'react';
import { validateNickname } from '@/lib/nickname';
import type { RecoveryReceipt } from '@/components/recovery';
import { GraduationCap, Users, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gradeLabel, classLabel, type FestivalSettings } from '@/lib/types';
export function Enrollment({
  settings,
  onRegistered,
}: {
  settings: FestivalSettings;
  onRegistered: (receipt?: RecoveryReceipt) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const [kind, setKind] = useState<'student' | 'guest' | null>(null);
  const [grade, setGrade] = useState(settings.grades[0]);
  const [className, setClassName] = useState(settings.classes[0]);
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nickname, setNickname] = useState('');
  const [consent, setConsent] = useState(false);
  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      validateNickname(nickname);
      const r = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          nickname,
          grade,
          className,
          number: Number(number),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const d = (await r.json()) as RecoveryReceipt & { error?: string };
      if (!r.ok) throw new Error(d.error);
      await onRegistered(d.recoveryCode ? d : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : '登録できませんでした。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="enrollment">
      <p className="eyebrow">WELCOME TO THE FESTIVAL</p>
      <h1>
        {t('文化祭をめぐる、')}
        <br />
        {t('準備をしよう。')}
      </h1>
      <p className="enroll-lead">{t('はじめに、参加区分を選んでください。')}</p>
      <div className="kind-grid">
        <button
          className={kind === 'student' ? 'selected' : ''}
          onClick={() => {
            setKind('student');
            setConsent(false);
          }}
          aria-pressed={kind === 'student'}
        >
          <GraduationCap size={32} />
          <strong>{t('生徒')}</strong>
          <small>{t('学年・組・出席番号で登録')}</small>
        </button>
        <button
          className={kind === 'guest' ? 'selected' : ''}
          onClick={() => {
            setKind('guest');
            setConsent(false);
          }}
          aria-pressed={kind === 'guest'}
        >
          <Users size={32} />
          <strong>{t('一般客')}</strong>
          <small>{t('参加IDを自動発行')}</small>
        </button>
      </div>
      {kind && (
        <form onSubmit={submit} className="enroll-form">
          {kind === 'student' ? (
            <>
              <h2>{t('生徒情報を確認')}</h2>
              <div className="field-pair">
                <label>
                  {t('学年')}
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    required
                  >
                    {settings.grades.map((g) => (
                      <option key={g} value={g}>
                        {gradeLabel(g, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('組')}
                  <select
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    required
                  >
                    {settings.classes.map((c) => (
                      <option key={c} value={c}>
                        {classLabel(c, locale)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                {t('出席番号')}
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={settings.maxNumber}
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder={`1〜${settings.maxNumber}`}
                  required
                />
              </label>
              <p className="form-hint">
                {t(
                  '自分の学年・組・出席番号を入力してください。氏名は不要です。',
                )}
              </p>
            </>
          ) : (
            <div className="guest-preview">
              <Users size={28} />
              <h2>{t('あなた専用の参加ID')}</h2>
              <p>
                {t(
                  '登録すると「#1」のような番号が発行されます。氏名や連絡先の入力は不要です。',
                )}
              </p>
            </div>
          )}
          <label>
            {t('ニックネーム')}
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              minLength={2}
              maxLength={20}
              autoComplete="username"
              placeholder={t('例：さくらペンギン')}
              required
            />
          </label>
          <p className="form-hint">
            {t(
              '本名は使わず、2〜20文字で入力してください。不適切な名前や管理者を装う名前は使えません。再ログイン時にこの名前を確認します。',
            )}
          </p>
          <div className="data-consent">
            <ShieldCheck size={20} />
            <p>
              {kind === 'student'
                ? t(
                    'ニックネーム・学年・組・出席番号とスタンプ履歴を、文化祭の運営・進行確認に使用します。',
                  )
                : t(
                    'ニックネーム・参加IDとスタンプ履歴を、文化祭の運営・進行確認に使用します。',
                  )}
              {t(
                '管理者が進行状況・ランキングを確認できます。登録後に表示される復旧コードを控えてください。Cookieを削除しても、ニックネームと復旧コードで再ログインできます。',
              )}
            </p>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />
            {t('入力内容とデータの取り扱いを確認しました')}
          </label>
          {error && <output className="form-error">{t(error)}</output>}
          <Button
            type="submit"
            className="primary-action"
            disabled={busy || !consent || !settings.registrationOpen}
          >
            {!settings.registrationOpen
              ? t('現在、新規受付を停止しています')
              : busy
                ? t('参加登録中…')
                : t('この内容で参加する')}
            <ArrowRight size={20} />
          </Button>
        </form>
      )}
    </section>
  );
}
