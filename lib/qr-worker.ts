import jsQR from 'jsqr';

/**
 * Decodes QR codes off the main thread, for browsers without a native
 * BarcodeDetector. The page sends a frame's pixels (the buffer is transferred,
 * not copied) and gets back the text, or null.
 */
export type QrWorkerRequest = {
  id: number;
  width: number;
  height: number;
  pixels: ArrayBuffer;
};
export type QrWorkerResponse = { id: number; text: string | null };

// The project compiles against the DOM library, where `self` is a Window; in a
// dedicated worker it is the worker scope, of which only these two are used.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<QrWorkerRequest>) => void) | null;
  postMessage: (message: QrWorkerResponse) => void;
};

scope.onmessage = ({ data }) => {
  const code = jsQR(
    new Uint8ClampedArray(data.pixels),
    data.width,
    data.height,
    {
      inversionAttempts: 'attemptBoth',
    },
  );
  scope.postMessage({ id: data.id, text: code?.data ?? null });
};
