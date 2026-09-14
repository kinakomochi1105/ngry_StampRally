import type { Metadata } from 'next';
import { NotFoundScreen } from '@/components/error-screen';

export const metadata: Metadata = {
  title: 'ページが見つかりません | 文化祭スタンプラリー',
};

export default function NotFound() {
  return <NotFoundScreen />;
}
