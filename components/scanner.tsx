'use client';
import { useI18n } from '@/components/language';
import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
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
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    handled.current = false;
    // A new camera session clears the previous device/decoder error.
    // eslint-disable-next-line react/react-compiler
    setError('');
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
            'この環境ではカメラを起動できません。QR画像を選択してください。',
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
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        function tick() {
          if (cancelled || handled.current) return;
          const v = video.current;
          if (v && ctx && v.readyState >= 2 && v.videoWidth) {
            canvas.width = Math.min(800, v.videoWidth);
            canvas.height = Math.round(
              (v.videoHeight * canvas.width) / v.videoWidth,
            );
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(data.data, data.width, data.height, {
              inversionAttempts: 'attemptBoth',
            });
            if (code) {
              void accept(code.data);
              return;
            }
          }
          timer = setTimeout(tick, 220);
        }
        tick();
      } catch (e) {
        stop();
        if (!cancelled)
          setError(
            e instanceof DOMException
              ? 'カメラを使用できません。ブラウザのカメラ許可を確認するか、QR画像を選択してください。'
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
  }, [open, retry, onScan, onClose]);
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
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bitmap.width * scale);
      c.height = Math.round(bitmap.height * scale);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('画像を開けませんでした。');
      ctx.drawImage(bitmap, 0, 0, c.width, c.height);
      bitmap.close();
      const pixels = ctx.getImageData(0, 0, c.width, c.height);
      const qr = jsQR(pixels.data, pixels.width, pixels.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (!qr)
        throw new Error(
          'QRが見つかりません。QR全体が鮮明に写った画像を選択してください。',
        );
      await onScan(qr.data);
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
        <DialogTitle>{t('QRを読み取る')}</DialogTitle>
        <DialogDescription>
          {t('立ち止まって、四隅の枠を目安にQR全体を写してください。')}
        </DialogDescription>
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
        <output className={error ? 'scanner-error' : ''}>
          {busy
            ? t('押印を確認しています…')
            : t(error) || t('QRにカメラを向けてください。')}
        </output>
        {error && (
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
        <label className="file-label">
          {t('撮影済みのQR画像を選ぶ')}
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
