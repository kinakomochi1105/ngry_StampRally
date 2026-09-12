'use client';
import { Image as ImageIcon, Link2, Plus, SquareDashed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/language';
import type { VenueMap } from '@/lib/types';
import type { MapDraft } from '@/components/admin/map-dialog';

/**
 * The venue maps: the pictures participants see on the map screen, each with
 * the areas that link a room to the group standing in it.
 */
export function MapsPanel({
  maps,
  spotCount,
  busy,
  onEdit,
  onDelete,
}: {
  maps: VenueMap[];
  spotCount: number;
  busy: boolean;
  onEdit: (draft: MapDraft) => void;
  onDelete: (map: VenueMap) => void;
}) {
  const { t } = useI18n();
  const blank: MapDraft = {
    name: '',
    areas: [],
    sortOrder: maps.length,
    active: 1,
  };
  return (
    <section className="admin-panel">
      <div className="panel-title">
        <div>
          <h2>{t('会場マップ')}</h2>
          <p>
            {t(
              '学校の見取り図をそのまま貼り付けて、教室ごとに団体へのリンクを埋め込めます。公開したマップは参加者のマップ画面に出ます。',
            )}
          </p>
        </div>
        <Button disabled={busy} onClick={() => onEdit(blank)}>
          <Plus size={18} />
          {t('マップを追加')}
        </Button>
      </div>

      {spotCount === 0 && (
        <output className="notice">
          <span>
            {t(
              '先に設置場所を登録すると、枠のリンク先として選べるようになります。',
            )}
          </span>
        </output>
      )}

      {maps.length === 0 ? (
        <div className="empty-state">
          <p>
            {t(
              'マップがありません。見取り図の画像（PNG・JPEG）を用意して追加してください。未登録の間は、登録内容から作る簡易マップが表示されます。',
            )}
          </p>
        </div>
      ) : (
        <div className="admin-maps">
          {maps.map((map) => {
            const linked = map.areas.filter((area) => area.spotId).length;
            return (
              <article key={map.id}>
                <div className="admin-map-preview">
                  {/* This app's own admin route, not a remote asset. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/admin/maps/${map.id}?v=${map.updatedAt}`}
                    alt=""
                    loading="lazy"
                  />
                </div>
                <div className="admin-map-body">
                  <span className={map.active ? 'type-tag' : 'type-tag guest'}>
                    {t(map.active ? '公開中' : '非公開')}
                  </span>
                  <h3>{map.name}</h3>
                  <p>
                    <SquareDashed size={15} aria-hidden="true" />
                    {t('枠')}
                    {map.areas.length}
                    <Link2 size={15} aria-hidden="true" />
                    {t('リンク')}
                    {linked}
                    <ImageIcon size={15} aria-hidden="true" />
                    {map.width}×{map.height}
                  </p>
                  <div>
                    <Button
                      variant="outline"
                      onClick={() => onEdit({ ...map, areas: [...map.areas] })}
                    >
                      {t('編集')}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => onDelete(map)}
                    >
                      {t('削除する')}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
