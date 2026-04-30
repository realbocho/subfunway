import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Room, Player, GameSession, ChatMessage, GameMode } from '@/types';

interface GameStore {
  // Player state
  playerId: string | null;
  fingerprint: string | null;
  nickname: string | null;
  roomId: string | null;
  
  // Room/game state
  room: Room | null;
  players: Player[];
  currentSession: GameSession | null;
  chatMessages: ChatMessage[];
  
  // UI state
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Chat cooldown
  lastMessageTime: number;
  
  // Actions
  setPlayer: (id: string, nickname: string, fingerprint: string) => void;
  setRoom: (room: Room) => void;
  setRoomId: (id: string) => void;
  setPlayers: (players: Player[]) => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  setSession: (session: GameSession | null) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatMessages: (msgs: ChatMessage[]) => void;
  setConnected: (v: boolean) => void;
  setLoading: (v: boolean) => void;
  setError: (err: string | null) => void;
  updateLastMessageTime: () => void;
  canSendMessage: () => boolean;
  reset: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      playerId: null,
      fingerprint: null,
      nickname: null,
      roomId: null,
      room: null,
      players: [],
      currentSession: null,
      chatMessages: [],
      isConnected: false,
      isLoading: false,
      error: null,
      lastMessageTime: 0,

      setPlayer: (id, nickname, fingerprint) => 
        set({ playerId: id, nickname, fingerprint }),
      
      setRoom: (room) => set({ room, roomId: room.id }),
      setRoomId: (id) => set({ roomId: id }),
      
      setPlayers: (players) => set({ players }),
      
      updatePlayer: (playerId, updates) =>
        set(state => ({
          players: state.players.map(p => 
            p.id === playerId ? { ...p, ...updates } : p
          )
        })),
      
      setSession: (session) => set({ currentSession: session }),
      
      addChatMessage: (msg) =>
        set(state => ({
          chatMessages: [...state.chatMessages.slice(-99), msg]
        })),
      
      setChatMessages: (msgs) => set({ chatMessages: msgs }),
      
      setConnected: (v) => set({ isConnected: v }),
      setLoading: (v) => set({ isLoading: v }),
      setError: (err) => set({ error: err }),
      
      updateLastMessageTime: () => set({ lastMessageTime: Date.now() }),
      
      canSendMessage: () => {
        const { lastMessageTime } = get();
        return Date.now() - lastMessageTime >= 2000;
      },
      
      reset: () => set({
        playerId: null,
        fingerprint: null,
        nickname: null,
        roomId: null,
        room: null,
        players: [],
        currentSession: null,
        chatMessages: [],
        isConnected: false,
        isLoading: false,
        error: null,
        lastMessageTime: 0,
      }),
    }),
    {
      name: 'subway-connect-store',
      partialize: (state) => ({
        playerId: state.playerId,
        fingerprint: state.fingerprint,
        nickname: state.nickname,
        roomId: state.roomId,
      }),
    }
  )
);
