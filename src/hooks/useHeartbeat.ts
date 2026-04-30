'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export function useHeartbeat(playerId: string | null, intervalMs = 8000) {
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!playerId) return;

    const beat = async () => {
      await supabase
        .from('players')
        .update({ last_seen: new Date().toISOString(), is_connected: true })
        .eq('id', playerId);
    };

    beat(); // Immediate first beat
    intervalRef.current = setInterval(beat, intervalMs);

    // Mark disconnected on cleanup
    return () => {
      clearInterval(intervalRef.current);
      supabase
        .from('players')
        .update({ is_connected: false })
        .eq('id', playerId)
        .then(() => {});
    };
  }, [playerId, intervalMs]);
}
