'use client';

import { motion } from 'framer-motion';

interface GameHeaderProps {
  trainNumber: string;
  connectedCount: number;
  onLeave: () => void;
  rightContent?: React.ReactNode;
}

export function GameHeader({ trainNumber, connectedCount, onLeave, rightContent }: GameHeaderProps) {
  return (
    <div className="glass-panel border-b border-subway-border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onLeave}
          className="text-subway-muted hover:text-subway-text text-sm transition-colors active:scale-95"
        >
          🚪
        </button>
        <div className="h-4 w-px bg-subway-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-subway-yellow font-mono font-bold text-sm">{trainNumber}</span>
          <span className="text-subway-muted text-xs">호 열차</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {rightContent}
        <div className="flex items-center gap-1.5">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-green-400"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-xs text-subway-muted font-mono">{connectedCount}</span>
        </div>
      </div>
    </div>
  );
}
