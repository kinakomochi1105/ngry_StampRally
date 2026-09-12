'use client';
import { Check, Gift, Map, QrCode, ScanLine, Stamp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/language';

export type RallyTab = 'book' | 'places' | 'map' | 'rewards';

/* Two tabs, the scan action, then two more. `short` is what the phone bar
   shows: four labels and a filled scan cell leave about 60px a column, which
   "フロアマップ" overruns and "マップ" does not. The rail has the room for the
   full name. */
const items = [
  { id: 'book', Icon: Stamp, label: 'スタンプ帳' },
  { id: 'places', Icon: ScanLine, label: '設置場所' },
  { id: 'map', Icon: Map, label: 'フロアマップ', short: 'マップ' },
  { id: 'rewards', Icon: Gift, label: '特典' },
] as const;

type Props = {
  tab: RallyTab;
  complete: boolean;
  scanDisabled: boolean;
  onSelect: (tab: RallyTab) => void;
  onScan: () => void;
};

/**
 * Phone navigation. The scan action lives inside the bar rather than above it,
 * which keeps the whole dock to one row and leaves the screen to the stamp
 * book — the thing a participant actually came to look at.
 */
export function RallyBottomNav({
  tab,
  complete,
  scanDisabled,
  onSelect,
  onScan,
}: Props) {
  const { t } = useI18n();
  return (
    <nav className="rally-bottom-nav" aria-label={t('画面切り替え')}>
      {items.slice(0, 2).map((item) => (
        <NavButton key={item.id} {...item} tab={tab} onSelect={onSelect} />
      ))}
      <button
        className="scan-tab"
        type="button"
        disabled={scanDisabled}
        onClick={onScan}
      >
        <span>
          <QrCode size={22} aria-hidden="true" />
        </span>
        <strong>{t('読み取る')}</strong>
      </button>
      {items.slice(2).map((item) => (
        <NavButton
          key={item.id}
          {...item}
          tab={tab}
          onSelect={onSelect}
          badge={item.id === 'rewards' && complete}
        />
      ))}
    </nav>
  );
}

function NavButton({
  id,
  Icon,
  label,
  short,
  tab,
  onSelect,
  badge,
}: {
  id: RallyTab;
  Icon: typeof Stamp;
  label: string;
  short?: string;
  tab: RallyTab;
  onSelect: (tab: RallyTab) => void;
  badge?: boolean;
}) {
  const { t } = useI18n();
  const active = tab === id;
  return (
    <button
      type="button"
      className={active ? 'active' : ''}
      aria-current={active ? 'page' : undefined}
      aria-controls="rally-panel"
      onClick={() => onSelect(id)}
    >
      <span>
        <Icon size={21} aria-hidden="true" />
        {badge && (
          <i>
            <Check size={10} aria-hidden="true" />
          </i>
        )}
      </span>
      <strong>{t(short ?? label)}</strong>
    </button>
  );
}

/** The same navigation on a desktop, as a rail that stays beside the content. */
export function RallyRail({
  tab,
  complete,
  scanDisabled,
  onSelect,
  onScan,
}: Props) {
  const { t } = useI18n();
  return (
    <aside className="app-rail" aria-label={t('画面切り替え')}>
      <div className="rail-heading">
        <strong>{t('ラリー メニュー')}</strong>
        <small>{t('すぐに切り替え')}</small>
      </div>
      <Button className="rail-scan" disabled={scanDisabled} onClick={onScan}>
        <QrCode size={19} />
        {t('QRコードを読み取る')}
      </Button>
      <nav className="rail-nav">
        {items.map(({ id, Icon, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              className={active ? 'active' : ''}
              aria-current={active ? 'page' : undefined}
              aria-controls="rally-panel"
              onClick={() => onSelect(id)}
            >
              <Icon size={20} aria-hidden="true" />
              {t(label)}
              {id === 'rewards' && complete && (
                <Check className="rail-tick" size={16} />
              )}
            </button>
          );
        })}
      </nav>
      <p className="rail-hint">{t('立ち止まってから、読み取りましょう。')}</p>
    </aside>
  );
}
