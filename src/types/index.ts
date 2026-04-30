// ============================================
// Database Types
// ============================================

export type RoomStatus = 'waiting' | 'playing' | 'ended';
export type GameMode = 'omok' | 'mafia';
export type PlayerRole = 'pickpocket' | 'sheriff' | 'transfer' | 'citizen';
export type GamePhase = 'day' | 'night' | 'vote' | 'result';

export interface Room {
  id: string;
  train_number: string;
  status: RoomStatus;
  game_mode: GameMode | null;
  created_at: string;
  last_activity: string;
  expires_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  fingerprint: string;
  nickname: string;
  team: 1 | 2 | null;
  role: PlayerRole | null;
  is_alive: boolean;
  is_connected: boolean;
  strike_count: number;
  banned_until: string | null;
  joined_at: string;
  last_seen: string;
}

export interface GameSession {
  id: string;
  room_id: string;
  game_mode: GameMode;
  status: 'playing' | 'ended';
  winner_team: 1 | 2 | null;
  winner_role: string | null;
  round_number: number;
  phase: GamePhase;
  current_turn_player_id: string | null;
  board_state: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  ended_at: string | null;
}

export interface GameMove {
  id: string;
  session_id: string;
  player_id: string | null;
  move_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  session_id: string | null;
  player_id: string | null;
  nickname: string;
  content: string;
  is_system: boolean;
  is_last_words: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  session_id: string;
  reporter_player_id: string | null;
  reported_player_id: string;
  reason: string | null;
  created_at: string;
}

export interface Vote {
  id: string;
  session_id: string;
  round_number: number;
  voter_id: string;
  target_id: string;
  created_at: string;
}

// ============================================
// App Types
// ============================================

export interface OmokBoard {
  cells: (0 | 1 | 2)[];  // 15x15 = 225 cells. 0=empty, 1=team1, 2=team2
  lastMove: { row: number; col: number } | null;
}

export interface MafiaGameState {
  phase: GamePhase;
  round: number;
  players: PlayerInGame[];
  nightActionTarget: string | null;
  sheriffTarget: string | null;
  eliminatedTonight: string | null;
  voteResults: Record<string, string>; // voterId -> targetId
  arrowLog: Array<{ from: string; to: string; type: 'vote' | 'night' | 'sheriff' }>;
}

export interface PlayerInGame {
  id: string;
  nickname: string;
  team: 1 | 2 | null;
  role: PlayerRole | null;
  is_alive: boolean;
  is_connected: boolean;
}

export interface LocalPlayerState {
  playerId: string;
  roomId: string;
  fingerprint: string;
  nickname: string;
  gameMode: GameMode | null;
}

// Korean station names for nickname generation
export const STATION_NAMES = [
  '성수역', '합정역', '신도림역', '강남역', '홍대역', '이태원역',
  '종로역', '을지로역', '명동역', '동대문역', '왕십리역', '건대역',
  '잠실역', '선릉역', '역삼역', '사당역', '신림역', '구로역',
  '노원역', '도봉역', '창동역', '수유역', '미아역', '길음역',
  '혜화역', '동묘역', '신설동역', '제기동역', '청량리역'
];

export const NICKNAME_SUFFIXES = [
  '비둘기', '에스컬레이터', '불나방', '승차권', '손잡이', '노약자석',
  '광고판', '스크린도어', '환승객', '막차', '지연열차', '빈자리',
  '끼임방지', '안전요원', '음소거', '졸음승객', '만원열차', '임산부석',
  '노선도', '출구번호', '환기구', '철도원'
];
