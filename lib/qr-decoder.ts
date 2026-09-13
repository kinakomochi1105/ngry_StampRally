'use client';
import type { QrWorkerRequest, QrWorkerResponse } from './qr-worker';

/**
 * Reads a QR code from a camera frame or a photo.
 *
 * The scanner looks at a frame every few hundred milliseconds for as long as it
 * is open, on a phone, in a pocket-warm hand, so where the work happens matters:
 * - a native BarcodeDetector (Chrome on Android, Safari 17+ on some devices)
 *   decodes in the platform, usually on dedicated hardware;
 * - otherwise jsQR runs in a Web Worker, so the page stays responsive;
 * - and only if a worker cannot start does jsQR run on the main thread.
 */
export type QrSource = HTMLVideoElement | ImageBitmap;

export type QrDecoder = {
  kind: 'native' | 'worker' | 'main-thread';
  /** The text of the first QR code found, or null. */
  detect: (source: QrSource, maxEdge: number) => Promise<string | null>;
  close: () => void;
};

type NativeDetector = {
  detect: (source: QrSource) => Promise<{ rawValue: string }[]>;
};
type NativeDetectorClass = {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

async function nativeDetector() {
  const Detector = (globalThis as { BarcodeDetector?: NativeDetectorClass })
    .BarcodeDetector;
  if (!Detector?.getSupportedFormats) return null;
  try {
    if (!(await Detector.getSupportedFormats()).includes('qr_code'))
      return null;
    return new Detector({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

/** Draws the source scaled so its longest edge is at most `maxEdge`. */
function pixelsOf(
  source: QrSource,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  maxEdge: number,
) {
  const width =
    source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const height =
    source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!width || !height) return null;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  // Resizing a canvas clears and reallocates it, so only when the size changes.
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  context.drawImage(source, 0, 0, w, h);
  return context.getImageData(0, 0, w, h);
}

function startWorker() {
  try {
    return new Worker(new URL('./qr-worker.ts', import.meta.url), {
      type: 'module',
    });
  } catch {
    return null;
  }
}

export async function createQrDecoder(): Promise<QrDecoder> {
  const native = await nativeDetector();
  if (native)
    return {
      kind: 'native',
      detect: async (source) => {
        try {
          return (await native.detect(source))[0]?.rawValue ?? null;
        } catch {
          // A frame that is not ready yet, or one the platform refused.
          return null;
        }
      },
      close: () => {},
    };

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('QRコードを読み取る準備ができませんでした。');
  const worker = startWorker();

  if (!worker) {
    const { default: jsQR } = await import('jsqr');
    return {
      kind: 'main-thread',
      detect: async (source, maxEdge) => {
        const image = pixelsOf(source, canvas, context, maxEdge);
        if (!image) return null;
        return (
          jsQR(image.data, image.width, image.height, {
            inversionAttempts: 'attemptBoth',
          })?.data ?? null
        );
      },
      close: () => {},
    };
  }

  let next = 0;
  const pending = new Map<number, (text: string | null) => void>();
  worker.onmessage = ({ data }: MessageEvent<QrWorkerResponse>) => {
    pending.get(data.id)?.(data.text);
    pending.delete(data.id);
  };
  // A worker that dies answers every outstanding frame with "nothing found".
  worker.onerror = () => {
    for (const resolve of pending.values()) resolve(null);
    pending.clear();
  };
  return {
    kind: 'worker',
    detect: (source, maxEdge) => {
      const image = pixelsOf(source, canvas, context, maxEdge);
      if (!image) return Promise.resolve(null);
      const id = ++next;
      const message: QrWorkerRequest = {
        id,
        width: image.width,
        height: image.height,
        pixels: image.data.buffer as ArrayBuffer,
      };
      return new Promise((resolve) => {
        pending.set(id, resolve);
        worker.postMessage(message, [message.pixels]);
      });
    },
    close: () => {
      worker.terminate();
      for (const resolve of pending.values()) resolve(null);
      pending.clear();
    },
  };
}
