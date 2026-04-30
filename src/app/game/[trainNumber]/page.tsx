'use client';

import { useEffect, useState, useRef } from 'react';
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
  const [hydrated, setHydrated] = useState(false);
  // 게임이 실제로 끝났는지 추적 — 로비 리다이렉트 중복 방지
  const redirectingRef = useRef(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!playerId || !roomId) {
      router.replace('/');
    }
  }, [hydrated, playerId, roomId, router]);

  useEffect(() => {
    if (!roomId) return;

    const loadGame = async () => {
      // playing 세션뿐 아니라 ended 세션도 조회
      const { data: sessionData } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!sessionData || sessionData.status === 'ended') {
        // 세션이 없거나 이미 끝난 경우 → 로비로
        if (!redirectingRef.current) {
          redirectingRef.current = true;
          router.push(`/lobby/${trainNumber}`);
        }
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
        // 세션이 ended로 바뀌면 → 게임 컴포넌트가 결과 화면을 보여줌
        // 여기서 로비로 보내지 않음 (OmokGame 내부의 isGameOver UI가 처리)
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

  if (!session) return null;
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
