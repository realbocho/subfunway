import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, reporterPlayerId, reportedPlayerId, reason } = await req.json();
    const db = createServerSupabase();

    // Check if already reported
    const { data: existing } = await db
      .from('reports')
      .select('id')
      .eq('session_id', sessionId)
      .eq('reporter_player_id', reporterPlayerId)
      .eq('reported_player_id', reportedPlayerId)
      .single();

    if (existing) {
      return NextResponse.json({ error: '이미 신고한 플레이어입니다.' }, { status: 400 });
    }

    // Insert report (trigger handles ban logic)
    const { error } = await db.from('reports').insert({
      session_id: sessionId,
      reporter_player_id: reporterPlayerId,
      reported_player_id: reportedPlayerId,
      reason,
    });

    if (error) throw error;

    // Check strike count
    const { count } = await db
      .from('reports')
      .select('id', { count: 'exact' })
      .eq('session_id', sessionId)
      .eq('reported_player_id', reportedPlayerId);

    const strikes = count || 0;

    return NextResponse.json({
      success: true,
      strikes,
      banned: strikes >= 3,
    });
  } catch (err) {
    console.error('Report error:', err);
    return NextResponse.json({ error: '신고 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
