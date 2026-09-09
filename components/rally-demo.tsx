'use client';
import { useState } from 'react';
import { QrCode, MapPin, Stamp, Check, Trophy, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/language';
export function RallyDemo({ onClose }: { onClose: () => void }) {
  const { locale } = useI18n();
  const en = locale === 'en';
  const [step, setStep] = useState(0);
  const titles = en
    ? ['Find a location', 'Scan and collect', 'Complete your stamp book']
    : ['設置場所へ行こう', 'QRを読んでスタンプ獲得', '全部集めてコンプリート'];
  const descriptions = en
    ? [
        'Open Locations to see where each QR code is displayed. Walk to a location first.',
        'Stop walking, tap Scan QR code and allow camera access. Point at the entire displayed QR code.',
        'Your collected stamps appear in your stamp book. Visit every active location to complete the rally.',
      ]
    : [
        '「設置場所」でQRが置いてある場所を確認して、スポットへ向かいます。',
        '立ち止まって「QRを読み取る」を押し、カメラを許可します。設置されたQR全体をカメラに写しましょう。',
        '獲得したスタンプは「スタンプ帳」に反映されます。公開中のスポットを全部巡るとコンプリートです。',
      ];
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
          <span>{en ? 'HOW TO PLAY' : 'はじめてのスタンプラリー'}</span>
          <Button variant="ghost" onClick={onClose}>
            {en ? 'Skip' : 'スキップ'}
          </Button>
        </div>
        <DialogTitle>{titles[step]}</DialogTitle>
        <DialogDescription>{descriptions[step]}</DialogDescription>
        <div className="tutorial-screen" key={step} aria-hidden="true">
          <div className="tutorial-appbar">
            <Stamp size={17} />
            <strong>STAMP RALLY</strong>
            <span>DEMO</span>
          </div>
          {step === 0 ? (
            <>
              <div className="tutorial-tabs">
                <span>{en ? 'Stamp book' : 'スタンプ帳'}</span>
                <strong>
                  <MapPin size={14} />
                  {en ? 'Locations' : '設置場所'}
                </strong>
              </div>
              {[
                en ? 'Entrance' : 'エントランス',
                en ? 'Art room' : '美術室',
                en ? 'Gymnasium' : '体育館',
              ].map((name, i) => (
                <div className="tutorial-place" key={name}>
                  <b>{String(i + 1).padStart(2, '0')}</b>
                  <div>
                    <strong>{name}</strong>
                    <small>
                      {en ? 'QR by the entrance' : '入口にQRを設置'}
                    </small>
                  </div>
                  <MapPin size={17} />
                </div>
              ))}
            </>
          ) : step === 1 ? (
            <>
              <div className="tutorial-camera">
                <QrCode size={104} strokeWidth={1.3} />
                <span className="tutorial-scan-line" />
                <span className="tutorial-scan-corner" />
              </div>
              <div className="tutorial-success">
                <Check size={19} />
                {en ? 'Stamp collected!' : 'スタンプを獲得しました！'}
              </div>
              <div className="tutorial-scan-button">
                <QrCode size={19} />
                {en ? 'Scan QR code' : 'QRを読み取る'}
              </div>
            </>
          ) : (
            <>
              <div className="tutorial-complete">
                <Trophy size={33} />
                <div>
                  <strong>{en ? 'Complete!' : 'コンプリート！'}</strong>
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
                      {en ? 'Collected' : '獲得済み'}
                    </small>
                  </div>
                ))}
              </div>
              <p className="tutorial-congrats">
                {en
                  ? 'You visited every location!'
                  : '全スポット達成、おめでとう！'}
              </p>
            </>
          )}
        </div>
        <p className="tutorial-note">
          {en
            ? 'Illustration only. This demo does not use your camera or add real stamps.'
            : '説明用の画面です。デモではカメラを起動せず、実際のスタンプも増えません。'}
        </p>
        <div className="tutorial-bottom">
          <span
            aria-label={
              en ? 'Step ' + (step + 1) + ' of 3' : step + 1 + ' / 3 ステップ'
            }
          >
            {[0, 1, 2].map((i) => (
              <i key={i} className={step === i ? 'active' : ''} />
            ))}
          </span>
          <div>
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                {en ? 'Back' : '戻る'}
              </Button>
            )}
            <Button onClick={() => (step < 2 ? setStep(step + 1) : onClose())}>
              {step === 2
                ? en
                  ? 'Start exploring'
                  : 'スタンプ帳を使う'
                : en
                  ? 'Next'
                  : '次へ'}
              <ArrowRight size={17} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
