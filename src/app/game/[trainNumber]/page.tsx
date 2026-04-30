'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGameStore } from '@/store/gameStore';
import { OmokGame } from '@/components/game/OmokGame';
import { MafiaGame } from '@/components/game/MafiaGame';
import type { GameSession, Player, ChatMessage } from '@/types';
import { motion } from 'framer-motion';

export default function GamePage() {
  const params = useParams();
  const trainNumber = params.trainNumber as string;
  const router = useRouter();
  const { playerId, roomId, setSession, setPlayers, setChatMessages, addChatMessage } = useGameStore();

  const [session, setLocalSession] = useState<GameSession | null>(null);
  const [players, setLocalPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  // ✅ zustand persist hydration 완료 여부
  const [hydrated, setHydrated] = useState(false);

  // ✅ 마운트 후 한 틱 뒤에 hydration 완료로 처리
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    // hydration 전엔 redirect 하지 않음 — playerId가 아직 null일 수 있음
    if (!hydrated) return;
    if (!playerId || !roomId) {
      router.replace('/');
    }
  }, [hydrated, playerId, roomId, router]);

  useEffect(() => {
    if (!roomId) return;

    const loadGame = async () => {
      const { data: sessionData } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('room_id', roomId)
        .eq('status', 'playing')
        .single();

      if (!sessionData) {
        router.push(`/lobby/${trainNumber}`);
        return;
      }

      setLocalSession(sessionData);
      setSession(sessionData);

      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at');

      if (playersData) {
        setLocalPlayers(playersData);
        setPlayers(playersData);
      }

      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (messages) setChatMessages(messages);

      setLoading(false);
    };

    loadGame();
  }, [roomId, router, trainNumber, setSession, setPlayers, setChatMessages]);

  // Realtime
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`game:${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'game_sessions',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const updated = payload.new as GameSession;
        setLocalSession(updated);
        setSession(updated);
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'players',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setLocalPlayers(prev =>
            prev.map(p => p.id === (payload.new as Player).id ? payload.new as Player : p)
          );
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
    }, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(heartbeat);
    };
  }, [roomId, playerId, addChatMessage, setSession]);

  // ✅ hydration 전이거나 로딩 중이면 스피너
  if (!hydrated || loading) {
    return (
      <div className="min-h-dvh bg-subway-darker flex items-center justify-center">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="text-4xl"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            🚇
          </motion.div>
          <p className="text-subway-muted text-sm">게임 불러오는 중...</p>
        </motion.div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-dvh bg-subway-darker flex items-center justify-center">
        <div className="text-center">
          <p className="text-subway-muted">게임을 찾을 수 없습니다</p>
          <button
            onClick={() => router.push(`/lobby/${trainNumber}`)}
            className="subway-btn-ghost mt-4"
          >
            로비로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // ✅ playerId가 확실히 있을 때만 렌더링 ('' 전달 방지)
  if (!playerId || !roomId) return null;

  return session.game_mode === 'omok' ? (
    <OmokGame
      session={session}
      players={players}
      trainNumber={trainNumber}
      myPlayerId={playerId}
      roomId={roomId}
    />
  ) : (
    <MafiaGame
      session={session}
      players={players}
      trainNumber={trainNumber}
      myPlayerId={playerId}
      roomId={roomId}
    />
  );
}
