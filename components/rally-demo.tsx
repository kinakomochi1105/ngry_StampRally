'use client';
import { useState } from 'react';
import { ArrowRight, Check, MapPin, QrCode, Stamp, Trophy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/language';

/** Three steps, each with a miniature of the screen it describes. */
const steps = [
  {
    title: '設置場所へ行こう',
    description:
      '画面下部の「設置場所」でQRコードが置いてある場所を確認して、スポットへ向かいます。',
  },
  {
    title: 'QRコードを読んでスタンプ獲得',
    description:
      '立ち止まって「読み取る」を押し、カメラを許可します。設置されたQRコード全体をカメラに写しましょう。',
  },
  {
    title: '全部集めてコンプリート',
    description:
      '「スタンプ帳」で獲得状況を確認できます。「特典」には残り個数が表示されます。',
  },
];

const sampleRooms = ['エントランス', '美術室', '体育館'];

export function RallyDemo({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const last = step === steps.length - 1;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="recovery-dialog tutorial-dialog"
        showCloseButton={false}
      >
        <div className="tutorial-top">
          <span>{t('はじめてのスタンプラリー')}</span>
          <Button variant="ghost" onClick={onClose}>
            {t('スキップ')}
          </Button>
        </div>
        <DialogTitle>{t(steps[step].title)}</DialogTitle>
        <DialogDescription>{t(steps[step].description)}</DialogDescription>

        <div className="tutorial-screen" key={step} aria-hidden="true">
          <div className="tutorial-appbar">
            <Stamp size={17} />
            <strong>STAMP RALLY</strong>
            <span>DEMO</span>
          </div>
          {step === 0 ? (
            sampleRooms.map((name, i) => (
              <div className="tutorial-place" key={name}>
                <b>{String(i + 1).padStart(2, '0')}</b>
                <div>
                  <strong>{t(name)}</strong>
                  <small>{t('入口にQRコードを設置')}</small>
                </div>
                <MapPin size={17} />
              </div>
            ))
          ) : step === 1 ? (
            <>
              <div className="tutorial-camera">
                <QrCode size={104} strokeWidth={1.3} />
                <span className="tutorial-scan-line" />
                <span className="tutorial-scan-corner" />
              </div>
              <div className="tutorial-success">
                <Check size={19} />
                {t('スタンプを獲得しました！')}
              </div>
              <div className="tutorial-scan-button">
                <QrCode size={19} />
                {t('QRコードを読み取る')}
              </div>
            </>
          ) : (
            <>
              <div className="tutorial-complete">
                <Trophy size={33} />
                <div>
                  <strong>{t('コンプリート！')}</strong>
                  <span>3 / 3</span>
                </div>
              </div>
              <div className="tutorial-stamps">
                {[0, 1, 2].map((i) => (
                  <div key={i}>
                    <span>
                      <Stamp size={26} />
                    </span>
                    <small>
                      <Check size={12} />
                      {t('獲得済み')}
                    </small>
                  </div>
                ))}
              </div>
              <p className="tutorial-congrats">
                {t('全スポット達成、おめでとう！')}
              </p>
            </>
          )}
        </div>

        <div className="tutorial-tabs tutorial-nav-preview" aria-hidden="true">
          <strong>{t('スタンプ帳')}</strong>
          <span>{t('設置場所')}</span>
          <span>{t('特典')}</span>
        </div>
        <p className="tutorial-note">
          {t(
            '説明用の画面です。デモではカメラを起動せず、実際のスタンプも増えません。',
          )}
        </p>

        <div className="tutorial-bottom">
          <span aria-label={`${step + 1} / ${steps.length}`}>
            {steps.map((item, i) => (
              <i key={item.title} className={step === i ? 'active' : ''} />
            ))}
          </span>
          <div>
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                {t('戻る')}
              </Button>
            )}
            <Button onClick={() => (last ? onClose() : setStep(step + 1))}>
              {t(last ? 'スタンプ帳を使う' : '次へ')}
              <ArrowRight size={17} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
