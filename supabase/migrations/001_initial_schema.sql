-- ============================================
-- Subway Connect - Database Schema
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================
-- ROOMS (열차 번호 기반 다이나믹 룸)
-- ============================================
create table if not exists public.rooms (
  id uuid primary key default uuid_generate_v4(),
  train_number varchar(10) not null unique,
  status varchar(20) not null default 'waiting' check (status in ('waiting', 'playing', 'ended')),
  game_mode varchar(20) check (game_mode in ('omok', 'mafia', null)),
  created_at timestamptz default now(),
  last_activity timestamptz default now(),
  expires_at timestamptz default (now() + interval '3 hours')
);

create index idx_rooms_train_number on public.rooms(train_number);
create index idx_rooms_status on public.rooms(status);

-- Auto-cleanup expired rooms
create or replace function cleanup_expired_rooms()
returns void as $$
begin
  delete from public.rooms where expires_at < now();
end;
$$ language plpgsql;

-- ============================================
-- PLAYERS (익명 플레이어)
-- ============================================
create table if not exists public.players (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade,
  fingerprint varchar(64) not null,
  nickname varchar(50) not null,
  team smallint check (team in (1, 2, null)),
  role varchar(20) check (role in ('pickpocket', 'sheriff', 'transfer', 'citizen', null)),
  is_alive boolean default true,
  is_connected boolean default true,
  strike_count smallint default 0,
  banned_until timestamptz,
  joined_at timestamptz default now(),
  last_seen timestamptz default now()
);

create index idx_players_room_id on public.players(room_id);
create index idx_players_fingerprint on public.players(fingerprint);

-- ============================================
-- GAME SESSIONS
-- ============================================
create table if not exists public.game_sessions (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade,
  game_mode varchar(20) not null check (game_mode in ('omok', 'mafia')),
  status varchar(20) default 'playing' check (status in ('playing', 'ended')),
  winner_team smallint check (winner_team in (1, 2, null)),
  winner_role varchar(20),
  round_number smallint default 1,
  phase varchar(20) default 'day' check (phase in ('day', 'night', 'vote', 'result')),
  current_turn_player_id uuid references public.players(id),
  board_state jsonb default '{}',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  ended_at timestamptz
);

create index idx_game_sessions_room_id on public.game_sessions(room_id);

-- ============================================
-- GAME MOVES (오목 수 기록 / 마피아 액션)
-- ============================================
create table if not exists public.game_moves (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references public.game_sessions(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  move_type varchar(30) not null,
  payload jsonb not null default '{}',
  created_at timestamptz default now()
);

create index idx_game_moves_session_id on public.game_moves(session_id);
create index idx_game_moves_created_at on public.game_moves(created_at);

-- ============================================
-- CHAT MESSAGES
-- ============================================
create table if not exists public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade,
  session_id uuid references public.game_sessions(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  nickname varchar(50) not null,
  content text not null,
  is_system boolean default false,
  is_last_words boolean default false,
  created_at timestamptz default now()
);

create index idx_chat_messages_room_id on public.chat_messages(room_id);
create index idx_chat_messages_created_at on public.chat_messages(created_at);

-- ============================================
-- REPORTS (신고 시스템)
-- ============================================
create table if not exists public.reports (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references public.game_sessions(id) on delete cascade,
  reporter_player_id uuid references public.players(id) on delete set null,
  reported_player_id uuid references public.players(id) on delete cascade,
  reason varchar(100),
  created_at timestamptz default now(),
  unique(session_id, reporter_player_id, reported_player_id)
);

-- ============================================
-- VOTES (마피아 투표)
-- ============================================
create table if not exists public.votes (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references public.game_sessions(id) on delete cascade,
  round_number smallint not null,
  voter_id uuid references public.players(id) on delete cascade,
  target_id uuid references public.players(id) on delete cascade,
  created_at timestamptz default now(),
  unique(session_id, round_number, voter_id)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_moves enable row level security;
alter table public.chat_messages enable row level security;
alter table public.reports enable row level security;
alter table public.votes enable row level security;

-- Public read access for all tables (anonymous access)
create policy "Public read rooms" on public.rooms for select using (true);
create policy "Public insert rooms" on public.rooms for insert with check (true);
create policy "Public update rooms" on public.rooms for update using (true);

create policy "Public read players" on public.players for select using (true);
create policy "Public insert players" on public.players for insert with check (true);
create policy "Public update players" on public.players for update using (true);
create policy "Public delete players" on public.players for delete using (true);

create policy "Public read sessions" on public.game_sessions for select using (true);
create policy "Public insert sessions" on public.game_sessions for insert with check (true);
create policy "Public update sessions" on public.game_sessions for update using (true);

create policy "Public read moves" on public.game_moves for select using (true);
create policy "Public insert moves" on public.game_moves for insert with check (true);

create policy "Public read chat" on public.chat_messages for select using (true);
create policy "Public insert chat" on public.chat_messages for insert with check (true);

create policy "Public read reports" on public.reports for select using (true);
create policy "Public insert reports" on public.reports for insert with check (true);

create policy "Public read votes" on public.votes for select using (true);
create policy "Public insert votes" on public.votes for insert with check (true);
create policy "Public update votes" on public.votes for update using (true);

-- ============================================
-- REALTIME
-- ============================================
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.game_sessions;
alter publication supabase_realtime add table public.game_moves;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.votes;

-- ============================================
-- STRIKE COUNT TRIGGER
-- ============================================
create or replace function check_strikes_and_ban()
returns trigger as $$
declare
  strike_count int;
begin
  select count(*) into strike_count
  from public.reports
  where reported_player_id = new.reported_player_id
    and session_id = new.session_id;

  if strike_count >= 3 then
    update public.players
    set banned_until = now() + interval '30 minutes',
        strike_count = strike_count
    where id = new.reported_player_id;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger on_report_insert
  after insert on public.reports
  for each row execute function check_strikes_and_ban();

-- ============================================
-- OMOK WIN CHECK FUNCTION
-- ============================================
create or replace function check_omok_winner(board jsonb, last_row int, last_col int, team int)
returns boolean as $$
declare
  directions int[][] := array[array[0,1], array[1,0], array[1,1], array[1,-1]];
  d int[];
  count int;
  r int;
  c int;
  cell text;
  team_char text;
begin
  team_char := team::text;
  
  foreach d slice 1 in array directions loop
    count := 1;
    
    -- Forward
    r := last_row + d[1];
    c := last_col + d[2];
    while r >= 0 and r < 15 and c >= 0 and c < 15 loop
      cell := board->>(r*15+c)::text;
      exit when cell is null or cell != team_char;
      count := count + 1;
      r := r + d[1];
      c := c + d[2];
    end loop;
    
    -- Backward
    r := last_row - d[1];
    c := last_col - d[2];
    while r >= 0 and r < 15 and c >= 0 and c < 15 loop
      cell := board->>(r*15+c)::text;
      exit when cell is null or cell != team_char;
      count := count + 1;
      r := r - d[1];
      c := c - d[2];
    end loop;
    
    if count >= 5 then
      return true;
    end if;
  end loop;
  
  return false;
end;
$$ language plpgsql;
