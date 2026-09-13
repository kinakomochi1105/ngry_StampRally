'use client';
import { useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  BookOpen,
  Gift,
  GraduationCap,
  House,
  LogOut,
  Map as MapIcon,
  MapPin,
  ScanBarcode,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';
import { LanguageSelect, useI18n } from '@/components/language';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { AdminLogin } from '@/components/admin/admin-login';
import { ParticipantsPanel } from '@/components/admin/participants-panel';
import { PersonDialog } from '@/components/admin/person-dialog';
import { RedeemPanel } from '@/components/admin/redeem-panel';
import {
  PosterDialog,
  PurgeDialog,
  type Poster,
} from '@/components/admin/poster-dialog';
import { MapDialog, type MapDraft } from '@/components/admin/map-dialog';
import { MapsPanel } from '@/components/admin/maps-panel';
import { SettingsPanel } from '@/components/admin/settings-panel';
import { SpotDialog } from '@/components/admin/spot-dialog';
import { SpotsPanel } from '@/components/admin/spots-panel';
import {
  useAdmin,
  type AdminTab,
  type ManagedSpot,
  type Row,
} from '@/hooks/use-admin';
import type { Spot } from '@/lib/types';

const counters = [
  { Icon: Users, label: '参加者', of: 'total' },
  { Icon: GraduationCap, label: '生徒', of: 'students' },
  { Icon: Users, label: '一般客', of: 'guests' },
  { Icon: Trophy, label: 'コンプリート', of: 'completed' },
  { Icon: Gift, label: '報酬交換済み', of: 'redeemed' },
] as const;

const tabs = [
  { id: 'participants', Icon: Users, label: '参加者・進行状況' },
  { id: 'ranking', Icon: Trophy, label: 'ランキング' },
  { id: 'redeem', Icon: ScanBarcode, label: '景品引き換え' },
  { id: 'spots', Icon: MapPin, label: '設置場所・QRコード' },
  { id: 'maps', Icon: MapIcon, label: '会場マップ' },
  { id: 'settings', Icon: Settings, label: '設定・データ管理' },
] as const;

export default function Admin() {
  const { t } = useI18n();
  const admin = useAdmin();
  const [editingSpot, setEditingSpot] = useState<Partial<Spot> | null>(null);
  const [editingPerson, setEditingPerson] = useState<Row | null>(null);
  const [poster, setPoster] = useState<Poster | null>(null);
  const [editingMap, setEditingMap] = useState<MapDraft | null>(null);
  const [purge, setPurge] = useState(false);

  /** Every change closes whatever sheet started it, then refreshes the list. */
  async function save(path: string, data: unknown, message: string) {
    const ok = await admin.mutate(path, data, message);
    if (ok) {
      setEditingSpot(null);
      setEditingPerson(null);
      setEditingMap(null);
      setPurge(false);
    }
    return ok;
  }

  async function printQr(spot: ManagedSpot) {
    try {
      setPoster({
        spot,
        image: await QRCode.toDataURL(spot.code, {
          width: 640,
          margin: 4,
          errorCorrectionLevel: 'M',
        }),
      });
    } catch {
      admin.setError('QRコードを生成できませんでした。');
    }
  }

  if (admin.checking)
    return (
      <main className="admin-shell">
        <p className="loading-state">
          {t('管理者の認証状態を確認しています…')}
        </p>
      </main>
    );

  const desk = admin.role === 'desk';

  if (!admin.authorized)
    return (
      <AdminLogin
        busy={admin.busy}
        error={admin.error}
        onSubmit={admin.signIn}
      />
    );

  return (
    <div className="admin-app">
      {/* The same bar as the manual at /admin/wiki: the name, the links between
          the two screens, then the display controls and the way out. */}
      <header className="admin-topbar">
        <p className="admin-brand">
          <span className="admin-brand-mark">
            <ShieldCheck size={17} aria-hidden="true" />
          </span>
          <span>
            <strong>
              {t(desk ? '文化祭 景品引き換え' : '文化祭 管理センター')}
            </strong>
            <small>
              {admin.label ? admin.label + ' · ' : ''}
              {desk ? 'REWARD DESK' : 'FESTIVAL CONTROL'}
            </small>
          </span>
        </p>
        {/* The manual is its own screen at /admin/wiki, not a tab here. */}
        <nav className="top-links" aria-label={t('サイト内の移動')}>
          {/* The icons are for the phone layout, where the labels come off. */}
          <Link href="/admin/wiki" aria-label={t('運営マニュアル')}>
            <BookOpen size={18} aria-hidden="true" />
            <span>{t('運営マニュアル')}</span>
          </Link>
          <Link href="/" aria-label={t('参加者サイト')}>
            <House size={18} aria-hidden="true" />
            <span>{t('参加者サイト')}</span>
          </Link>
        </nav>
        <div className="admin-topbar-actions">
          <ThemeToggle />
          <LanguageSelect />
          <Button
            variant="outline"
            className="admin-topbar-button"
            aria-label={t('ログアウト')}
            onClick={() => void admin.signOut()}
          >
            <LogOut size={16} />
            <span>{t('ログアウト')}</span>
          </Button>
        </div>
      </header>

      <main className="admin-shell">
        {/* A desk device only reads reward codes: the totals and the other
            tabs come from APIs its role cannot call. */}
        {!desk && (
          <div className="admin-stats">
            {counters.map(({ Icon, label, of }) => (
              <article key={label + of}>
                <Icon size={22} aria-hidden="true" />
                <span>{t(label)}</span>
                <strong>
                  {admin.stats[of].toLocaleString()}
                  <small>{t('人')}</small>
                </strong>
              </article>
            ))}
          </div>
        )}

        {!desk && (
          <nav className="admin-tabs" aria-label={t('管理メニュー')}>
            {tabs.map(({ id, Icon, label }) => (
              <button
                key={id}
                className={admin.tab === id ? 'active' : ''}
                aria-current={admin.tab === id ? 'page' : undefined}
                onClick={() => admin.chooseTab(id as AdminTab)}
              >
                <Icon size={18} aria-hidden="true" />
                {t(label)}
              </button>
            ))}
          </nav>
        )}

        {admin.error && (
          <output className="form-error">{t(admin.error)}</output>
        )}
        {admin.notice && <output className="notice">{t(admin.notice)}</output>}

        {(admin.tab === 'participants' || admin.tab === 'ranking') && (
          <ParticipantsPanel
            tab={admin.tab}
            rows={admin.rows}
            count={admin.count}
            stats={admin.stats}
            busy={admin.busy}
            kind={admin.kind}
            query={admin.query}
            page={admin.page}
            onKind={(value) => {
              admin.setKind(value);
              admin.setPage(1);
            }}
            onQuery={admin.setQuery}
            onPage={admin.setPage}
            onReload={() => void admin.load()}
            onExport={() => void admin.exportCsv()}
            onOpen={(row) => setEditingPerson({ ...row })}
          />
        )}

        {/* Refreshing after a hand-over keeps the "redeemed" counter above
            the desk in step with what it has just recorded. */}
        {admin.tab === 'redeem' && (
          <RedeemPanel onChanged={desk ? undefined : admin.load} />
        )}

        {admin.tab === 'spots' && (
          <SpotsPanel
            spots={admin.spots}
            busy={admin.busy}
            onEdit={setEditingSpot}
            onPrint={(spot) => void printQr(spot)}
            onSeed={() =>
              void save(
                'spots',
                { action: 'seed' },
                '仮の6か所を作成しました。実際の場所へ編集してください。',
              )
            }
          />
        )}

        {admin.tab === 'maps' && (
          <MapsPanel
            maps={admin.maps}
            spotCount={admin.spots.length}
            busy={admin.busy}
            onEdit={setEditingMap}
            onDelete={(map) =>
              void save(
                'maps',
                { id: map.id, action: 'delete' },
                '会場マップを削除しました。',
              )
            }
          />
        )}

        {admin.tab === 'settings' && (
          <SettingsPanel
            key={admin.settingsVersion}
            settings={admin.settings}
            staffPinSet={admin.staffPinSet}
            sitePasswordSet={admin.sitePasswordSet}
            deskPasswordSet={admin.deskPasswordSet}
            warnings={admin.warnings}
            logs={admin.logs}
            busy={admin.busy}
            onSave={save}
            onExport={() => void admin.exportCsv()}
            onPurge={() => setPurge(true)}
          />
        )}

        <SpotDialog
          spot={editingSpot}
          busy={admin.busy}
          error={admin.error}
          onChange={setEditingSpot}
          onClose={() => setEditingSpot(null)}
          onSave={(spot) =>
            void save('spots', spot, '設置場所を保存しました。')
          }
          onProblem={admin.setError}
        />

        <PersonDialog
          person={editingPerson}
          busy={admin.busy}
          error={admin.error}
          onChange={setEditingPerson}
          onClose={() => setEditingPerson(null)}
          onSave={(data, message) => void save('participants', data, message)}
          onReload={admin.load}
        />

        <PurgeDialog
          open={purge}
          busy={admin.busy}
          onOpenChange={setPurge}
          onConfirm={(confirmation) =>
            void save(
              'settings',
              { action: 'purge', confirm: confirmation },
              '全参加データを削除しました。',
            )
          }
        />

        <PosterDialog poster={poster} onClose={() => setPoster(null)} />

        <MapDialog
          draft={editingMap}
          spots={admin.spots}
          busy={admin.busy}
          error={admin.error}
          onChange={setEditingMap}
          onClose={() => setEditingMap(null)}
          onSave={(draft) =>
            void save('maps', draft, '会場マップを保存しました。')
          }
          onProblem={admin.setError}
        />

        <footer>
          <span>
            {t(
              desk
                ? '引き換え係 · 参加者情報は取り扱いに注意してください。'
                : '管理者専用 · 参加者情報は取り扱いに注意してください。',
            )}
          </span>
          {!desk && (
            <span>
              {t('表示中の対象スポット：')}
              {admin.stats.spotCount}
              {t('か所')}
            </span>
          )}
        </footer>
      </main>
    </div>
  );
}
