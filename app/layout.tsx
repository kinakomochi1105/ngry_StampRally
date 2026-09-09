import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '文化祭スタンプラリー | 校内をめぐろう',
  description: '文化祭の6つのスポットを巡って、QRでスタンプを集めよう。',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
