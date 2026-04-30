'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseOmokTimerProps {
  sessionId: string;
  currentTurnPlayerId: string | null;
  myPlayerId: string;
  isGameOver: boolean;
  onTimerUpdate: (seconds: number) => void;
  durationSeconds?: number;
}

export function useOmokTimer({
  sessionId,
  currentTurnPlayerId,
  myPlayerId,
  isGameOver,
  onTimerUpdate,
  durationSeconds = 10,
}: UseOmokTimerProps) {
  const timerRef = useRef<NodeJS.Timeout>();
  const secondsRef = useRef(durationSeconds);
  const hasSkippedRef = useRef(false);

  const skipTurn = useCallback(async (playerId: string) => {
    if (hasSkippedRef.current) return;
    hasSkippedRef.current = true;

    try {
      await fetch('/api/games/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, currentPlayerId: playerId }),
      });
    } catch {
      // Silent fail
    }
  }, [sessionId]);

  useEffect(() => {
    if (isGameOver || !currentTurnPlayerId) return;

    secondsRef.current = durationSeconds;
    hasSkippedRef.current = false;
    onTimerUpdate(durationSeconds);

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      secondsRef.current -= 1;
      onTimerUpdate(secondsRef.current);

      if (secondsRef.current <= 0) {
        clearInterval(timerRef.current);
        // ✅ 핵심 수정: 내가 현재 턴 플레이어일 때만 스킵 요청을 보냄
        // 방에 있는 모든 클라이언트가 스킵을 보내면 중복 처리됨
        if (currentTurnPlayerId === myPlayerId) {
          skipTurn(currentTurnPlayerId);
        }
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [currentTurnPlayerId, isGameOver, durationSeconds, onTimerUpdate, skipTurn, myPlayerId]);

  return { skipTurn };
}
