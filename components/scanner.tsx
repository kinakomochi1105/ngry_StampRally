'use client';
import { useI18n } from '@/components/language';
import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { createQrDecoder, type QrDecoder } from '@/lib/qr-decoder';
/** Camera frames are scaled to this before decoding; photos to twice it. */
const frameEdge = 800;
const photoEdge = 1600;
export function Scanner({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const handled = useRef(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  // One decoder (and so at most one worker) for the life of the scanner,
  // started the first time it is needed.
  const decoder = useRef<Promise<QrDecoder> | null>(null);
  const qrDecoder = () => (decoder.current ??= createQrDecoder());
  useEffect(
    () => () => {
      void decoder.current?.then((ready) => ready.close());
      decoder.current = null;
    },
    [],
  );
  // Live camera frames need a secure context. Over plain HTTP the OS camera is
  // still reachable through a file input with `capture`, which is not gated the
  // same way, so the dialog switches to a shoot-then-decode flow instead of
  // showing an error the participant cannot act on.
  const [liveCamera] = useState(
    () =>
      typeof window === 'undefined' ||
      (window.isSecureContext && !!navigator.mediaDevices?.getUserMedia),
  );
  useEffect(() => {
    if (!open) return;
    // Reopening the dialog clears the previous device/decoder error. This runs
    // for the capture-only path too, which returns before any camera setup.
    // eslint-disable-next-line react/react-compiler
    setError('');
    if (!liveCamera) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    handled.current = false;
    const stop = () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
    const accept = async (code: string) => {
      if (handled.current) return;
      handled.current = true;
      stop();
      setBusy(true);
      try {
        await onScan(code);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : '読み取れませんでした。');
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
          throw new Error(
            'この環境ではカメラを起動できません。QRコード画像を選択してください。',
          );
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
          },
          audio: false,
        });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        if (!video.current) {
          stop();
          return;
        }
        video.current.srcObject = media;
        await video.current.play();
        const reader = await qrDecoder();
        // The next frame is only looked at once this one has been decoded, so
        // a slow phone never queues frames up behind each other.
        async function tick() {
          if (cancelled || handled.current) return;
          const v = video.current;
          const text =
            v && v.readyState >= 2 && v.videoWidth
              ? await reader.detect(v, frameEdge)
              : null;
          if (cancelled || handled.current) return;
          if (text) {
            void accept(text);
            return;
          }
          timer = setTimeout(() => void tick(), 220);
        }
        void tick();
      } catch (e) {
        stop();
        if (!cancelled)
          setError(
            e instanceof DOMException
              ? 'カメラを使用できません。ブラウザのカメラ許可を確認するか、QRコード画像を選択してください。'
              : e instanceof Error
                ? e.message
                : 'カメラを起動できませんでした。',
          );
      }
    }
    void start();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stop();
    };
  }, [open, retry, liveCamera, onScan, onClose]);
  async function image(file: File | undefined) {
    if (!file) return;
    setError('');
    if (file.size > 12 * 1024 * 1024) {
      setError('画像は12MB以下で選択してください。');
      return;
    }
    handled.current = true;
    stream.current?.getTracks().forEach((t) => t.stop());
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      let text: string | null;
      try {
        text = await (await qrDecoder()).detect(bitmap, photoEdge);
      } finally {
        bitmap.close();
      }
      if (!text)
        throw new Error(
          'QRコードが見つかりません。QRコード全体が鮮明に写った画像を選択してください。',
        );
      await onScan(text);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み取れませんでした。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="scanner-dialog" showCloseButton={false}>
        <DialogTitle>{t('QRコードを読み取る')}</DialogTitle>
        <DialogDescription>
          {liveCamera
            ? t('立ち止まって、四隅の枠を目安にQRコード全体を写してください。')
            : t('立ち止まって、QRコード全体が入るように撮影してください。')}
        </DialogDescription>
        {liveCamera ? (
          <div className={busy ? 'camera-preview busy' : 'camera-preview'}>
            <video ref={video} muted playsInline className="camera" />
            <div className="qr-guide" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </div>
            {!error && <span className="qr-laser" aria-hidden="true" />}
          </div>
        ) : (
          <div className="camera-shot">
            <Camera size={34} aria-hidden="true" />
            <p>{t('カメラで撮影してQRコードを読み取ります。')}</p>
          </div>
        )}
        <output className={error ? 'scanner-error' : ''}>
          {busy
            ? t('押印を確認しています…')
            : t(error) ||
              (liveCamera
                ? t('QRコードにカメラを向けてください。')
                : t('下のボタンでカメラが開きます。'))}
        </output>
        {liveCamera && error && (
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(false);
              setRetry((v) => v + 1);
            }}
          >
            {t('カメラで再試行')}
          </Button>
        )}
        {!liveCamera && (
          <label className="file-label capture-action">
            <Camera size={19} aria-hidden="true" />
            {busy ? t('読み取り中…') : t('カメラでQRコードを撮影する')}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={busy}
              onChange={(e) => {
                void image(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        )}
        <label className="file-label">
          {t('撮影済みのQRコード画像を選ぶ')}
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => {
              void image(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        <DialogClose render={<Button variant="outline" />}>
          {t('閉じる')}
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
