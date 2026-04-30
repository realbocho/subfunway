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
        // Auto-skip when timer runs out
        skipTurn(currentTurnPlayerId);
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [currentTurnPlayerId, isGameOver, durationSeconds, onTimerUpdate, skipTurn]);

  return { skipTurn };
}
