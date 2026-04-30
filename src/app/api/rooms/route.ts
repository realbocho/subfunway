import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { generateNickname } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const { trainNumber, fingerprint } = await req.json();

    if (!trainNumber || !/^\d{4}$/.test(trainNumber)) {
      return NextResponse.json({ error: '열차 번호는 4자리 숫자입니다.' }, { status: 400 });
    }

    if (!fingerprint) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const db = createServerSupabase();

    // Check if player is banned
    const { data: existingPlayer } = await db
      .from('players')
      .select('banned_until')
      .eq('fingerprint', fingerprint)
      .not('banned_until', 'is', null)
      .order('banned_until', { ascending: false })
      .limit(1)
      .single();

    if (existingPlayer?.banned_until) {
      const bannedUntil = new Date(existingPlayer.banned_until);
      if (bannedUntil > new Date()) {
        const minutesLeft = Math.ceil((bannedUntil.getTime() - Date.now()) / 60000);
        return NextResponse.json(
          { error: `신고로 인해 ${minutesLeft}분간 이용이 제한됩니다.` },
          { status: 403 }
        );
      }
    }

    // Find or create room
    let room;
    const { data: existingRoom } = await db
      .from('rooms')
      .select('*')
      .eq('train_number', trainNumber)
      .neq('status', 'ended')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingRoom) {
      room = existingRoom;
    } else {
      const { data: newRoom, error } = await db
        .from('rooms')
        .insert({ train_number: trainNumber, status: 'waiting' })
        .select()
        .single();

      if (error) throw error;
      room = newRoom;
    }

    // Check if this fingerprint already has a player in this room
    const { data: existingPlayerInRoom } = await db
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .eq('fingerprint', fingerprint)
      .single();

    let player;
    if (existingPlayerInRoom) {
      // Reconnect
      const { data: updated } = await db
        .from('players')
        .update({ is_connected: true, last_seen: new Date().toISOString() })
        .eq('id', existingPlayerInRoom.id)
        .select()
        .single();
      player = updated;
    } else {
      // New player
      const nickname = generateNickname();
      const { data: newPlayer, error } = await db
        .from('players')
        .insert({
          room_id: room.id,
          fingerprint,
          nickname,
          is_connected: true,
        })
        .select()
        .single();

      if (error) throw error;
      player = newPlayer;

      // System chat message
      await db.from('chat_messages').insert({
        room_id: room.id,
        nickname: 'SYSTEM',
        content: `${nickname}님이 탑승했습니다 🚇`,
        is_system: true,
      });
    }

    // Update room last_activity
    await db
      .from('rooms')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', room.id);

    return NextResponse.json({ room, player });
  } catch (err) {
    console.error('Room join error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const trainNumber = req.nextUrl.searchParams.get('train');
  if (!trainNumber) {
    return NextResponse.json({ error: 'train number required' }, { status: 400 });
  }

  const db = createServerSupabase();
  const { data: room } = await db
    .from('rooms')
    .select('*')
    .eq('train_number', trainNumber)
    .neq('status', 'ended')
    .single();

  if (!room) {
    return NextResponse.json({ exists: false });
  }

  const { data: players } = await db
    .from('players')
    .select('*')
    .eq('room_id', room.id);

  return NextResponse.json({ exists: true, room, players: players || [] });
}
