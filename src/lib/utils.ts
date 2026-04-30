import { STATION_NAMES, NICKNAME_SUFFIXES } from '@/types';

export function generateNickname(): string {
  const station = STATION_NAMES[Math.floor(Math.random() * STATION_NAMES.length)];
  const suffix = NICKNAME_SUFFIXES[Math.floor(Math.random() * NICKNAME_SUFFIXES.length)];
  return `${station} ${suffix}`;
}

export function generateTrainDisplayName(trainNumber: string): string {
  return `${trainNumber}호 열차`;
}

// Simple profanity filter (Korean bad words)
const BLOCKED_WORDS = ['시발', '씨발', '개새끼', '병신', '지랄', '닥쳐', '꺼져', '죽어'];

export function filterMessage(text: string): { clean: string; blocked: boolean } {
  let clean = text;
  let blocked = false;
  
  for (const word of BLOCKED_WORDS) {
    if (clean.includes(word)) {
      clean = clean.replaceAll(word, '*'.repeat(word.length));
      blocked = true;
    }
  }
  
  return { clean, blocked };
}

// Get or create browser fingerprint
export async function getFingerprint(): Promise<string> {
  try {
    // Check localStorage first
    const stored = localStorage.getItem('subway_fp');
    if (stored) return stored;

    // Generate a simple fingerprint from browser properties
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('subway-connect', 2, 2);
    }
    
    const nav = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
    ].join('|');
    
    // Simple hash
    let hash = 0;
    for (let i = 0; i < nav.length; i++) {
      const char = nav.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    const fp = Math.abs(hash).toString(36) + Date.now().toString(36);
    localStorage.setItem('subway_fp', fp);
    return fp;
  } catch {
    return 'fp_' + Math.random().toString(36).substring(2);
  }
}

// Store/retrieve local player state
export function saveLocalPlayer(data: {
  playerId: string;
  roomId: string;
  nickname: string;
  fingerprint: string;
}) {
  localStorage.setItem('subway_player', JSON.stringify(data));
}

export function getLocalPlayer() {
  try {
    const stored = localStorage.getItem('subway_player');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function clearLocalPlayer() {
  localStorage.removeItem('subway_player');
}

// Format time
export function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return '0';
  return seconds.toString();
}

// Team colors
export const TEAM_COLORS = {
  1: { bg: 'bg-subway-blue', text: 'text-blue-400', border: 'border-blue-500', hex: '#003499' },
  2: { bg: 'bg-subway-red', text: 'text-red-400', border: 'border-red-500', hex: '#E8002D' },
};

// Role labels
export const ROLE_LABELS: Record<string, { name: string; emoji: string; description: string }> = {
  pickpocket: { name: '소매치기', emoji: '🕵️', description: '매 밤 한 명을 강제 하차시킵니다.' },
  sheriff: { name: '보안관', emoji: '👮', description: '매 밤 한 명의 정체를 조사합니다.' },
  transfer: { name: '환승객', emoji: '🎭', description: '투표로 하차당하면 승리합니다.' },
  citizen: { name: '시민', emoji: '🧑', description: '소매치기를 찾아 하차시키세요.' },
};

// Sound effects (Web Audio API)
export function playTick() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch {}
}

export function playPlaceStone() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
}

export function playAlert() {
  try {
    const ctx = new AudioContext();
    [440, 550, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  } catch {}
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
