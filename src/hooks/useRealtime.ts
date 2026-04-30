'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type TableName = 'rooms' | 'players' | 'game_sessions' | 'game_moves' | 'chat_messages' | 'votes' | 'reports';
type EventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface SubscriptionConfig {
  table: TableName;
  event: EventType;
  filter?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: (payload: RealtimePostgresChangesPayload<any>) => void;
}

export function useRealtime(channelName: string, subscriptions: SubscriptionConfig[], deps: unknown[] = []) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (subscriptions.length === 0) return;

    let channel = supabase.channel(channelName);

    for (const sub of subscriptions) {
      channel = channel.on(
        'postgres_changes',
        {
          event: sub.event,
          schema: 'public',
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {}),
        },
        sub.callback
      );
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelRef.current = channel;
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, ...deps]);
}
