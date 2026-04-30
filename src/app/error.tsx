'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-dvh bg-subway-darker flex flex-col items-center justify-center text-center p-6">
      <div className="text-6xl mb-6">⚠️</div>
      <h2 className="font-display font-bold text-2xl text-subway-text mb-2">
        열차 지연
      </h2>
      <p className="text-subway-muted mb-8 text-sm">
        일시적인 오류가 발생했습니다
      </p>
      <button
        onClick={reset}
        className="subway-btn-primary px-8 py-3"
      >
        다시 시도
      </button>
    </main>
  );
}
