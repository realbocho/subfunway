import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { roomId, gameMode, playerId } = await req.json();
    const db = createServerSupabase();

    // Verify room and player
    const { data: room } = await db.from('rooms').select('*').eq('id', roomId).single();
    if (!room) return NextResponse.json({ error: '방을 찾을 수 없습니다.' }, { status: 404 });

    const { data: players } = await db
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_connected', true);

    if (!players || players.length < 2) {
      return NextResponse.json({ error: '최소 2명이 필요합니다.' }, { status: 400 });
    }

    // Update room status
    await db.from('rooms').update({ status: 'playing', game_mode: gameMode }).eq('id', roomId);

    let session;

    if (gameMode === 'omok') {
      // Assign teams
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      for (let i = 0; i < shuffled.length; i++) {
        await db.from('players')
          .update({ team: (i % 2 === 0) ? 1 : 2 })
          .eq('id', shuffled[i].id);
      }

      // Create session with empty board
      const { data: newSession } = await db.from('game_sessions').insert({
        room_id: roomId,
        game_mode: 'omok',
        status: 'playing',
        current_turn_player_id: shuffled.find(p => p.team === 1)?.id,
        board_state: { cells: new Array(225).fill(0) },
      }).select().single();
      session = newSession;

      await db.from('chat_messages').insert({
        room_id: roomId,
        session_id: newSession?.id,
        nickname: 'SYSTEM',
        content: '릴레이 팀 오목이 시작됩니다! 🎮 청팀 vs 홍팀',
        is_system: true,
      });

    } else if (gameMode === 'mafia') {
      if (players.length < 4) {
        return NextResponse.json({ error: '마피아 게임은 최소 4명이 필요합니다.' }, { status: 400 });
      }

      // Assign roles
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      const roles = assignMafiaRoles(shuffled.length);
      
      for (let i = 0; i < shuffled.length; i++) {
        await db.from('players')
          .update({ role: roles[i], is_alive: true })
          .eq('id', shuffled[i].id);
      }

      const { data: newSession } = await db.from('game_sessions').insert({
        room_id: roomId,
        game_mode: 'mafia',
        status: 'playing',
        phase: 'day',
        round_number: 1,
        board_state: {},
        metadata: { arrowLog: [] },
      }).select().single();
      session = newSession;

      await db.from('chat_messages').insert({
        room_id: roomId,
        session_id: newSession?.id,
        nickname: 'SYSTEM',
        content: '쾌속 지하철 마피아가 시작됩니다! 🚇 각자의 역할을 확인하세요.',
        is_system: true,
      });
    }

    return NextResponse.json({ session });
  } catch (err) {
    console.error('Game start error:', err);
    return NextResponse.json({ error: '게임 시작 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH - game actions (omok move, mafia action, vote)
export async function PATCH(req: NextRequest) {
  try {
    const { sessionId, playerId, action, payload } = await req.json();
    const db = createServerSupabase();

    const { data: session } = await db
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session || session.status === 'ended') {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (action === 'omok_place') {
      return await handleOmokPlace(db, session, playerId, payload);
    } else if (action === 'mafia_vote') {
      return await handleMafiaVote(db, session, playerId, payload);
    } else if (action === 'mafia_night') {
      return await handleMafiaNight(db, session, playerId, payload);
    } else if (action === 'mafia_sheriff') {
      return await handleSheriff(db, session, playerId, payload);
    } else if (action === 'advance_phase') {
      return await handleAdvancePhase(db, session);
    }

    return NextResponse.json({ error: '알 수 없는 액션' }, { status: 400 });
  } catch (err) {
    console.error('Game action error:', err);
    return NextResponse.json({ error: '게임 액션 오류' }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOmokPlace(db: any, session: any, playerId: string, payload: any) {
  const { row, col } = payload;

  if (session.current_turn_player_id !== playerId) {
    return NextResponse.json({ error: '당신의 턴이 아닙니다.' }, { status: 403 });
  }

  const { data: player } = await db.from('players').select('team, room_id').eq('id', playerId).single();
  if (!player) return NextResponse.json({ error: '플레이어 없음' }, { status: 404 });

  const cells = (session.board_state as { cells: number[] }).cells;
  const idx = row * 15 + col;

  if (cells[idx] !== 0) {
    return NextResponse.json({ error: '이미 돌이 있습니다.' }, { status: 400 });
  }

  cells[idx] = player.team;

  // Record move
  await db.from('game_moves').insert({
    session_id: session.id,
    player_id: playerId,
    move_type: 'place',
    payload: { row, col, team: player.team },
  });

  // Check win
  const won = checkOmokWin(cells, row, col, player.team);

  if (won) {
    await db.from('game_sessions').update({
      board_state: { cells, lastMove: { row, col } },
      status: 'ended',
      winner_team: player.team,
      ended_at: new Date().toISOString(),
    }).eq('id', session.id);

    await db.from('rooms').update({ status: 'waiting' }).eq('id', player.room_id);

    await db.from('chat_messages').insert({
      room_id: player.room_id,
      session_id: session.id,
      nickname: 'SYSTEM',
      content: `🎉 ${player.team === 1 ? '청팀' : '홍팀'} 승리! 5목 완성!`,
      is_system: true,
    });

    return NextResponse.json({ won: true, winTeam: player.team });
  }

  // Find next turn player
  const { data: allPlayers } = await db
    .from('players')
    .select('id, team')
    .eq('room_id', player.room_id)
    .eq('is_connected', true);

  const nextTeam = player.team === 1 ? 2 : 1;
  const teamPlayers = allPlayers?.filter((p: { team: number }) => p.team === nextTeam) || [];
  
  if (teamPlayers.length === 0) {
    return NextResponse.json({ error: '상대팀이 없습니다.' }, { status: 400 });
  }

  // Round-robin within team
  const currentIdx = teamPlayers.findIndex((p: { id: string }) => p.id === session.current_turn_player_id);
  const nextPlayer = teamPlayers[(currentIdx + 1) % teamPlayers.length];

  await db.from('game_sessions').update({
    board_state: { cells, lastMove: { row, col } },
    current_turn_player_id: nextPlayer.id,
  }).eq('id', session.id);

  return NextResponse.json({ success: true, nextPlayerId: nextPlayer.id });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleMafiaVote(db: any, session: any, playerId: string, payload: any) {
  const { targetId } = payload;
  
  // Upsert vote
  await db.from('votes').upsert({
    session_id: session.id,
    round_number: session.round_number,
    voter_id: playerId,
    target_id: targetId,
  }, { onConflict: 'session_id,round_number,voter_id' });

  // Update arrow log
  const metadata = session.metadata as { arrowLog: Array<{ from: string; to: string; type: string }> };
  const arrowLog = metadata.arrowLog || [];
  const existingIdx = arrowLog.findIndex((a) => a.from === playerId && a.type === 'vote');
  if (existingIdx >= 0) arrowLog[existingIdx].to = targetId;
  else arrowLog.push({ from: playerId, to: targetId, type: 'vote' });

  await db.from('game_sessions').update({
    metadata: { ...metadata, arrowLog },
  }).eq('id', session.id);

  return NextResponse.json({ success: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleMafiaNight(db: any, session: any, playerId: string, payload: any) {
  const { targetId } = payload;
  
  const { data: player } = await db.from('players').select('role').eq('id', playerId).single();
  if (player?.role !== 'pickpocket') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  }

  await db.from('game_sessions').update({
    metadata: { ...session.metadata, nightTarget: targetId },
  }).eq('id', session.id);

  await db.from('game_moves').insert({
    session_id: session.id,
    player_id: playerId,
    move_type: 'night_action',
    payload: { targetId },
  });

  return NextResponse.json({ success: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSheriff(db: any, session: any, playerId: string, payload: any) {
  const { targetId } = payload;
  
  const { data: player } = await db.from('players').select('role').eq('id', playerId).single();
  if (player?.role !== 'sheriff') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  }

  const { data: target } = await db.from('players').select('role').eq('id', targetId).single();

  await db.from('game_sessions').update({
    metadata: { ...session.metadata, sheriffResult: { targetId, role: target?.role } },
  }).eq('id', session.id);

  return NextResponse.json({ success: true, targetRole: target?.role });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleAdvancePhase(db: any, session: any) {
  const { data: alivePlayers } = await db
    .from('players')
    .select('*')
    .eq('room_id', (await db.from('game_sessions').select('room_id').eq('id', session.id).single()).data?.room_id)
    .eq('is_alive', true);

  const phase = session.phase;
  let nextPhase = phase;
  let metadata = session.metadata;

  if (phase === 'day') {
    nextPhase = 'vote';
  } else if (phase === 'vote') {
    // Tally votes
    const { data: votes } = await db
      .from('votes')
      .select('target_id')
      .eq('session_id', session.id)
      .eq('round_number', session.round_number);

    const tally: Record<string, number> = {};
    votes?.forEach((v: { target_id: string }) => {
      tally[v.target_id] = (tally[v.target_id] || 0) + 1;
    });

    const eliminated = Object.entries(tally).sort(([,a],[,b]) => b-a)[0]?.[0];
    if (eliminated) {
      const { data: eliminatedPlayer } = await db.from('players').select('role, room_id').eq('id', eliminated).single();
      await db.from('players').update({ is_alive: false }).eq('id', eliminated);
      
      // Check if transfer won
      if (eliminatedPlayer?.role === 'transfer') {
        await endMafiaGame(db, session, 'transfer', eliminatedPlayer.room_id);
        return NextResponse.json({ ended: true, winner: 'transfer' });
      }

      metadata = { ...metadata, dayEliminated: eliminated };
    }

    nextPhase = 'night';
  } else if (phase === 'night') {
    // Execute night action
    const nightTarget = metadata?.nightTarget;
    if (nightTarget) {
      await db.from('players').update({ is_alive: false }).eq('id', nightTarget);
      metadata = { ...metadata, nightEliminated: nightTarget, nightTarget: null };
    }

    // Check win conditions
    const pickpockets = alivePlayers?.filter((p: { role: string }) => p.role === 'pickpocket') || [];
    const citizens = alivePlayers?.filter((p: { role: string }) => p.role !== 'pickpocket') || [];

    const { data: updatedPlayers } = await db
      .from('players')
      .select('role, is_alive, room_id')
      .eq('room_id', session.room_id || '');

    const alivePickpockets = updatedPlayers?.filter((p: { role: string; is_alive: boolean }) => p.role === 'pickpocket' && p.is_alive) || [];
    const aliveCitizens = updatedPlayers?.filter((p: { role: string; is_alive: boolean }) => p.role !== 'pickpocket' && p.is_alive) || [];

    if (alivePickpockets.length === 0) {
      await endMafiaGame(db, session, 'citizens', session.room_id);
      return NextResponse.json({ ended: true, winner: 'citizens' });
    }

    if (alivePickpockets.length >= aliveCitizens.length) {
      await endMafiaGame(db, session, 'pickpocket', session.room_id);
      return NextResponse.json({ ended: true, winner: 'pickpocket' });
    }

    nextPhase = 'day';
  }

  await db.from('game_sessions').update({
    phase: nextPhase,
    round_number: nextPhase === 'day' && phase === 'night' ? session.round_number + 1 : session.round_number,
    metadata,
  }).eq('id', session.id);

  return NextResponse.json({ success: true, newPhase: nextPhase });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function endMafiaGame(db: any, session: any, winner: string, roomId: string) {
  await db.from('game_sessions').update({
    status: 'ended',
    winner_role: winner,
    ended_at: new Date().toISOString(),
  }).eq('id', session.id);

  await db.from('rooms').update({ status: 'waiting' }).eq('id', roomId);

  const winnerText = winner === 'pickpocket' ? '소매치기 승리! 🕵️' :
    winner === 'citizens' ? '시민 승리! 👮' : '환승객 승리! 🎭';

  await db.from('chat_messages').insert({
    room_id: roomId,
    session_id: session.id,
    nickname: 'SYSTEM',
    content: `🎉 게임 종료! ${winnerText}`,
    is_system: true,
  });
}

function checkOmokWin(cells: number[], row: number, col: number, team: number): boolean {
  const directions = [[0,1],[1,0],[1,1],[1,-1]];
  
  for (const [dr, dc] of directions) {
    let count = 1;
    
    for (const mult of [1, -1]) {
      let r = row + dr * mult;
      let c = col + dc * mult;
      while (r >= 0 && r < 15 && c >= 0 && c < 15) {
        if (cells[r * 15 + c] !== team) break;
        count++;
        r += dr * mult;
        c += dc * mult;
      }
    }
    
    if (count >= 5) return true;
  }
  return false;
}

function assignMafiaRoles(count: number): string[] {
  const roles: string[] = [];
  
  // 1 pickpocket per 4 players
  const pickpockets = Math.max(1, Math.floor(count / 4));
  const hasSheriff = count >= 5;
  const hasTransfer = count >= 6;
  
  for (let i = 0; i < pickpockets; i++) roles.push('pickpocket');
  if (hasSheriff) roles.push('sheriff');
  if (hasTransfer) roles.push('transfer');
  
  while (roles.length < count) roles.push('citizen');
  
  return roles.sort(() => Math.random() - 0.5);
}
