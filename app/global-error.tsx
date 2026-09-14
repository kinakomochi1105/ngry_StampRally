'use client';
import './globals.css';
import { useEffect } from 'react';
import { FailureScreen } from '@/components/error-screen';
import { LanguageProvider } from '@/components/language';
import { applyStoredTheme } from '@/components/theme-toggle';

/**
 * A failure in the root layout itself. This replaces app/layout.tsx, so it
 * brings its own document, stylesheet and language provider; the theme is
 * re-applied because the layout's pre-paint script is gone with it.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  useEffect(applyStoredTheme, []);
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <title>エラー | 文化祭スタンプラリー</title>
      </head>
      <body>
        <LanguageProvider>
          <FailureScreen digest={error.digest} onRetry={retry} />
        </LanguageProvider>
      </body>
    </html>
  );
}
