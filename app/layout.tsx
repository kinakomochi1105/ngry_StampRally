import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LanguageProvider } from '@/components/language';

export const metadata: Metadata = {
  title: '文化祭スタンプラリー | 校内をめぐろう',
  description: '文化祭のスポットを巡って、QRコードでスタンプを集めよう。',
};

export const viewport: Viewport = {
  // `cover` is what makes env(safe-area-inset-*) report real values, which the
  // fixed bottom bar and every sheet rely on to clear a phone's home bar.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f5fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0e17' },
  ],
};

/**
 * Applies the stored theme before the first paint. Without it the page draws
 * in the device theme and then swaps once React has hydrated, which reads as a
 * flash of the wrong colours on every navigation.
 */
const themeScript = `try{var t=localStorage.getItem('festival-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
