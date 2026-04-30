# 🚇 서브웨이 커넥트 (Subway Connect)

> 지루한 이동 시간을 즐거운 연결로. 지하철 칸 단위 실시간 게임 플랫폼.

## 🛠 기술 스택

| Layer | Tech |
|---|---|
| **Frontend** | Next.js 14 (App Router) + TypeScript |
| **Styling** | Tailwind CSS + Framer Motion |
| **Backend** | Next.js API Routes (Serverless) |
| **Database** | Supabase (PostgreSQL) |
| **Realtime** | Supabase Realtime (WebSocket) |
| **Deployment** | Vercel (ICN1 - 서울 리전) |

---

## 🚀 로컬 개발 환경 설정

### 1. 레포지토리 클론 & 의존성 설치
```bash
git clone https://github.com/your-username/subway-connect.git
cd subway-connect
npm install
```

### 2. Supabase 프로젝트 생성
1. [supabase.com](https://supabase.com) → New Project
2. 리전: **Northeast Asia (Seoul)**
3. 프로젝트 생성 후 `Settings → API`에서 키 복사

### 3. 환경 변수 설정
```bash
cp .env.local.example .env.local
```

`.env.local` 파일 수정:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. 데이터베이스 스키마 적용
Supabase Dashboard → **SQL Editor** 에서 아래 파일 내용을 붙여넣고 실행:
```
supabase/migrations/001_initial_schema.sql
```

### 5. Supabase Realtime 활성화
Dashboard → **Database → Replication** →
- `rooms`, `players`, `game_sessions`, `game_moves`, `chat_messages`, `votes` 테이블 모두 **Source** 활성화

### 6. 개발 서버 실행
```bash
npm run dev
```

---

## 🌐 Vercel 배포

### 방법 1: GitHub 연동 (권장)
1. GitHub에 레포 push
2. [vercel.com](https://vercel.com) → **Import Project**
3. 환경 변수 4개 추가 (`.env.local` 내용 동일)
4. **Deploy** → 자동 배포

### 방법 2: Vercel CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```

### 환경 변수 (Vercel Dashboard)
```
NEXT_PUBLIC_SUPABASE_URL      = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY     = eyJhbGci...
NEXT_PUBLIC_APP_URL           = https://your-app.vercel.app
```

---

## 📁 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                    # 홈 (열차 번호 입력)
│   ├── lobby/[trainNumber]/        # 대기실 로비
│   ├── game/[trainNumber]/         # 게임 화면 (라우터)
│   └── api/
│       ├── rooms/                  # 방 생성/입장
│       ├── games/                  # 게임 시작/액션
│       ├── games/skip/             # 턴 스킵
│       ├── chat/                   # 채팅 전송
│       ├── reports/                # 신고
│       └── players/disconnect/     # 연결 해제
├── components/
│   ├── game/
│   │   ├── OmokGame.tsx            # 오목 게임 UI
│   │   ├── OmokBoard.tsx           # 오목판 컴포넌트
│   │   └── MafiaGame.tsx           # 마피아 게임 UI
│   ├── lobby/
│   │   ├── ChatBox.tsx             # 채팅창
│   │   └── PlayerList.tsx          # 플레이어 목록
│   └── ui/
│       ├── GameHeader.tsx          # 공통 헤더
│       ├── TimerRing.tsx           # 타이머 링 UI
│       └── Toast.tsx               # 토스트 알림
├── hooks/
│   ├── useOmokTimer.ts             # 오목 자동 스킵 타이머
│   ├── useRealtime.ts              # Supabase 실시간 구독
│   └── useHeartbeat.ts             # 연결 상태 유지
├── lib/
│   ├── supabase.ts                 # Supabase 클라이언트
│   └── utils.ts                   # 유틸 함수 (닉네임, 핑거프린트 등)
├── store/
│   └── gameStore.ts                # Zustand 전역 상태
└── types/
    └── index.ts                    # TypeScript 타입 정의
```

---

## 🎮 게임 기능

### 공통
- ✅ 4자리 열차 번호 기반 자동 방 매칭
- ✅ 역이름+사물 익명 닉네임 자동 생성
- ✅ 3-Strike 신고 시스템 (30분 이용 제한)
- ✅ 욕설 필터링 + 메시지 쿨타임 2초
- ✅ 기기 핑거프린트 기반 재입장
- ✅ 실시간 채팅

### 릴레이 팀 오목
- ✅ 홀수/짝수 팀 자동 배정
- ✅ 10초 제한 시간 + 자동 턴 스킵
- ✅ 실시간 오목판 동기화
- ✅ 5목 승리 감지 + 승리 라인 하이라이트
- ✅ 도중 입장/퇴장 지원

### 쾌속 지하철 마피아
- ✅ 소매치기/보안관/환승객/시민 역할 배정
- ✅ 낮→투표→밤 페이즈 전환
- ✅ 투표 화살표 로그 시각화
- ✅ 하차 유언 기능
- ✅ 역할 공개 (게임 종료 시)
- ✅ 보안관 조사 결과 비공개 알림

---

## 🔒 보안

- Row Level Security (RLS) 모든 테이블 적용
- 서버 API에서 권한 검증
- 메시지 길이 제한 (200자)
- DB 트리거 기반 신고/밴 처리
- Service Role Key는 서버에서만 사용

---

## 📱 PWA

`/public/manifest.json` 설정 완료.
모바일에서 "홈 화면에 추가" 시 앱처럼 실행됩니다.

아이콘 파일 추가 필요:
- `/public/icon-192.png` (192×192)
- `/public/icon-512.png` (512×512)
