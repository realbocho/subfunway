import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-subway-darker flex flex-col items-center justify-center text-center p-6">
      <div className="text-6xl mb-6">🚇</div>
      <h1 className="font-display font-bold text-2xl text-subway-yellow mb-2">
        종착역입니다
      </h1>
      <p className="text-subway-muted mb-8">
        요청하신 페이지를 찾을 수 없습니다
      </p>
      <Link
        href="/"
        className="subway-btn-primary px-8 py-3"
      >
        홈으로 돌아가기
      </Link>
    </main>
  );
}
