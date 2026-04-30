'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChatBox } from '@/components/lobby/ChatBox';
import { ROLE_LABELS } from '@/lib/utils';
import { playAlert } from '@/lib/utils';
import type { GameSession, Player, PlayerRole, GamePhase } from '@/types';

interface MafiaGameProps {
  session: GameSession;
  players: Player[];
  trainNumber: string;
  myPlayerId: string;
  roomId: string;
}

export function MafiaGame({ session: initialSession, players: initialPlayers, trainNumber, myPlayerId, roomId }: MafiaGameProps) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [players, setPlayers] = useState(initialPlayers);
  const [showRole, setShowRole] = useState(true);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [nightTarget, setNightTarget] = useState<string | null>(null);
  const [sheriffResult, setSheriffResult] = useState<{ nickname: string; role: string } | null>(null);
  const [showLastWords, setShowLastWords] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [phaseTimer, setPhaseTimer] = useState(60);
  const [reportedPlayers, setReportedPlayers] = useState<string[]>([]);
  const [showReportMenu, setShowReportMenu] = useState<string | null>(null);

  const me = players.find(p => p.id === myPlayerId);
  const myRole = me?.role;
  const isAlive = me?.is_alive ?? true;
  const phase = session.phase as GamePhase;
  const metadata = session.metadata as {
    arrowLog?: Array<{ from: string; to: string; type: string }>;
    nightTarget?: string;
    sheriffResult?: { targetId: string; role: string };
    dayEliminated?: string;
    nightEliminated?: string;
  };

  // Role reveal timer
  useEffect(() => {
    const t = setTimeout(() => setShowRole(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // Phase timer
  useEffect(() => {
    const duration = phase === 'night' ? 45 : phase === 'vote' ? 30 : 60;
    setPhaseTimer(duration);
    const interval = setInterval(() => {
      setPhaseTimer(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`mafia:${session.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'game_sessions',
        filter: `id=eq.${session.id}`,
      }, (payload) => {
        setSession(payload.new as GameSession);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'players',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        setPlayers(prev =>
          prev.map(p => p.id === (payload.new as Player).id ? payload.new as Player : p)
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session.id, roomId]);

  const handleVote = async (targetId: string) => {
    if (!isAlive || phase !== 'vote') return;
    setMyVote(targetId);

    await fetch('/api/games', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        playerId: myPlayerId,
        action: 'mafia_vote',
        payload: { targetId },
      }),
    });
  };

  const handleNightAction = async (targetId: string) => {
    if (!isAlive || phase !== 'night') return;
    
    if (myRole === 'pickpocket') {
      setNightTarget(targetId);
      await fetch('/api/games', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          playerId: myPlayerId,
          action: 'mafia_night',
          payload: { targetId },
        }),
      });
    } else if (myRole === 'sheriff') {
      setNightTarget(targetId);
      const res = await fetch('/api/games', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          playerId: myPlayerId,
          action: 'mafia_sheriff',
          payload: { targetId },
        }),
      });
      const data = await res.json();
      const target = players.find(p => p.id === targetId);
      if (target && data.targetRole) {
        setSheriffResult({
          nickname: target.nickname,
          role: ROLE_LABELS[data.targetRole]?.name || data.targetRole,
        });
      }
    }
  };

  const handleAdvancePhase = async () => {
    const res = await fetch('/api/games', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        playerId: myPlayerId,
        action: 'advance_phase',
        payload: {},
      }),
    });
    const data = await res.json();
    if (data.ended) {
      // Will be handled by realtime
    }
  };

  const handleReport = async (targetId: string) => {
    if (reportedPlayers.includes(targetId)) return;
    setReportedPlayers(prev => [...prev, targetId]);
    setShowReportMenu(null);

    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        reporterPlayerId: myPlayerId,
        reportedPlayerId: targetId,
      }),
    });
  };

  const handleLeave = useCallback(async () => {
    if (!isLeaving) {
      setIsLeaving(true);
      setShowLastWords(true);
    }
  }, [isLeaving]);

  const handleLastWordsSent = async (message: string) => {
    // Send last words as special chat
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        playerId: myPlayerId,
        content: message,
        isLastWords: true,
      }),
    });

    await supabase.from('players').update({ is_connected: false }).eq('id', myPlayerId);
    router.push('/');
  };

  const aliveTargets = players.filter(p => p.is_alive && p.id !== myPlayerId);
  const isGameOver = session.status === 'ended';
  const winner = (session as unknown as { winner_role?: string }).winner_role;

  const phaseConfig = {
    day: { label: '낮', color: 'text-subway-yellow', bg: 'bg-yellow-950/30', border: 'border-yellow-800', desc: '소매치기를 찾아라! 토론하세요.' },
    night: { label: '밤', color: 'text-blue-400', bg: 'bg-blue-950/30', border: 'border-blue-800', desc: '소매치기가 움직입니다...' },
    vote: { label: '투표', color: 'text-red-400', bg: 'bg-red-950/30', border: 'border-red-800', desc: '하차시킬 승객을 선택하세요.' },
    result: { label: '결과', color: 'text-green-400', bg: 'bg-green-950/30', border: 'border-green-800', desc: '결과를 확인하세요.' },
  };

  const currentPhase = phaseConfig[phase] || phaseConfig.day;

  return (
    <main className="min-h-dvh bg-subway-darker flex flex-col safe-top safe-bottom">
      {/* Header */}
      <div className="glass-panel border-b border-subway-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-subway-muted">🚇 {trainNumber}</span>
          <span className="text-xs text-subway-muted">·</span>
          <span className="text-xs text-subway-muted">라운드 {session.round_number}</span>
        </div>
        <button
          onClick={handleLeave}
          className="text-xs text-subway-muted hover:text-subway-orange transition-colors"
        >
          🚪 하차
        </button>
      </div>

      {/* Phase banner */}
      <div className={`px-4 py-2 border-b flex items-center justify-between ${currentPhase.bg} ${currentPhase.border.replace('border-', 'border-b-')}`}>
        <div className="flex items-center gap-2">
          <span className={`phase-banner ${currentPhase.bg} ${currentPhase.border} border ${currentPhase.color} text-xs`}>
            {currentPhase.label}
          </span>
          <span className="text-xs text-subway-muted">{currentPhase.desc}</span>
        </div>
        <span className={`font-mono text-sm font-bold tabular-nums ${phaseTimer <= 10 ? 'text-red-400 animate-pulse' : currentPhase.color}`}>
          {phaseTimer}s
        </span>
      </div>

      {/* My role */}
      {myRole && !isGameOver && (
        <div className={`px-4 py-2 flex items-center gap-2 border-b border-subway-border/50 ${
          !isAlive ? 'opacity-50' : ''
        }`}>
          <span className="text-lg">{ROLE_LABELS[myRole]?.emoji}</span>
          <div>
            <span className="text-xs text-subway-muted">내 역할: </span>
            <span className={`text-xs font-bold ${
              myRole === 'pickpocket' ? 'text-red-400' :
              myRole === 'sheriff' ? 'text-blue-400' :
              myRole === 'transfer' ? 'text-purple-400' :
              'text-subway-text'
            }`}>
              {ROLE_LABELS[myRole]?.name}
            </span>
          </div>
          {!isAlive && <span className="text-xs text-subway-muted ml-auto">💀 하차됨</span>}
        </div>
      )}

      {/* Sheriff result */}
      <AnimatePresence>
        {sheriffResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-4 mt-2 p-3 rounded-xl bg-blue-950/50 border border-blue-700/50 text-sm"
          >
            <span className="text-blue-300">🔍 조사 결과: </span>
            <span className="font-medium">{sheriffResult.nickname}</span>
            <span className="text-blue-300">의 역할은 </span>
            <span className="font-bold text-blue-200">{sheriffResult.role}</span>
            <span className="text-blue-300">입니다</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Arrow log - visual vote tracker */}
        {metadata.arrowLog && metadata.arrowLog.length > 0 && (
          <div className="px-4 py-3 border-b border-subway-border/50">
            <p className="text-xs text-subway-muted mb-2 uppercase tracking-widest">투표 현황</p>
            <div className="flex flex-wrap gap-1">
              {metadata.arrowLog
                .filter(a => a.type === 'vote')
                .map((arrow, i) => {
                  const voter = players.find(p => p.id === arrow.from);
                  const target = players.find(p => p.id === arrow.to);
                  return (
                    <div key={i} className="text-xs bg-subway-panel border border-subway-border rounded-full px-2 py-1 flex items-center gap-1">
                      <span className="text-subway-muted">{voter?.nickname.split(' ')[1] || '?'}</span>
                      <span className="text-red-400">→</span>
                      <span className="text-subway-text">{target?.nickname.split(' ')[1] || '?'}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Player list with actions */}
        <div className="px-4 py-3">
          <p className="text-xs text-subway-muted mb-2 uppercase tracking-widest">승객 목록</p>
          <div className="space-y-2">
            {players.map((player) => {
              const isMe = player.id === myPlayerId;
              const isTarget = nightTarget === player.id || myVote === player.id;
              const canTarget = isAlive && !isMe && player.is_alive &&
                ((phase === 'vote') || (phase === 'night' && (myRole === 'pickpocket' || myRole === 'sheriff')));

              return (
                <motion.div
                  key={player.id}
                  className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    !player.is_alive
                      ? 'opacity-40 border-subway-border/30 bg-transparent'
                      : isMe
                      ? 'border-subway-yellow/30 bg-subway-yellow/5'
                      : isTarget
                      ? 'border-red-500/50 bg-red-950/20'
                      : 'border-subway-border bg-subway-panel'
                  }`}
                  layout
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    !player.is_alive ? 'bg-gray-600' :
                    !player.is_connected ? 'bg-gray-500' :
                    'bg-green-400'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium truncate ${
                        !player.is_alive ? 'line-through text-subway-muted' : 'text-subway-text'
                      }`}>
                        {player.nickname}
                      </span>
                      {isMe && <span className="text-xs text-subway-yellow">나</span>}
                      {!player.is_alive && <span className="text-xs">💀</span>}
                    </div>
                    {/* Role reveal if game over */}
                    {isGameOver && player.role && (
                      <span className={`text-xs ${
                        player.role === 'pickpocket' ? 'text-red-400' :
                        player.role === 'sheriff' ? 'text-blue-400' :
                        'text-subway-muted'
                      }`}>
                        {ROLE_LABELS[player.role]?.emoji} {ROLE_LABELS[player.role]?.name}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  {canTarget && (
                    <div className="flex items-center gap-1">
                      {phase === 'vote' && (
                        <button
                          onClick={() => handleVote(player.id)}
                          className={`text-xs px-2 py-1 rounded-lg border transition-all ${
                            myVote === player.id
                              ? 'border-red-500 bg-red-950/50 text-red-400'
                              : 'border-subway-border text-subway-muted hover:border-red-600 hover:text-red-400'
                          }`}
                        >
                          {myVote === player.id ? '✓' : '투표'}
                        </button>
                      )}
                      {phase === 'night' && myRole === 'pickpocket' && (
                        <button
                          onClick={() => handleNightAction(player.id)}
                          className={`text-xs px-2 py-1 rounded-lg border transition-all ${
                            nightTarget === player.id
                              ? 'border-red-500 bg-red-950/50 text-red-400'
                              : 'border-subway-border text-subway-muted hover:border-red-600 hover:text-red-400'
                          }`}
                        >
                          🎯
                        </button>
                      )}
                      {phase === 'night' && myRole === 'sheriff' && (
                        <button
                          onClick={() => handleNightAction(player.id)}
                          className={`text-xs px-2 py-1 rounded-lg border transition-all ${
                            nightTarget === player.id
                              ? 'border-blue-500 bg-blue-950/50 text-blue-400'
                              : 'border-subway-border text-subway-muted hover:border-blue-500 hover:text-blue-400'
                          }`}
                        >
                          🔍
                        </button>
                      )}
                      
                      {/* Report button */}
                      {!reportedPlayers.includes(player.id) && (
                        <button
                          onClick={() => setShowReportMenu(showReportMenu === player.id ? null : player.id)}
                          className="text-xs px-1.5 py-1 rounded-lg border border-subway-border/50 text-subway-muted/50 hover:text-subway-muted transition-all"
                          title="신고"
                        >
                          ⚑
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Phase advance button (host can trigger) */}
        {!isGameOver && (
          <div className="px-4 pb-2">
            <button
              onClick={handleAdvancePhase}
              className="w-full subway-btn border border-subway-border/50 text-xs text-subway-muted hover:text-subway-text hover:border-subway-muted transition-all"
            >
              {phase === 'day' ? '투표 시작 →' :
               phase === 'vote' ? '투표 종료 →' :
               phase === 'night' ? '밤 종료 →' : '계속 →'}
            </button>
          </div>
        )}
      </div>

      {/* Chat */}
      <ChatBox roomId={roomId} playerId={myPlayerId} />

      {/* Report confirm modal */}
      <AnimatePresence>
        {showReportMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 flex items-end justify-center z-40 pb-4"
            onClick={() => setShowReportMenu(null)}
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              exit={{ y: 20 }}
              className="subway-card p-4 w-11/12 max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-sm text-subway-text mb-3">
                <strong>{players.find(p => p.id === showReportMenu)?.nickname}</strong>님을 신고하시겠어요?
              </p>
              <p className="text-xs text-subway-muted mb-4">3인 이상 신고시 30분 이용 제한됩니다.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowReportMenu(null)}
                  className="flex-1 subway-btn-ghost text-sm py-2"
                >
                  취소
                </button>
                <button
                  onClick={() => handleReport(showReportMenu)}
                  className="flex-1 subway-btn bg-red-900/50 border border-red-700 text-red-300 text-sm py-2 hover:bg-red-900 transition-colors"
                >
                  신고하기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Last words modal */}
      <AnimatePresence>
        {showLastWords && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="subway-card p-6 w-full max-w-sm"
            >
              <h3 className="font-bold text-subway-text mb-2">🚪 하차 한마디</h3>
              <p className="text-xs text-subway-muted mb-4">
                내릴 때 마지막 한마디를 남겨보세요.<br/>
                화면에 공개됩니다.
              </p>
              <ChatBox
                roomId={roomId}
                playerId={myPlayerId}
                isLastWords
                onLastWords={handleLastWordsSent}
              />
              <button
                onClick={() => {
                  router.push('/');
                }}
                className="w-full subway-btn-ghost text-sm py-2 mt-2"
              >
                그냥 나가기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role reveal */}
      <AnimatePresence>
        {showRole && myRole && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 p-6"
            onClick={() => setShowRole(false)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className={`role-card w-full max-w-xs ${
                myRole === 'pickpocket' ? 'border-red-600' :
                myRole === 'sheriff' ? 'border-blue-600' :
                myRole === 'transfer' ? 'border-purple-600' :
                'border-subway-border'
              }`}
            >
              <p className="text-xs text-subway-muted uppercase tracking-widest">당신의 역할</p>
              <div className="text-6xl">{ROLE_LABELS[myRole]?.emoji}</div>
              <h2 className={`font-display font-bold text-2xl ${
                myRole === 'pickpocket' ? 'text-red-400' :
                myRole === 'sheriff' ? 'text-blue-400' :
                myRole === 'transfer' ? 'text-purple-400' :
                'text-subway-text'
              }`}>
                {ROLE_LABELS[myRole]?.name}
              </h2>
              <p className="text-sm text-subway-muted">
                {ROLE_LABELS[myRole]?.description}
              </p>
              <p className="text-xs text-subway-muted/60 mt-2 animate-pulse">
                탭하여 닫기
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game over overlay */}
      <AnimatePresence>
        {isGameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="subway-card p-8 flex flex-col items-center gap-6 w-full max-w-sm text-center neon-border"
            >
              <div className="text-5xl">
                {winner === 'pickpocket' ? '🕵️' :
                 winner === 'citizens' ? '👮' : '🎭'}
              </div>
              <div>
                <h2 className="font-display font-bold text-2xl text-subway-yellow">게임 종료</h2>
                <p className="text-subway-text mt-1">
                  {winner === 'pickpocket' ? '소매치기 승리!' :
                   winner === 'citizens' ? '시민 승리!' : '환승객 승리!'}
                </p>
              </div>

              {/* Role reveals */}
              <div className="w-full space-y-2">
                <p className="text-xs text-subway-muted">최종 역할</p>
                {players.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-subway-muted">{p.nickname.split(' ')[1]}</span>
                    <span className={`${
                      p.role === 'pickpocket' ? 'text-red-400' :
                      p.role === 'sheriff' ? 'text-blue-400' :
                      'text-subway-muted'
                    }`}>
                      {p.role ? `${ROLE_LABELS[p.role]?.emoji} ${ROLE_LABELS[p.role]?.name}` : '-'}
                    </span>
                  </div>
                ))}
              </div>

              <button
                className="subway-btn-primary w-full"
                onClick={() => router.push(`/lobby/${trainNumber}`)}
              >
                다시 하기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
