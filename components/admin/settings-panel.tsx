'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/language';
import { dateTime } from '@/lib/utils';
import type { FestivalSettings } from '@/lib/types';
import type { Audit } from '@/hooks/use-admin';

/** Commas, full-width commas and line breaks all separate a list. */
const asList = (value: string) =>
  value
    .split(/[,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Festival settings, the staff PIN and the data a school has to keep or clear
 * afterwards. The form is mounted with a key from the last load, so it always
 * starts from what the server holds rather than syncing field by field.
 */
export function SettingsPanel({
  settings,
  staffPinSet,
  sitePasswordSet,
  deskPasswordSet,
  warnings,
  logs,
  busy,
  onSave,
  onExport,
  onPurge,
}: {
  settings: FestivalSettings;
  staffPinSet: boolean;
  sitePasswordSet: boolean;
  deskPasswordSet: boolean;
  warnings: string[];
  logs: Audit[];
  busy: boolean;
  onSave: (path: string, data: unknown, message: string) => Promise<boolean>;
  onExport: () => void;
  onPurge: () => void;
}) {
  const { t, locale } = useI18n();
  const [config, setConfig] = useState(settings);
  const [grades, setGrades] = useState(settings.grades.join(','));
  const [classes, setClasses] = useState(settings.classes.join(','));
  const [blockedWords, setBlockedWords] = useState(
    settings.nicknameBlockedWords.join('\n'),
  );
  const [allowedWords, setAllowedWords] = useState(
    settings.nicknameAllowedWords.join('\n'),
  );
  const [staffPin, setStaffPin] = useState('');
  const [sitePassword, setSitePassword] = useState('');
  const [deskPassword, setDeskPassword] = useState('');

  return (
    <section className="admin-panel">
      <div className="panel-title">
        <div>
          <h2>{t('開催設定とデータ管理')}</h2>
          <p>
            {t(
              '学年・クラスは文字で追加できます。登録済みの生徒情報は変更されません。',
            )}
          </p>
        </div>
      </div>

      {warnings.map((warning) => (
        <output key={warning} className="form-error">
          {t(warning)}
        </output>
      ))}

      <form
        className="admin-form settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(
            'settings',
            {
              settings: {
                ...config,
                nicknameBlockedWords: asList(blockedWords),
                nicknameAllowedWords: asList(allowedWords),
                grades: asList(grades),
                classes: asList(classes),
              },
            },
            '設定を保存しました。',
          );
        }}
      >
        <label>
          {t('文化祭名')}
          <input
            value={config.title}
            maxLength={60}
            onChange={(e) => setConfig({ ...config, title: e.target.value })}
            required
          />
        </label>
        <div className="field-pair">
          <label>
            {t('学年（カンマ区切り）')}
            <input
              value={grades}
              onChange={(e) => setGrades(e.target.value)}
              placeholder={t('1,2,3,専攻科')}
              required
            />
            <small>{t('例：1,2,3,専攻科')}</small>
          </label>
          <label>
            {t('組（カンマ区切り）')}
            <input
              value={classes}
              onChange={(e) => setClasses(e.target.value)}
              placeholder="A,B,C,D,E"
              required
            />
            <small>{t('例：A,B,C,D,E,F')}</small>
          </label>
        </div>
        <label>
          {t('出席番号の上限')}
          <input
            type="number"
            min={1}
            max={999}
            value={config.maxNumber}
            onChange={(e) =>
              setConfig({ ...config, maxNumber: Number(e.target.value) })
            }
            required
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={config.registrationOpen}
            onChange={(e) =>
              setConfig({ ...config, registrationOpen: e.target.checked })
            }
          />
          {t('新規参加登録を受け付ける')}
        </label>
        <label>
          {t('ニックネームの追加禁止語（1行に1つ）')}
          <textarea
            value={blockedWords}
            onChange={(e) => setBlockedWords(e.target.value)}
            rows={4}
            placeholder={t('学校独自の禁止語を入力')}
          />
          <small>
            {t(
              '標準の禁止語に加えて判定します。100件まで。登録済みの名前を自動変更するものではありません。',
            )}
          </small>
        </label>
        <label>
          {t('ニックネームで許可する語（1行に1つ）')}
          <textarea
            value={allowedWords}
            onChange={(e) => setAllowedWords(e.target.value)}
            rows={3}
            placeholder={t('禁止語を含むだけの普通の言葉を入力')}
          />
          <small>
            {t(
              '禁止語を部分的に含むだけの名前が弾かれるときに登録します。「シネマ」「Yamashita」「badminton」などは標準で許可しています。100件まで。',
            )}
          </small>
        </label>
        <Button type="submit" disabled={busy}>
          {t('設定を保存')}
        </Button>
      </form>

      {/* The word every visitor types before the participant screens answer.
          The organiser console stays outside it, so a mistyped word can always
          be cleared from here. */}
      <form
        className="admin-form staff-pin-form"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(
            'settings',
            { action: 'sitePassword', password: sitePassword },
            'サイトの合言葉を設定しました。',
          ).then((ok) => {
            if (ok) setSitePassword('');
          });
        }}
      >
        <h3>{t('サイトの合言葉（閲覧パスワード）')}</h3>
        <p
          className={
            sitePasswordSet ? 'staff-pin-state set' : 'staff-pin-state unset'
          }
        >
          {t(
            sitePasswordSet
              ? '設定済みです。合言葉を入力しないと参加者サイトを利用できません。'
              : '未設定です。誰でも参加者サイトを利用できます。',
          )}
        </p>
        <label>
          {t('新しい合言葉（4〜64文字）')}
          <input
            value={sitePassword}
            onChange={(e) => setSitePassword(e.target.value)}
            type="text"
            autoComplete="off"
            maxLength={64}
            placeholder={t('例：ぶんかさい2026')}
          />
          <small>
            {t(
              '校内の掲示や配布物で来場者に伝えてください。変更すると、入力済みの端末でも次のアクセスから再入力が必要になります。管理センターはこの合言葉なしで開けます。',
            )}
          </small>
        </label>
        <div className="staff-pin-actions">
          <Button
            type="submit"
            disabled={busy || sitePassword.trim().length < 4}
          >
            {t('合言葉を保存')}
          </Button>
          {sitePasswordSet && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    t(
                      '合言葉を削除すると、誰でも参加者サイトを利用できるようになります。よろしいですか？',
                    ),
                  )
                )
                  return;
                void onSave(
                  'settings',
                  { action: 'sitePassword', clear: true },
                  'サイトの合言葉を削除しました。',
                );
              }}
            >
              {t('合言葉を削除')}
            </Button>
          )}
        </div>
      </form>

      <form
        className="admin-form staff-pin-form"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(
            'settings',
            { action: 'staffPin', pin: staffPin },
            '係員用暗証番号を保存しました。',
          );
          setStaffPin('');
        }}
      >
        <h3>{t('報酬受け取り用の係員暗証番号')}</h3>
        <p
          className={
            staffPinSet ? 'staff-pin-state set' : 'staff-pin-state unset'
          }
        >
          {t(
            staffPinSet
              ? '設定済みです。参加者の画面で係員が入力します。'
              : '未設定です。設定するまで参加者は報酬を受け取れません。',
          )}
        </p>
        <label>
          {t('新しい暗証番号（6〜8桁の数字）')}
          <input
            value={staffPin}
            onChange={(e) =>
              setStaffPin(e.target.value.replace(/\D/g, '').slice(0, 8))
            }
            inputMode="numeric"
            type="password"
            autoComplete="new-password"
            placeholder="••••••"
          />
          <small>
            {t(
              '係員だけに共有してください。参加者の端末で入力するため、他の場所で使っていない番号にしてください。',
            )}
          </small>
        </label>
        <div className="staff-pin-actions">
          <Button type="submit" disabled={busy || staffPin.length < 6}>
            {t('暗証番号を保存')}
          </Button>
          {staffPinSet && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    t(
                      '暗証番号を削除すると、報酬の受け取りができなくなります。よろしいですか？',
                    ),
                  )
                )
                  return;
                void onSave(
                  'settings',
                  { action: 'staffPin', clear: true },
                  '係員用暗証番号を削除しました。',
                );
              }}
            >
              {t('暗証番号を削除')}
            </Button>
          )}
        </div>
      </form>

      {/* The password a reward-desk device signs in with. It opens the desk
          and nothing else, so it can be given to volunteers at the table. */}
      <form
        className="admin-form staff-pin-form"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(
            'settings',
            { action: 'deskPassword', password: deskPassword },
            '引き換え係のパスワードを保存しました。',
          ).then((ok) => {
            if (ok) setDeskPassword('');
          });
        }}
      >
        <h3>{t('景品引き換え係のパスワード')}</h3>
        <p
          className={
            deskPasswordSet ? 'staff-pin-state set' : 'staff-pin-state unset'
          }
        >
          {t(
            deskPasswordSet
              ? '設定済みです。このパスワードでログインした端末は景品引き換えだけを使えます。'
              : '未設定です。景品引き換えには管理者パスワードでのログインが必要です。',
          )}
        </p>
        <label>
          {t('新しいパスワード（8〜64文字）')}
          <input
            value={deskPassword}
            onChange={(e) => setDeskPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            maxLength={64}
          />
          <small>
            {t(
              '引き換え窓口の係員に伝えてください。参加者一覧・設定・データ削除は操作できません。変更すると、ログイン中の引き換え端末はすべてログアウトされます。',
            )}
          </small>
        </label>
        <div className="staff-pin-actions">
          <Button
            type="submit"
            disabled={busy || deskPassword.trim().length < 8}
          >
            {t('パスワードを保存')}
          </Button>
          {deskPasswordSet && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    t(
                      'パスワードを削除すると、引き換え係の端末はログインできなくなります。よろしいですか？',
                    ),
                  )
                )
                  return;
                void onSave(
                  'settings',
                  { action: 'deskPassword', clear: true },
                  '引き換え係のパスワードを削除しました。',
                );
              }}
            >
              {t('パスワードを削除')}
            </Button>
          )}
        </div>
      </form>

      <div className="data-actions">
        <div>
          <h3>{t('参加データを保存')}</h3>
          <p>{t('生徒・一般客の進行状況と順位をCSVに出力します。')}</p>
          <Button variant="outline" onClick={onExport} disabled={busy}>
            <Download size={16} />
            {t('CSVをダウンロード')}
          </Button>
        </div>
        <div className="danger-zone">
          <h3>{t('開催後のデータ削除')}</h3>
          <p>
            {t(
              '学年・組・出席番号を含む全参加情報とスタンプを削除します。設置場所と設定は残ります。元に戻せません。',
            )}
          </p>
          <Button variant="destructive" onClick={onPurge}>
            {t('全参加データを削除…')}
          </Button>
        </div>
      </div>

      <details className="audit-details">
        <summary>{t('管理操作の履歴（最新30件）')}</summary>
        <ul>
          {logs.map((log, index) => (
            <li key={index}>
              {dateTime(log.createdAt, locale)} · {log.action}
              {t('· 対象')}
              {log.target}
              {log.actor && (
                <>
                  {t('· 操作')}
                  {log.actor}
                </>
              )}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
