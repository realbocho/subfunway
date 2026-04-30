'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useGameStore } from '@/store/gameStore';
import { ChatBox } from '@/components/lobby/ChatBox';
import { PlayerList } from '@/components/lobby/PlayerList';
import type { Player, Room, ChatMessage, GameMode } from '@/types';

export default function LobbyPage() {
  const params = useParams();
  const trainNumber = params.trainNumber as string;
  const router = useRouter();
  const { playerId, roomId, nickname, setPlayers, setRoom, setSession, setChatMessages, addChatMessage } = useGameStore();

  const [room, setLocalRoom] = useState<Room | null>(null);
  const [players, setLocalPlayers] = useState<Player[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (!playerId || !roomId) {
      router.replace('/');
    }
  }, [playerId, roomId, router]);

  const loadInitialData = useCallback(async () => {
    if (!roomId) return;

    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomData) {
      setLocalRoom(roomData);
      setRoom(roomData);

      // rooms.status가 playing이면 실제 playing 세션이 있는지 확인
      if (roomData.status === 'playing') {
        const { data: activeSession } = await supabase
          .from('game_sessions')
          .select('id, status')
          .eq('room_id', roomId)
          .eq('status', 'playing')
          .single();

        // 실제로 진행 중인 세션이 있을 때만 게임으로 이동
        if (activeSession && !redirectingRef.current) {
          redirectingRef.current = true;
          router.push(`/game/${trainNumber}`);
          return;
        }
      }
    }

    const { data: playersData } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });

    if (playersData) {
      setLocalPlayers(playersData);
      setPlayers(playersData);
      setPlayerCount(playersData.filter(p => p.is_connected).length);
    }

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (messages) setChatMessages(messages);
  }, [roomId, router, trainNumber, setRoom, setPlayers, setChatMessages]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Realtime subscriptions
  useEffect(() => {
    if (!roomId) return;

    const roomChannel = supabase
      .channel(`lobby:${roomId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'players',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setLocalPlayers(prev => {
            if (prev.find(p => p.id === (payload.new as Player).id)) return prev;
            return [...prev, payload.new as Player];
          });
        } else if (payload.eventType === 'UPDATE') {
          setLocalPlayers(prev =>
            prev.map(p => p.id === (payload.new as Player).id ? payload.new as Player : p)
          );
        } else if (payload.eventType === 'DELETE') {
          setLocalPlayers(prev => prev.filter(p => p.id !== (payload.old as Player).id));
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms',
        filter: `id=eq.${roomId}`,
      }, (payload) => {
        const updatedRoom = payload.new as Room;
        setLocalRoom(updatedRoom);
      })
      // ✅ rooms UPDATE 타이밍 이슈 우회 — game_sessions INSERT를 직접 감지
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'game_sessions',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        if (!redirectingRef.current) {
          redirectingRef.current = true;
          router.push(`/game/${trainNumber}`);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        addChatMessage(payload.new as ChatMessage);
      })
      .subscribe();

    const heartbeat = setInterval(async () => {
      if (playerId) {
        await supabase
          .from('players')
          .update({ last_seen: new Date().toISOString(), is_connected: true })
          .eq('id', playerId);
      }
    }, 10000);

    return () => {
      supabase.removeChannel(roomChannel);
      clearInterval(heartbeat);
    };
  }, [roomId, playerId, router, trainNumber, addChatMessage]);

  useEffect(() => {
    setPlayerCount(players.filter(p => p.is_connected).length);
    setPlayers(players);
  }, [players, setPlayers]);

  const handleStartGame = async () => {
    if (!selectedMode || !roomId || !playerId) return;

    if (selectedMode === 'mafia' && playerCount < 4) {
      alert('마피아 게임은 최소 4명이 필요합니다.');
      return;
    }

    if (playerCount < 2) {
      alert('최소 2명이 필요합니다.');
      return;
    }

    setIsStarting(true);
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, gameMode: selectedMode, playerId }),
      });

      const data = await res.json();
      if (res.ok) {
        setSession(data.session);
        redirectingRef.current = true;
        router.push(`/game/${trainNumber}`);
      } else {
        alert(data.error);
      }
    } catch {
      alert('게임 시작 실패');
    } finally {
      setIsStarting(false);
    }
  };

  const handleLeave = async () => {
    if (playerId) {
      await supabase.from('players').update({ is_connected: false }).eq('id', playerId);
      await supabase.from('chat_messages').insert({
        room_id: roomId,
        player_id: playerId,
        nickname: nickname || '?',
        content: `${nickname}님이 하차했습니다 🚪`,
        is_system: true,
      });
    }
    router.push('/');
  };

  return (
    <main className="min-h-dvh bg-subway-darker flex flex-col safe-top safe-bottom">
      <div className="glass-panel border-b border-subway-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeave}
            className="text-subway-muted hover:text-subway-text text-sm transition-colors"
          >
            ← 하차
          </button>
          <div className="h-4 w-px bg-subway-border" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-subway-muted">열차</span>
              <span className="train-number-display text-base">{trainNumber}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full bg-green-400"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-sm text-subway-muted">{playerCount}명 탑승중</span>
        </div>
      </div>

      <div className="px-4 py-2 flex justify-center">
        <div className="subway-card px-4 py-2 flex items-center gap-2">
          <span className="text-subway-yellow text-xs">나</span>
          <span className="text-subway-text text-sm font-medium">{nickname}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <PlayerList players={players} myPlayerId={playerId || ''} />

        <div className="px-4 py-3 border-t border-subway-border">
          <p className="text-xs text-subway-muted mb-2 text-center">게임 선택</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                mode: 'omok' as GameMode,
                title: '릴레이 팀 오목',
                emoji: '⚫',
                desc: '2인 이상',
                color: 'border-blue-500',
                bg: 'bg-blue-950/30',
              },
              {
                mode: 'mafia' as GameMode,
                title: '쾌속 마피아',
                emoji: '🕵️',
                desc: '4인 이상',
                color: 'border-red-500',
                bg: 'bg-red-950/30',
              },
            ].map(({ mode, title, emoji, desc, color, bg }) => (
              <motion.button
                key={mode}
                onClick={() => setSelectedMode(mode)}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectedMode === mode
                    ? `${color} ${bg}`
                    : 'border-subway-border bg-subway-panel hover:border-subway-muted'
                }`}
                whileTap={{ scale: 0.97 }}
              >
                {selectedMode === mode && (
                  <motion.div
                    className="absolute top-2 right-2 w-2 h-2 rounded-full bg-subway-yellow"
                    layoutId="selected-indicator"
                  />
                )}
                <div className="text-2xl mb-1">{emoji}</div>
                <div className="font-medium text-sm text-subway-text">{title}</div>
                <div className="text-xs text-subway-muted">{desc}</div>
              </motion.button>
            ))}
          </div>

          <AnimatePresence>
            {selectedMode && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="subway-btn-primary w-full mt-3 py-3 disabled:opacity-50"
                onClick={handleStartGame}
                disabled={isStarting || playerCount < 2}
              >
                {isStarting ? '시작 중...' : `게임 시작 (${playerCount}명)`}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <ChatBox roomId={roomId || ''} playerId={playerId || ''} />
      </div>
    </main>
  );
}
