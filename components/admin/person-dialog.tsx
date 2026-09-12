'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdminStamps } from '@/components/admin-stamps';
import { useI18n } from '@/components/language';
import { profileLabel } from '@/lib/types';
import { dateTime } from '@/lib/utils';
import type { Row } from '@/hooks/use-admin';

/** A destructive action is only enabled once its own name has been typed out. */
const confirmWord = { reset: 'スタンプをリセット', delete: '参加者を削除' };
type Action = 'edit' | 'reset' | 'delete';

type BodyProps = {
  person: Row;
  busy: boolean;
  error: string;
  onChange: (person: Row) => void;
  onSave: (data: unknown, message: string) => void;
  onReload: () => Promise<void>;
};

export function PersonDialog({
  person,
  onClose,
  ...rest
}: Omit<BodyProps, 'person'> & {
  person: Row | null;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  // The sheet is long. Focus starts on its heading so it opens at the top
  // instead of scrolled down to the first button.
  const heading = useRef<HTMLHeadingElement>(null);

  return (
    <Dialog
      open={person !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="admin-dialog"
        showCloseButton={false}
        initialFocus={heading}
      >
        <DialogTitle ref={heading} tabIndex={-1}>
          {person ? profileLabel(person, locale) : t('参加者管理')}
        </DialogTitle>
        <DialogDescription>
          {t('本人確認をしたうえで登録内容を管理してください。')}
        </DialogDescription>
        {person && <PersonBody key={person.id} person={person} {...rest} />}
        <DialogClose render={<Button variant="outline" />}>
          {t('閉じる')}
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Mounted per participant, so the chosen operation and its typed confirmation
 * never carry over from the previous person. A guest has no registration to
 * correct, so their operation list starts at the stamp reset.
 */
function PersonBody({
  person,
  busy,
  error,
  onChange,
  onSave,
  onReload,
}: BodyProps) {
  const { t, locale } = useI18n();
  const [action, setAction] = useState<Action>(
    person.kind === 'student' ? 'edit' : 'reset',
  );
  const [confirmation, setConfirmation] = useState('');
  return (
    <>
      {/* The editor lists every location with the time it was collected,
                so no second history list is needed. */}
      <AdminStamps id={person.id} onUpdated={onReload} />

      <div className="redeem-panel">
        <div>
          <strong>{t('報酬の交換')}</strong>
          <small>
            {person.redeemedAt
              ? t('交換済み') + ' · ' + dateTime(person.redeemedAt, locale)
              : t('まだ交換していません。')}
          </small>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            const redeemed = !person.redeemedAt;
            if (
              !redeemed &&
              !window.confirm(t('交換の記録を取り消します。よろしいですか？'))
            )
              return;
            onSave(
              { id: person.id, action: 'redeem', redeemed },
              redeemed
                ? '報酬を交換済みにしました。'
                : '交換の記録を取り消しました。',
            );
          }}
        >
          {t(person.redeemedAt ? '交換を取り消す' : '交換済みにする')}
        </Button>
      </div>

      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(
            { ...person, action, confirm: confirmation },
            '参加者情報を更新しました。',
          );
        }}
      >
        <label>
          {t('操作')}
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value as Action);
              setConfirmation('');
            }}
          >
            {person.kind === 'student' && (
              <option value="edit">{t('登録内容を修正')}</option>
            )}
            <option value="reset">{t('スタンプをリセット')}</option>
            <option value="delete">{t('参加者と履歴を削除')}</option>
          </select>
        </label>
        {action === 'edit' ? (
          <>
            <div className="field-pair">
              <label>
                {t('学年')}
                <input
                  value={person.grade ?? ''}
                  onChange={(e) =>
                    onChange({ ...person, grade: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                {t('組')}
                <input
                  value={person.className ?? ''}
                  onChange={(e) =>
                    onChange({ ...person, className: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                {t('出席番号')}
                <input
                  type="number"
                  min={1}
                  value={person.number ?? ''}
                  onChange={(e) =>
                    onChange({ ...person, number: Number(e.target.value) })
                  }
                  required
                />
              </label>
            </div>
            <p className="form-hint">
              {t('開催設定で登録されている学年・組を入力してください。')}
            </p>
          </>
        ) : (
          <label>
            {t('取り消せません。「')}
            {confirmWord[action]}
            {t('」と入力')}
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
            />
          </label>
        )}
        {error && <output className="form-error">{t(error)}</output>}
        <Button
          type="submit"
          disabled={
            busy || (action !== 'edit' && confirmation !== confirmWord[action])
          }
          variant={action === 'edit' ? 'default' : 'destructive'}
        >
          {t('実行する')}
        </Button>
      </form>
    </>
  );
}
