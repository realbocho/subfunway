'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getFingerprint, saveLocalPlayer } from '@/lib/utils';
import { useGameStore } from '@/store/gameStore';

export default function HomePage() {
  const [trainInput, setTrainInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'intro' | 'enter'>('intro');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { setPlayer, setRoom, reset } = useGameStore();

  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    if (step === 'enter') {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [step]);

  // 핵심 수정: train 값을 직접 인자로 받아서 state closure 문제 제거
  const handleJoin = async (train: string) => {
    if (train.length !== 4) {
      setError('4자리 열차 번호를 입력해주세요');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const fingerprint = await getFingerprint();

      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainNumber: train, fingerprint }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '입장 실패');
        return;
      }

      setPlayer(data.player.id, data.player.nickname, fingerprint);
      setRoom(data.room);
      saveLocalPlayer({
        playerId: data.player.id,
        roomId: data.room.id,
        nickname: data.player.nickname,
        fingerprint,
      });

      router.push(`/lobby/${train}`);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setTrainInput(value);
    setError('');
    // 4자리가 되면 최신 value를 바로 넘김 (state 업데이트 대기 없음)
    if (value.length === 4) {
      handleJoin(value);
    }
  };

  return (
    <main className="min-h-dvh bg-subway-darker flex flex-col items-center justify-center relative overflow-hidden safe-top safe-bottom">
      {/* Background */}
      <div className="absolute inset-0 bg-grid opacity-100" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-subway-darker/80" />

      {/* Animated subway line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-subway-yellow to-transparent opacity-30" />
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-subway-blue to-transparent opacity-30" />

      {/* Moving dot */}
      <motion.div
        className="absolute top-0 w-4 h-1 bg-subway-yellow rounded-full"
        animate={{ x: ['0vw', '100vw'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />

      <div className="relative z-10 w-full max-w-sm px-6">
        <AnimatePresence mode="wait">
          {step === 'intro' ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center gap-8 text-center"
            >
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  className="text-6xl"
                  animate={{ rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  🚇
                </motion.div>
                <div>
                  <h1 className="font-display font-bold text-3xl text-subway-yellow neon-text tracking-tight">
                    서브웨이 커넥트
                  </h1>
                  <p className="text-subway-muted text-sm mt-1 font-body">
                    Subway Connect
                  </p>
                </div>
              </div>

              <div className="subway-card p-5 w-full neon-border">
                <p className="text-subway-text text-sm leading-relaxed">
                  지루한 이동 시간을<br />
                  <span className="text-subway-yellow font-bold">즐거운 연결</span>로 바꿔드립니다
                </p>
                <div className="mt-3 flex justify-center gap-4 text-xs text-subway-muted">
                  <span>🎯 릴레이 팀 오목</span>
                  <span>🕵️ 쾌속 마피아</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 w-full">
                {[
                  { icon: '🔢', label: '열차 번호로\n즉시 연결' },
                  { icon: '👤', label: '완전\n익명 플레이' },
                  { icon: '⚡', label: '정거장 단위\n빠른 게임' },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="subway-card p-3 flex flex-col items-center gap-2"
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-xs text-subway-muted text-center whitespace-pre-line leading-tight">
                      {item.label}
                    </span>
                  </motion.div>
                ))}
              </div>

              <motion.button
                className="subway-btn-primary w-full text-lg py-4"
                onClick={() => setStep('enter')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                탑승하기 🚇
              </motion.button>

              <p className="text-subway-muted text-xs">
                문 옆 열차 번호 4자리를 입력하세요
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="enter"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-6"
            >
              <button
                onClick={() => { setStep('intro'); setTrainInput(''); setError(''); }}
                className="self-start text-subway-muted text-sm flex items-center gap-1 hover:text-subway-text transition-colors"
              >
                ← 돌아가기
              </button>

              <div className="text-center">
                <h2 className="font-display font-bold text-2xl text-subway-text">
                  열차 번호 입력
                </h2>
                <p className="text-subway-muted text-sm mt-1">
                  문 옆의 4자리 번호를 입력하세요
                </p>
              </div>

              <div className="subway-card p-4 w-full relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-subway-yellow opacity-50" />
                <div className="flex items-center gap-3">
                  <div className="text-3xl">🚪</div>
                  <div className="flex-1">
                    <div className="text-xs text-subway-muted mb-1">열차 번호 위치</div>
                    <div className="font-mono text-subway-yellow text-lg bg-subway-darker px-3 py-1 rounded-lg inline-block">
                      ████
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full">
                <input
                  ref={inputRef}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={trainInput}
                  onChange={handleInput}
                  placeholder="0000"
                  className="subway-input"
                  maxLength={4}
                  disabled={isLoading}
                />

                <div className="flex justify-center gap-2 mt-3">
                  {[0,1,2,3].map(i => (
                    <motion.div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                        i < trainInput.length ? 'bg-subway-yellow' : 'bg-subway-border'
                      }`}
                      animate={i < trainInput.length ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.2 }}
                    />
                  ))}
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="w-full text-center text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-xl px-4 py-3"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                className="subway-btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => handleJoin(trainInput)}
                disabled={isLoading || trainInput.length !== 4}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
                  <span className="loading-dots flex items-center justify-center gap-1">
                    연결 중<span>.</span><span>.</span><span>.</span>
                  </span>
                ) : (
                  '입장하기 →'
                )}
              </motion.button>

              <p className="text-subway-muted text-xs text-center">
                완전 익명 • 개인정보 수집 없음
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="scanline pointer-events-none" />
    </main>
  );
}
