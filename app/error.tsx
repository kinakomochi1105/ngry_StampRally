'use client';
import { useEffect } from 'react';
import { FailureScreen } from '@/components/error-screen';

/** Any page that throws while drawing, below the root layout. */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <FailureScreen digest={error.digest} onRetry={retry} />;
}
