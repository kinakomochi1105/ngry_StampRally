import type { Metadata } from 'next';
import { WikiArticlePage } from '@/components/admin-wiki';
import '../wiki.css';
export const metadata: Metadata = {
  title: '運営マニュアル | 文化祭スタンプラリー',
  description: '管理者向けの運営マニュアル。',
  robots: { index: false, follow: false },
};
// The manual itself is loaded from the admin API after sign-in, so the page
// only needs the requested slug.
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <WikiArticlePage slug={slug} />;
}
