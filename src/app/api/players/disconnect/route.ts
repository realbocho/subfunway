import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { playerId, roomId, lastWords } = await req.json();
    const db = createServerSupabase();

    if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });

    // Mark player as disconnected
    await db.from('players')
      .update({ is_connected: false, last_seen: new Date().toISOString() })
      .eq('id', playerId);

    // Post last words if provided
    if (lastWords?.trim()) {
      const { data: player } = await db
        .from('players')
        .select('nickname')
        .eq('id', playerId)
        .single();

      await db.from('chat_messages').insert({
        room_id: roomId,
        player_id: playerId,
        nickname: player?.nickname || '?',
        content: lastWords.trim(),
        is_system: true,
        is_last_words: true,
      });
    }

    // Check if room is now empty - set to ended
    const { count } = await db
      .from('players')
      .select('id', { count: 'exact' })
      .eq('room_id', roomId)
      .eq('is_connected', true);

    if ((count || 0) === 0) {
      await db.from('rooms').update({ status: 'ended' }).eq('id', roomId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Disconnect error:', err);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
