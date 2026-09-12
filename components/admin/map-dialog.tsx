'use client';
import { useRef, useState } from 'react';
import { ImagePlus, MousePointerSquareDashed, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/components/language';
import {
  mapImageSize,
  maxMapAreas,
  maxMapImageLength,
  type MapArea,
  type Spot,
  type VenueMap,
} from '@/lib/types';

/** A map being edited: the stored one, plus a picture if a new one was chosen. */
export type MapDraft = Partial<VenueMap> & {
  areas: MapArea[];
  /** A newly chosen picture as a data URL; absent means "keep the stored one". */
  image?: string;
};

/**
 * Turns a chosen PNG/JPEG into what the venue map stores: the picture scaled
 * so its longest edge is `mapImageSize`, as PNG when that stays small enough
 * (a plan drawn in flat colours does) and JPEG otherwise.
 */
export async function mapFromFile(file: File) {
  if (!/^image\/(png|jpeg)$/.test(file.type))
    throw new Error('PNGまたはJPEGの画像を選んでください。');
  if (file.size > 24 * 1024 * 1024)
    throw new Error('画像が大きすぎます。24MBまでの画像を選んでください。');
  const source = await createImageBitmap(file);
  const scale = Math.min(
    1,
    mapImageSize / Math.max(source.width, source.height),
  );
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('この端末では画像を変換できませんでした。');
  context.drawImage(source, 0, 0, width, height);
  source.close();
  const png = canvas.toDataURL('image/png');
  let image = png.length <= maxMapImageLength ? png : '';
  // A photographed or shaded plan is far smaller as JPEG; quality comes down
  // in steps until it fits, rather than refusing a picture outright.
  for (const quality of [0.9, 0.82, 0.72, 0.6]) {
    if (image) break;
    const jpeg = canvas.toDataURL('image/jpeg', quality);
    if (jpeg.length <= maxMapImageLength) image = jpeg;
  }
  if (!image)
    throw new Error(
      '画像を保存できませんでした。写真ではなく、書き出した地図の画像でお試しください。',
    );
  return { image, width, height };
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
/** Below this a drag is a mis-tap rather than an area. */
const minimumSide = 0.012;

/**
 * The map editor.
 *
 * The organiser uploads the plan the school already has and drags a rectangle
 * over each room. Every rectangle is then pointed at one of the locations, so
 * a visitor tapping that room on their phone lands on that group. Rectangles
 * are held as fractions of the picture, which is why the same drawing works on
 * a projector and on a phone.
 */
export function MapDialog({
  draft,
  spots,
  busy,
  error,
  onChange,
  onClose,
  onSave,
  onProblem,
}: {
  draft: MapDraft | null;
  spots: Spot[];
  busy: boolean;
  error: string;
  onChange: (draft: MapDraft) => void;
  onClose: () => void;
  onSave: (draft: MapDraft) => void;
  onProblem: (message: string) => void;
}) {
  const { t } = useI18n();
  const stage = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<MapArea | null>(null);
  const [selected, setSelected] = useState('');

  if (!draft) return null;
  const areas = draft.areas;
  const source =
    draft.image ??
    (draft.id ? `/api/admin/maps/${draft.id}?v=${draft.updatedAt ?? 0}` : '');
  const ratio =
    draft.width && draft.height ? draft.width / draft.height : 4 / 3;
  const spotName = (id: string) => spots.find((spot) => spot.id === id)?.name;

  /** Where a pointer is, as a fraction of the picture. */
  const pointAt = (event: React.PointerEvent) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return null;
    return {
      x: clamp((event.clientX - box.left) / box.width),
      y: clamp((event.clientY - box.top) / box.height),
    };
  };

  const startDraw = (event: React.PointerEvent) => {
    if (!source || areas.length >= maxMapAreas) return;
    const from = pointAt(event);
    if (!from) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrawing({
      id: 'area-' + crypto.randomUUID(),
      spotId: '',
      label: '',
      x: from.x,
      y: from.y,
      w: 0,
      h: 0,
    });
  };

  const moveDraw = (event: React.PointerEvent) => {
    if (!drawing) return;
    const to = pointAt(event);
    if (!to) return;
    // The drag can go in any direction, so the rectangle is rebuilt from the
    // two corners rather than assuming the first one is the top left.
    setDrawing((current) =>
      current
        ? {
            ...current,
            w: Math.abs(to.x - current.x),
            h: Math.abs(to.y - current.y),
            // Keep the origin corner in x/y, and remember the far corner by
            // moving the origin when the drag went up or left.
            x: Math.min(current.x, to.x) === current.x ? current.x : to.x,
            y: Math.min(current.y, to.y) === current.y ? current.y : to.y,
          }
        : current,
    );
  };

  const endDraw = () => {
    if (!drawing) return;
    const area = drawing;
    setDrawing(null);
    if (area.w < minimumSide || area.h < minimumSide) return;
    // A new area starts pointed at the first location that has no area yet,
    // which is usually the one being drawn.
    const free = spots.find(
      (spot) => !areas.some((one) => one.spotId === spot.id),
    );
    const added = { ...area, spotId: free?.id ?? '' };
    onChange({ ...draft, areas: [...areas, added] });
    setSelected(added.id);
  };

  const editArea = (id: string, change: Partial<MapArea>) =>
    onChange({
      ...draft,
      areas: areas.map((one) => (one.id === id ? { ...one, ...change } : one)),
    });

  const shown = drawing ? [...areas, drawing] : areas;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="admin-dialog map-dialog"
        showCloseButton={false}
      >
        <DialogTitle>
          {t(draft.id ? '会場マップを編集' : '会場マップを追加')}
        </DialogTitle>
        <DialogDescription>
          {t(
            '学校の見取り図や配置図をそのまま使えます。画像の上をドラッグして枠を描き、枠ごとに団体（設置場所）を選んでください。',
          )}
        </DialogDescription>

        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
          }}
        >
          <div className="dialog-column">
            <label>
              {t('マップの名前')}
              <input
                value={draft.name ?? ''}
                maxLength={40}
                placeholder={t('例：校舎 / 屋外')}
                onChange={(e) => onChange({ ...draft, name: e.target.value })}
                required
              />
            </label>
            <label>
              {t('表示順')}
              <input
                type="number"
                min={0}
                max={999}
                value={draft.sortOrder ?? 0}
                onChange={(e) =>
                  onChange({ ...draft, sortOrder: Number(e.target.value) })
                }
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={draft.active !== 0}
                onChange={(e) =>
                  onChange({ ...draft, active: e.target.checked ? 1 : 0 })
                }
              />
              {t('参加者に公開する')}
            </label>
            <div className="icon-upload">
              <label className="file-label">
                <span>
                  <ImagePlus size={16} aria-hidden="true" />
                  {t(source ? '画像を差し替える' : '地図の画像を選ぶ')}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    void mapFromFile(file)
                      .then((picture) => onChange({ ...draft, ...picture }))
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
            </div>
            <small>
              {t(
                '画像は長辺2000pxまで縮小して保存します。枠は画像の割合で覚えるので、差し替えても同じ位置に残ります。',
              )}
            </small>
          </div>

          <div className="dialog-column">
            {/* The picture with the areas on it. Dragging anywhere on it
                draws a new one. */}
            <div
              className="map-editor-stage"
              ref={stage}
              style={{ aspectRatio: `${ratio}` }}
              onPointerDown={startDraw}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerCancel={() => setDrawing(null)}
            >
              {source ? (
                // The picture is either a local data URL or this app's own
                // admin route, so the plain tag is what is wanted here.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={source} alt="" draggable={false} />
              ) : (
                <p className="map-editor-empty">
                  <MousePointerSquareDashed size={22} aria-hidden="true" />
                  {t('先に地図の画像を選んでください。')}
                </p>
              )}
              {shown.map((area) => (
                <span
                  key={area.id}
                  className={`map-editor-area${area.id === selected ? ' selected' : ''}${area.spotId ? '' : ' unlinked'}`}
                  style={{
                    left: `${area.x * 100}%`,
                    top: `${area.y * 100}%`,
                    width: `${area.w * 100}%`,
                    height: `${area.h * 100}%`,
                  }}
                >
                  <em>{spotName(area.spotId) ?? area.label}</em>
                </span>
              ))}
            </div>

            <div className="map-area-list">
              <p className="map-area-head">
                <strong>{t('枠とリンク先')}</strong>
                <small>
                  {areas.length}
                  {t('件')}
                </small>
              </p>
              {areas.length === 0 ? (
                <p className="map-area-empty">
                  {t('画像の上をドラッグすると、枠を追加できます。')}
                </p>
              ) : (
                <ul>
                  {areas.map((area) => (
                    <li
                      key={area.id}
                      className={area.id === selected ? 'selected' : undefined}
                    >
                      <label>
                        <span className="sr-only">
                          {t('リンク先の団体')}
                        </span>
                        <select
                          value={area.spotId}
                          onFocus={() => setSelected(area.id)}
                          onChange={(e) =>
                            editArea(area.id, { spotId: e.target.value })
                          }
                        >
                          <option value="">
                            {t('リンクなし（表示名のみ）')}
                          </option>
                          {spots.map((spot) => (
                            <option key={spot.id} value={spot.id}>
                              {spot.name}
                              {spot.active ? '' : t('（非公開）')}
                            </option>
                          ))}
                        </select>
                      </label>
                      {!area.spotId && (
                        <label>
                          <span className="sr-only">
                            {t('枠の表示名')}
                          </span>
                          <input
                            value={area.label}
                            maxLength={40}
                            placeholder={t('例：受付')}
                            onFocus={() => setSelected(area.id)}
                            onChange={(e) =>
                              editArea(area.id, { label: e.target.value })
                            }
                          />
                        </label>
                      )}
                      <button
                        type="button"
                        aria-label={t('この枠を削除')}
                        onClick={() =>
                          onChange({
                            ...draft,
                            areas: areas.filter((one) => one.id !== area.id),
                          })
                        }
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {error && <output className="form-error">{t(error)}</output>}
          <Button type="submit" disabled={busy || !source}>
            {t('保存')}
          </Button>
        </form>

        <DialogClose render={<Button variant="outline" />}>
          {t('閉じる')}
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
