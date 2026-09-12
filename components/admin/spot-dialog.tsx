'use client';
import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { SpotIcon, spotIconTemplates } from '@/components/spot-icon';
import { useI18n } from '@/components/language';
import { isCustomSpotIcon, maxSpotIconLength, type Spot } from '@/lib/types';

/**
 * Turns a chosen PNG/JPEG into the small square data URL that is stored with
 * the location: centre-cropped, 128px, and JPEG unless the source is a PNG,
 * which may carry transparency.
 */
export async function iconFromFile(file: File) {
  if (!/^image\/(png|jpeg)$/.test(file.type))
    throw new Error('PNGまたはJPEGの画像を選んでください。');
  if (file.size > 12 * 1024 * 1024)
    throw new Error('画像が大きすぎます。12MBまでの画像を選んでください。');
  const source = await createImageBitmap(file);
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('この端末では画像を変換できませんでした。');
  const side = Math.min(source.width, source.height);
  context.drawImage(
    source,
    (source.width - side) / 2,
    (source.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  source.close();
  const png = canvas.toDataURL('image/png');
  const icon =
    file.type === 'image/png' && png.length <= maxSpotIconLength
      ? png
      : canvas.toDataURL('image/jpeg', 0.82);
  if (icon.length > maxSpotIconLength)
    throw new Error('画像を保存できませんでした。別の画像でお試しください。');
  return icon;
}

export function SpotDialog({
  spot,
  busy,
  error,
  onChange,
  onClose,
  onSave,
  onProblem,
}: {
  spot: Partial<Spot> | null;
  busy: boolean;
  error: string;
  onChange: (spot: Partial<Spot>) => void;
  onClose: () => void;
  onSave: (spot: Partial<Spot>) => void;
  onProblem: (message: string) => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={spot !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="admin-dialog spot-dialog"
        showCloseButton={false}
      >
        <DialogTitle>
          {t(spot?.id ? '設置場所を編集' : '設置場所を追加')}
        </DialogTitle>
        <DialogDescription>
          {t(
            'QRコードは場所ごとに発行されます。非公開にすると押印対象から外れます。',
          )}
        </DialogDescription>
        {spot && (
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              onSave(spot);
            }}
          >
            {/* On a desktop the written details take the left half and the
                icon picker the right one. `.dialog-column` is `display:
                contents` on a phone, so there the fields stay in one stream. */}
            <div className="dialog-column">
              <label>
                {t('名称')}
                <input
                  value={spot.name}
                  maxLength={60}
                  onChange={(e) => onChange({ ...spot, name: e.target.value })}
                  required
                />
              </label>
              <label>
                {t('場所・階・教室')}
                <input
                  value={spot.location}
                  maxLength={80}
                  onChange={(e) =>
                    onChange({ ...spot, location: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                {t('設置位置の案内')}
                <textarea
                  value={spot.description}
                  maxLength={160}
                  onChange={(e) =>
                    onChange({ ...spot, description: e.target.value })
                  }
                />
              </label>
              <label>
                {t('表示順')}
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={spot.sortOrder}
                  onChange={(e) =>
                    onChange({ ...spot, sortOrder: Number(e.target.value) })
                  }
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={spot.active === 1}
                  onChange={(e) =>
                    onChange({ ...spot, active: e.target.checked ? 1 : 0 })
                  }
                />
                {t('公開して押印対象にする')}
              </label>
            </div>

            {/* The icon appears on the participant's stamp card: either one of
                the templates or a picture the organiser supplies. */}
            <div className="icon-field">
              <p className="icon-field-head">
                <span className="icon-field-preview">
                  <SpotIcon
                    icon={spot.icon}
                    index={spot.sortOrder ?? 0}
                    size={26}
                  />
                </span>
                <strong>{t('スタンプのアイコン')}</strong>
              </p>
              <div className="icon-choices">
                <button
                  type="button"
                  className={spot.icon ? undefined : 'selected'}
                  aria-pressed={!spot.icon}
                  onClick={() => onChange({ ...spot, icon: '' })}
                >
                  {t('自動')}
                </button>
                {spotIconTemplates.map((choice) => (
                  <button
                    key={choice.key}
                    type="button"
                    title={t(choice.label)}
                    aria-label={t(choice.label)}
                    aria-pressed={spot.icon === choice.key}
                    className={
                      spot.icon === choice.key ? 'selected' : undefined
                    }
                    onClick={() => onChange({ ...spot, icon: choice.key })}
                  >
                    <choice.Icon size={20} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <div className="icon-upload">
                <label className="file-label">
                  <span>
                    <ImagePlus size={16} aria-hidden="true" />
                    {t('画像を選ぶ（PNG・JPEG）')}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      void iconFromFile(file)
                        .then((icon) => onChange({ ...spot, icon }))
                        .catch((problem: unknown) =>
                          onProblem(
                            problem instanceof Error
                              ? problem.message
                              : '画像を読み込めませんでした。',
                          ),
                        );
                    }}
                  />
                </label>
                {isCustomSpotIcon(spot.icon ?? '') && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onChange({ ...spot, icon: '' })}
                  >
                    {t('画像を外す')}
                  </Button>
                )}
              </div>
              <small>
                {t(
                  '画像は正方形に切り抜いて128pxに縮小して保存します。遠くからでも分かる、輪郭のはっきりした絵がおすすめです。',
                )}
              </small>
            </div>

            {error && <output className="form-error">{t(error)}</output>}
            <Button type="submit" disabled={busy}>
              {t('保存')}
            </Button>
          </form>
        )}
        <DialogClose render={<Button variant="outline" />}>
          {t('閉じる')}
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
