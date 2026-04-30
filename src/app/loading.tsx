export default function Loading() {
  return (
    <main className="min-h-dvh bg-subway-darker flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="text-4xl animate-bounce">🚇</div>
        <p className="text-subway-muted text-sm font-mono">
          Loading<span className="animate-blink">_</span>
        </p>
      </div>
    </main>
  );
}
