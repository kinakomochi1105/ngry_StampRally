'use client';
import { useCallback, useRef, useState } from 'react';
import {
  Camera,
  CircleAlert,
  CircleCheck,
  Clock3,
  ScanBarcode,
  TriangleAlert,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Scanner } from '@/components/scanner';
import { useI18n } from '@/components/language';
import { errorMessage } from '@/lib/client';
import { profileLabel, type Profile } from '@/lib/types';
import { dateTime } from '@/lib/utils';
import { api } from '@/hooks/use-admin';

type Person = Omit<Profile, 'hasRecovery'>;

type Outcome =
  | { status: 'redeemed' | 'already'; person: Person }
  | { status: 'incomplete'; person: Person; collected: number; total: number }
  | { status: 'invalid' | 'expired' };

type Entry = Outcome & { key: number; at: number; undone?: boolean };

/** What the desk reads out for each outcome, and how loudly. */
const verdicts = {
  redeemed: {
    tone: 'ok',
    Icon: CircleCheck,
    title: '引き換えOK',
    hint: '景品をお渡しください。',
  },
  already: {
    tone: 'warn',
    Icon: Clock3,
    title: '交換済みです',
    hint: 'この参加者はすでに景品を受け取っています。',
  },
  incomplete: {
    tone: 'warn',
    Icon: TriangleAlert,
    title: 'まだコンプリートしていません',
    hint: 'すべての設置場所を回ってから、もう一度お越しください。',
  },
  expired: {
    tone: 'error',
    Icon: Clock3,
    title: 'コードの期限切れです',
    hint: '参加者の画面を開き直してもらい、新しいコードを読み取ってください。',
  },
  invalid: {
    tone: 'error',
    Icon: CircleAlert,
    title: '読み取れないコードです',
    hint: '参加者の「報酬を受け取る」画面のバーコードかQRコードを読み取ってください。',
  },
} as const;

/** How many earlier scans stay listed under the latest one. */
const historySize = 6;

/**
 * The reward desk. The code field keeps focus so a handheld scanner — which
 * types the code and presses Enter like a keyboard — works with nothing
 * clicked first; a phone camera and typed digits go through the same check.
 * Each read is judged and recorded in one request, and the verdict fills the
 * card below in a colour that can be read from across the table.
 */
export function RedeemPanel({ onChanged }: { onChanged?: () => void }) {
  const { t, locale } = useI18n();
  const field = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [camera, setCamera] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);

  const check = useCallback(
    async (code: string) => {
      if (!code.trim()) return;
      setBusy(true);
      setError('');
      try {
        const outcome = (await api('reward', { code })) as Outcome;
        setEntries((list) =>
          [
            { ...outcome, key: Date.now(), at: Date.now() / 1000 },
            ...list,
          ].slice(0, historySize),
        );
        setValue('');
        if (outcome.status === 'redeemed') onChanged?.();
      } catch (problem) {
        setError(errorMessage(problem, '引き換えを記録できませんでした。'));
      } finally {
        setBusy(false);
        // Ready for the next person in the queue.
        field.current?.focus();
      }
    },
    [onChanged],
  );

  async function undo(entry: Entry) {
    if (!('person' in entry)) return;
    if (!window.confirm(t('交換の記録を取り消します。よろしいですか？')))
      return;
    setBusy(true);
    setError('');
    try {
      // Through the desk's own route: a desk device may take back a scan it
      // has just made, but not open the participant list.
      await api('reward', { action: 'undo', id: entry.person.id });
      setEntries((list) =>
        list.map((item) =>
          item.key === entry.key ? { ...item, undone: true } : item,
        ),
      );
      onChanged?.();
    } catch (problem) {
      setError(errorMessage(problem, '交換の記録を取り消せませんでした。'));
    } finally {
      setBusy(false);
      field.current?.focus();
    }
  }

  const closeCamera = useCallback(() => {
    setCamera(false);
    field.current?.focus();
  }, []);

  const [latest, ...earlier] = entries;

  return (
    <section className="admin-panel redeem-desk">
      <div className="panel-title">
        <div>
          <h2>{t('景品引き換え')}</h2>
          <p>
            {t(
              '参加者の「報酬を受け取る」画面に出るバーコードかQRコードを読み取ると、その場で照合して交換を記録します。',
            )}
          </p>
        </div>
      </div>

      <form
        className="redeem-scan"
        onSubmit={(e) => {
          e.preventDefault();
          void check(value);
        }}
      >
        <label>
          {t('引き換えコード')}
          <span className="redeem-field">
            <ScanBarcode size={22} aria-hidden="true" />
            <input
              ref={field}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              // Pointed at by staff all day: the field is the page's purpose.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              inputMode="numeric"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
              maxLength={40}
              placeholder={t('スキャナで読み取るか、番号を入力')}
            />
          </span>
        </label>
        <div className="redeem-actions">
          <Button type="submit" disabled={busy || !value.trim()}>
            {t(busy ? '照合しています…' : '照合して記録')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setCamera(true)}
          >
            <Camera size={18} />
            {t('カメラで読み取る')}
          </Button>
        </div>
        <p className="form-hint">
          {t(
            'ハンディスキャナは、この欄が選ばれた状態で読み取ってください。全角の数字や空白が入っても照合できます。',
          )}
        </p>
      </form>

      {error && <output className="form-error">{t(error)}</output>}

      <output className="redeem-live" aria-live="assertive" aria-atomic="true">
        {latest ? (
          <Verdict
            entry={latest}
            busy={busy}
            onUndo={() => void undo(latest)}
          />
        ) : (
          <p className="redeem-idle">
            {t('読み取り待ち。結果はここに大きく表示されます。')}
          </p>
        )}
      </output>

      {earlier.length > 0 && (
        <div className="redeem-history">
          <h3>{t('直前の読み取り')}</h3>
          <ol>
            {earlier.map((entry) => (
              <li key={entry.key} className={verdicts[entry.status].tone}>
                <span>{t(verdicts[entry.status].title)}</span>
                <strong>
                  {'person' in entry ? profileLabel(entry.person, locale) : '—'}
                </strong>
                <small>
                  {entry.undone
                    ? t('取り消し済み')
                    : dateTime(Math.floor(entry.at), locale)}
                </small>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Both callbacks stay stable: the scanner restarts its camera whenever
          either one changes. */}
      <Scanner open={camera} onClose={closeCamera} onScan={check} />
    </section>
  );
}

function Verdict({
  entry,
  busy,
  onUndo,
}: {
  entry: Entry;
  busy: boolean;
  onUndo: () => void;
}) {
  const { t, locale } = useI18n();
  const verdict = verdicts[entry.status];
  const { Icon } = verdict;
  return (
    <div className={`redeem-verdict ${entry.undone ? 'error' : verdict.tone}`}>
      <Icon size={40} aria-hidden="true" />
      <div>
        <strong>
          {t(entry.undone ? '交換を取り消しました' : verdict.title)}
        </strong>
        {'person' in entry && (
          <p className="redeem-person">
            {profileLabel(entry.person, locale)}
            {entry.person.nickname && <span>{entry.person.nickname}</span>}
          </p>
        )}
        <p>
          {entry.status === 'incomplete'
            ? `${t(verdict.hint)} (${entry.collected} / ${entry.total})`
            : entry.status === 'already' && entry.person.redeemedAt
              ? `${t(verdict.hint)} ${t('交換日時')}: ${dateTime(entry.person.redeemedAt, locale)}`
              : !entry.undone && t(verdict.hint)}
        </p>
      </div>
      {entry.status === 'redeemed' && !entry.undone && (
        <Button variant="outline" disabled={busy} onClick={onUndo}>
          <Undo2 size={17} />
          {t('取り消す')}
        </Button>
      )}
    </div>
  );
}
