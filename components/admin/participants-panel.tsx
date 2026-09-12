'use client';
import { ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/language';
import { profileLabel } from '@/lib/types';
import { dateTime } from '@/lib/utils';
import {
  pageSize,
  type AdminTab,
  type Row,
  type Stats,
} from '@/hooks/use-admin';

/**
 * Progress for everyone taking part, and the same list ordered by rank. Below
 * 900px each row becomes a card; the `data-label` on every cell is what the
 * stylesheet prints as that card's row heading.
 */
export function ParticipantsPanel({
  tab,
  rows,
  count,
  stats,
  busy,
  kind,
  query,
  page,
  onKind,
  onQuery,
  onPage,
  onReload,
  onExport,
  onOpen,
}: {
  tab: AdminTab;
  rows: Row[];
  count: number;
  stats: Stats;
  busy: boolean;
  kind: string;
  query: string;
  page: number;
  onKind: (value: string) => void;
  onQuery: (value: string) => void;
  onPage: (value: number) => void;
  onReload: () => void;
  onExport: () => void;
  onOpen: (row: Row) => void;
}) {
  const { t, locale } = useI18n();
  const ranking = tab === 'ranking';
  return (
    <section className="admin-panel">
      <div className="panel-title">
        <div>
          <h2>{t(ranking ? 'スタンプランキング' : '参加者・進行状況')}</h2>
          <p>
            {t(
              ranking
                ? '獲得数の多い順。同数なら、その数に早く到達した順。'
                : '参加者を選ぶと、押印履歴の確認や登録内容の管理ができます。',
            )}
          </p>
        </div>
        <Button variant="outline" disabled={busy} onClick={onReload}>
          <RefreshCw size={16} />
          {t('更新')}
        </Button>
      </div>

      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          // Searching happens while typing; Enter must not reload the page.
          e.preventDefault();
        }}
      >
        <select
          aria-label={t('参加区分')}
          value={kind}
          onChange={(e) => onKind(e.target.value)}
        >
          <option value="">{t('すべて')}</option>
          <option value="student">{t('生徒')}</option>
          <option value="guest">{t('一般客')}</option>
        </select>
        <input
          type="search"
          aria-label={t('参加者を検索')}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t('例：1年 A組 / #12 / ニックネーム')}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onExport}
        >
          <Download size={16} />
          CSV
        </Button>
      </form>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {ranking && <th>{t('順位')}</th>}
              <th>{t('参加者')}</th>
              <th>{t('区分')}</th>
              <th>{t('進行状況')}</th>
              <th>{t('報酬交換')}</th>
              <th>{t('最終押印')}</th>
              <th>{t('管理')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {ranking && (
                  <td className="rank-value" data-label={t('順位')}>
                    {row.ranking ?? '—'}
                  </td>
                )}
                <td className="cell-person" data-label={t('参加者')}>
                  <strong>{profileLabel(row, locale)}</strong>
                  <small>{row.nickname ?? t('ニックネーム未設定')}</small>
                  <small>
                    {t('登録')}
                    {dateTime(row.createdAt, locale)}
                  </small>
                </td>
                <td data-label={t('区分')}>
                  <span
                    className={
                      row.kind === 'student' ? 'type-tag' : 'type-tag guest'
                    }
                  >
                    {t(row.kind === 'student' ? '生徒' : '一般客')}
                  </span>
                </td>
                <td data-label={t('進行状況')}>
                  <span className="row-progress">
                    <span
                      style={{
                        width:
                          (stats.spotCount
                            ? (row.stampCount / stats.spotCount) * 100
                            : 0) + '%',
                      }}
                    />
                  </span>
                  <small>
                    {row.stampCount} / {stats.spotCount}{' '}
                    {stats.spotCount > 0 && row.stampCount === stats.spotCount
                      ? t('コンプリート')
                      : ''}
                  </small>
                </td>
                <td data-label={t('報酬交換')}>
                  {row.redeemedAt ? (
                    <>
                      <span className="redeem-tag done">{t('交換済み')}</span>
                      <small>{dateTime(row.redeemedAt, locale)}</small>
                    </>
                  ) : (
                    <span className="redeem-tag">{t('未交換')}</span>
                  )}
                </td>
                <td data-label={t('最終押印')}>
                  {dateTime(row.lastStamp, locale)}
                </td>
                <td className="cell-manage">
                  <Button variant="outline" onClick={() => onOpen(row)}>
                    {t('管理')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="empty-state">
            {t(busy ? '読み込み中…' : '該当する参加者はいません。')}
          </p>
        )}
      </div>

      <div className="pagination">
        <span>
          {count}
          {t('人中')}
          {count ? (page - 1) * pageSize + 1 : 0}〜
          {Math.min(page * pageSize, count)}
          {t('人')}
        </span>
        <div>
          <Button
            variant="outline"
            disabled={page === 1 || busy}
            onClick={() => onPage(page - 1)}
            aria-label={t('前のページ')}
          >
            <ChevronLeft size={18} />
          </Button>
          <span>{page}</span>
          <Button
            variant="outline"
            disabled={page * pageSize >= count || busy}
            onClick={() => onPage(page + 1)}
            aria-label={t('次のページ')}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>
    </section>
  );
}
