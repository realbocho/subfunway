import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, currentPlayerId } = await req.json();
    const db = createServerSupabase();

    const { data: session } = await db
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('status', 'playing')
      .single();

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Only skip if it's still this player's turn
    if (session.current_turn_player_id !== currentPlayerId) {
      return NextResponse.json({ skipped: false, reason: 'Turn already advanced' });
    }

    const { data: currentPlayer } = await db
      .from('players')
      .select('team, room_id')
      .eq('id', currentPlayerId)
      .single();

    if (!currentPlayer) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    // Find next player in opposite team
    const { data: allPlayers } = await db
      .from('players')
      .select('id, team')
      .eq('room_id', currentPlayer.room_id)
      .eq('is_connected', true);

    const nextTeam = currentPlayer.team === 1 ? 2 : 1;
    const teamPlayers = allPlayers?.filter((p: { team: number }) => p.team === nextTeam) || [];

    if (teamPlayers.length === 0) {
      return NextResponse.json({ skipped: false, reason: 'No players on opposite team' });
    }

    const nextPlayer = teamPlayers[0];

    await db.from('game_sessions')
      .update({ current_turn_player_id: nextPlayer.id })
      .eq('id', sessionId);

    // Post system message
    await db.from('chat_messages').insert({
      room_id: currentPlayer.room_id,
      session_id: sessionId,
      nickname: 'SYSTEM',
      content: '졸음 감지! 턴이 넘어갔습니다 💤',
      is_system: true,
    });

    return NextResponse.json({ skipped: true, nextPlayerId: nextPlayer.id });
  } catch (err) {
    console.error('Skip turn error:', err);
    return NextResponse.json({ error: 'Failed to skip turn' }, { status: 500 });
  }
}
