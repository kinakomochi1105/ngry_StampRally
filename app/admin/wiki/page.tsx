import type { Metadata } from 'next';
import { WikiIndexPage } from '@/components/admin-wiki';
import './wiki.css';
export const metadata: Metadata = {
  title: '運営マニュアル | 文化祭スタンプラリー',
  description: '管理者向けの運営マニュアル。',
  robots: { index: false, follow: false },
};
export default function Page() {
  return <WikiIndexPage />;
}
