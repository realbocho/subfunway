'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGameStore } from '@/store/gameStore';
import { ChatBox } from '@/components/lobby/ChatBox';
import { PlayerList } from '@/components/lobby/PlayerList';
import { OmokBoard } from '@/components/game/OmokBoard';
import { TimerRing } from '@/components/ui/TimerRing';
import { GameHeader } from '@/components/ui/GameHeader';
import { useOmokTimer } from '@/hooks/useOmokTimer';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { playPlaceStone, playAlert } from '@/lib/utils';
import type { GameSession, Player } from '@/types';

interface OmokGameProps {
  session: GameSession;
  players: Player[];
  trainNumber: string;
  myPlayerId: string;
  roomId: string;
}

export function OmokGame({ session: initialSession, players: initialPlayers, trainNumber, myPlayerId, roomId }: OmokGameProps) {
  const router = useRouter();
  const { nickname } = useGameStore();

  const [session, setSession] = useState(initialSession);
  const [players, setPlayers] = useState(initialPlayers);
  const [board, setBoard] = useState<(0|1|2)[]>(
    (initialSession.board_state as { cells?: (0|1|2)[] })?.cells || new Array(225).fill(0)
  );
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(
    (initialSession.board_state as { lastMove?: { row: number; col: number } })?.lastMove || null
  );
  const [turnTimer, setTurnTimer] = useState(10);
  const [isPlacing, setIsPlacing] = useState(false);
  const [winLine, setWinLine] = useState<number[]>([]);

  const isGameOver = session.status === 'ended';
  const winTeam = session.winner_team;
  const currentTurnPlayerId = session.current_turn_player_id;
  const isMyTurn = currentTurnPlayerId === myPlayerId;
  const myTeam = players.find(p => p.id === myPlayerId)?.team ?? null;
  const connectedCount = players.filter(p => p.is_connected).length;

  useHeartbeat(myPlayerId);

  useOmokTimer({
    sessionId: session.id,
    currentTurnPlayerId,
    myPlayerId,
    isGameOver,
    onTimerUpdate: setTurnTimer,
    durationSeconds: 10,
  });

  useEffect(() => {
    if (isMyTurn && !isGameOver) playAlert();
  }, [isMyTurn, isGameOver]);

  useEffect(() => {
    const channel = supabase
      .channel(`omok:${session.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'game_sessions',
        filter: `id=eq.${session.id}`,
      }, (payload) => {
        const updated = payload.new as GameSession;
        setSession(updated);
        const cells = (updated.board_state as { cells?: (0|1|2)[] })?.cells;
        const lm = (updated.board_state as { lastMove?: { row: number; col: number } })?.lastMove;
        if (cells) setBoard(cells);
        if (lm) setLastMove(lm);
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'players',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setPlayers(prev => prev.map(p =>
            p.id === (payload.new as Player).id ? payload.new as Player : p
          ));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session.id, roomId]);

  const handleCellClick = async (row: number, col: number) => {
    if (!isMyTurn || isGameOver || isPlacing) return;
    if (board[row * 15 + col] !== 0) return;

    setIsPlacing(true);
    const newBoard = [...board] as (0|1|2)[];
    newBoard[row * 15 + col] = myTeam as 1|2;
    setBoard(newBoard);
    setLastMove({ row, col });
    playPlaceStone();

    try {
      const res = await fetch('/api/games', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          playerId: myPlayerId,
          action: 'omok_place',
          payload: { row, col },
        }),
      });
      const data = await res.json();
      if (data.won) calculateWinLine(newBoard, row, col, myTeam as number);
      if (!res.ok) { setBoard(board); setLastMove(lastMove); }
    } catch {
      setBoard(board); setLastMove(lastMove);
    } finally {
      setIsPlacing(false);
    }
  };

  function calculateWinLine(cells: (0|1|2)[], row: number, col: number, team: number) {
    const directions = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr, dc] of directions) {
      const line: number[] = [row * 15 + col];
      for (const mult of [1, -1]) {
        let r = row + dr * mult, c = col + dc * mult;
        while (r >= 0 && r < 15 && c >= 0 && c < 15 && cells[r*15+c] === team) {
          line.push(r*15+c); r += dr*mult; c += dc*mult;
        }
      }
      if (line.length >= 5) { setWinLine(line); return; }
    }
  }

  const handleLeave = async () => {
    await fetch('/api/players/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: myPlayerId, roomId }),
    });
    router.push('/');
  };

  const currentTurnPlayer = players.find(p => p.id === currentTurnPlayerId);

  return (
    <main className="min-h-dvh bg-subway-darker flex flex-col safe-top safe-bottom">
      <GameHeader
        trainNumber={trainNumber}
        connectedCount={connectedCount}
        onLeave={handleLeave}
        rightContent={
          <div className="flex items-center gap-2 text-xs">
            <span className="text-blue-400">청 {players.filter(p=>p.team===1&&p.is_connected).length}</span>
            <span className="text-subway-muted">vs</span>
            <span className="text-red-400">홍 {players.filter(p=>p.team===2&&p.is_connected).length}</span>
          </div>
        }
      />

      <div className={`px-4 py-2 flex items-center justify-between border-b transition-all duration-500 ${
        isMyTurn ? 'bg-subway-yellow/10 border-subway-yellow/30' : 'border-subway-border/50'
      }`}>
        <div className="flex items-center gap-2">
          {isMyTurn ? (
            <motion.span
              className="text-subway-yellow font-bold text-sm"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 0.7, repeat: Infinity }}
            >
              ⚡ 내 차례! {myTeam === 1 ? '(청팀)' : '(홍팀)'}
            </motion.span>
          ) : (
            <span className="text-subway-muted text-sm">
              {currentTurnPlayer?.nickname.split(' ')[1] || '...'}
              <span className={`ml-1.5 text-xs ${currentTurnPlayer?.team === 1 ? 'text-blue-400' : 'text-red-400'}`}>
                {currentTurnPlayer?.team === 1 ? '청팀' : currentTurnPlayer?.team === 2 ? '홍팀' : ''}
              </span>
            </span>
          )}
        </div>
        <TimerRing seconds={turnTimer} maxSeconds={10} urgent={isMyTurn} />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-2">
        <OmokBoard
          cells={board}
          lastMove={lastMove}
          winLine={winLine}
          myTeam={myTeam}
          isMyTurn={isMyTurn && !isPlacing}
          isGameOver={isGameOver}
          onCellClick={handleCellClick}
        />
      </div>

      <PlayerList players={players} myPlayerId={myPlayerId} showTeams />
      <ChatBox roomId={roomId} playerId={myPlayerId} />

      <AnimatePresence>
        {isGameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/75 flex items-center justify-center z-50 p-6 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="subway-card p-8 flex flex-col items-center gap-5 w-full max-w-sm text-center neon-border"
            >
              <motion.div
                className="text-5xl"
                animate={{ rotate: [0,-10,10,0], scale: [1,1.1,1] }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                {winTeam === myTeam ? '🎉' : '😔'}
              </motion.div>
              <div>
                <h2 className={`font-display font-bold text-2xl ${winTeam === 1 ? 'text-blue-400' : 'text-red-400'}`}>
                  {winTeam === 1 ? '청팀' : '홍팀'} 승리!
                </h2>
                <p className="text-subway-muted text-sm mt-1">
                  {winTeam === myTeam ? '같은 팀이 이겼어요 🎊' : '다음엔 꼭 이길 수 있어요'}
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <button className="flex-1 subway-btn-ghost py-3 text-sm" onClick={() => router.push('/')}>하차</button>
                <button className="flex-1 subway-btn-primary py-3" onClick={() => router.push(`/lobby/${trainNumber}`)}>다시 하기</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
