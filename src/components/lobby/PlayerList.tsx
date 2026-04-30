'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Player } from '@/types';

interface PlayerListProps {
  players: Player[];
  myPlayerId: string;
  showTeams?: boolean;
  showRoles?: boolean;
  showAlive?: boolean;
}

export function PlayerList({ players, myPlayerId, showTeams, showRoles, showAlive }: PlayerListProps) {
  const connected = players.filter(p => p.is_connected);
  
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-subway-muted uppercase tracking-widest">탑승객</span>
        <span className="text-xs font-mono text-subway-yellow">{connected.length}</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <AnimatePresence>
          {players.map((player) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className={`relative px-3 py-1.5 rounded-full text-xs border flex items-center gap-1.5 transition-all ${
                !player.is_connected
                  ? 'opacity-40 border-subway-border bg-transparent'
                  : player.id === myPlayerId
                  ? 'border-subway-yellow bg-subway-yellow/10 text-subway-yellow'
                  : showTeams && player.team
                  ? player.team === 1
                    ? 'border-blue-600 bg-blue-950/30 text-blue-300'
                    : 'border-red-600 bg-red-950/30 text-red-300'
                  : 'border-subway-border bg-subway-panel text-subway-text'
              } ${showAlive && !player.is_alive ? 'line-through opacity-50' : ''}`}
            >
              {/* Online indicator */}
              {player.is_connected && (
                <div className={`w-1.5 h-1.5 rounded-full ${
                  player.id === myPlayerId ? 'bg-subway-yellow' :
                  showTeams && player.team === 1 ? 'bg-blue-400' :
                  showTeams && player.team === 2 ? 'bg-red-400' :
                  'bg-green-400'
                }`} />
              )}
              
              <span className="font-medium">
                {player.nickname.split(' ').slice(1).join(' ') || player.nickname}
              </span>

              {showTeams && player.team && (
                <span className={`text-xs ${player.team === 1 ? 'text-blue-400' : 'text-red-400'}`}>
                  {player.team === 1 ? '청' : '홍'}
                </span>
              )}

              {showAlive && !player.is_alive && (
                <span className="text-xs">💀</span>
              )}

              {player.id === myPlayerId && (
                <span className="text-subway-yellow/60 text-xs">나</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
