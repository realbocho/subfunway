import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { filterMessage } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const { roomId, playerId, content, isLastWords } = await req.json();
    const db = createServerSupabase();

    // Verify player
    const { data: player } = await db
      .from('players')
      .select('nickname, banned_until, room_id')
      .eq('id', playerId)
      .single();

    if (!player) {
      return NextResponse.json({ error: '플레이어를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (player.room_id !== roomId) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 });
    }

    if (player.banned_until && new Date(player.banned_until) > new Date()) {
      return NextResponse.json({ error: '채팅이 금지된 상태입니다.' }, { status: 403 });
    }

    if (!content || content.trim().length === 0 || content.length > 200) {
      return NextResponse.json({ error: '메시지 길이 오류' }, { status: 400 });
    }

    const { clean } = filterMessage(content.trim());

    // Get current session
    const { data: session } = await db
      .from('game_sessions')
      .select('id')
      .eq('room_id', roomId)
      .eq('status', 'playing')
      .single();

    const { data: message, error } = await db
      .from('chat_messages')
      .insert({
        room_id: roomId,
        session_id: session?.id || null,
        player_id: playerId,
        nickname: player.nickname,
        content: clean,
        is_last_words: isLastWords || false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message });
  } catch (err) {
    console.error('Chat error:', err);
    return NextResponse.json({ error: '메시지 전송 실패' }, { status: 500 });
  }
}
