'use client';

import { motion } from 'framer-motion';

interface OmokBoardProps {
  cells: (0 | 1 | 2)[];
  lastMove: { row: number; col: number } | null;
  winLine: number[];
  myTeam: 1 | 2 | null;
  isMyTurn: boolean;
  isGameOver: boolean;
  onCellClick: (row: number, col: number) => void;
}

const BOARD_SIZE = 15;

export function OmokBoard({
  cells,
  lastMove,
  winLine,
  myTeam,
  isMyTurn,
  isGameOver,
  onCellClick,
}: OmokBoardProps) {
  // Determine star points (천원점, 화점)
  const starPoints = new Set([
    3 * BOARD_SIZE + 3, 3 * BOARD_SIZE + 11,
    7 * BOARD_SIZE + 7,
    11 * BOARD_SIZE + 3, 11 * BOARD_SIZE + 11,
  ]);

  return (
    <div
      className="relative w-full"
      style={{ aspectRatio: '1', maxHeight: '70vw', maxWidth: '70vw', margin: '0 auto' }}
    >
      {/* Board background */}
      <div className="absolute inset-0 rounded-xl bg-[#1a1208] border border-[#2a1f0a] overflow-hidden">
        {/* Wood grain effect */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(255,200,100,0.05) 10px, rgba(255,200,100,0.05) 11px)',
          }}
        />
      </div>

      {/* Grid lines */}
      <svg
        className="absolute inset-2"
        viewBox={`0 0 ${(BOARD_SIZE - 1) * 10} ${(BOARD_SIZE - 1) * 10}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Vertical lines */}
        {Array.from({ length: BOARD_SIZE }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * 10} y1={0}
            x2={i * 10} y2={(BOARD_SIZE - 1) * 10}
            stroke="rgba(255,200,100,0.15)"
            strokeWidth="0.5"
          />
        ))}
        {/* Horizontal lines */}
        {Array.from({ length: BOARD_SIZE }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0} y1={i * 10}
            x2={(BOARD_SIZE - 1) * 10} y2={i * 10}
            stroke="rgba(255,200,100,0.15)"
            strokeWidth="0.5"
          />
        ))}
        {/* Star points */}
        {Array.from(starPoints).map(idx => {
          const r = Math.floor(idx / BOARD_SIZE);
          const c = idx % BOARD_SIZE;
          return (
            <circle
              key={`star${idx}`}
              cx={c * 10} cy={r * 10}
              r={1}
              fill="rgba(255,200,100,0.4)"
            />
          );
        })}
      </svg>

      {/* Clickable cells grid */}
      <div
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
      >
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => {
          const row = Math.floor(i / BOARD_SIZE);
          const col = i % BOARD_SIZE;
          const cell = cells[i];
          const isLast = lastMove?.row === row && lastMove?.col === col;
          const isWin = winLine.includes(i);
          const canClick = isMyTurn && !isGameOver && cell === 0;

          return (
            <div
              key={i}
              className={`relative flex items-center justify-center ${canClick ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => canClick && onCellClick(row, col)}
            >
              {/* Win highlight */}
              {isWin && (
                <div className="absolute inset-0 bg-subway-yellow/10 rounded" />
              )}

              {/* Stone */}
              {cell !== 0 && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 700, damping: 25 }}
                  className={`relative rounded-full z-10 ${
                    cell === 1
                      ? 'shadow-[0_2px_8px_rgba(0,52,153,0.6)]'
                      : 'shadow-[0_2px_8px_rgba(232,0,45,0.6)]'
                  } ${isWin ? 'ring-2 ring-subway-yellow ring-offset-1 ring-offset-transparent' : ''}`}
                  style={{
                    width: '72%',
                    height: '72%',
                    background: cell === 1
                      ? 'radial-gradient(circle at 35% 35%, #6699ff, #001f99)'
                      : 'radial-gradient(circle at 35% 35%, #ff6666, #990011)',
                  }}
                >
                  {/* Shine */}
                  <div
                    className="absolute rounded-full bg-white/30"
                    style={{ width: '30%', height: '25%', top: '15%', left: '20%' }}
                  />
                  {/* Last move indicator */}
                  {isLast && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                    </div>
                  )}
                </motion.div>
              )}

              {/* Hover ghost stone */}
              {canClick && (
                <div
                  className={`absolute rounded-full z-10 opacity-0 hover:opacity-40 transition-opacity duration-100 pointer-events-none`}
                  style={{
                    width: '72%',
                    height: '72%',
                    background: myTeam === 1
                      ? 'radial-gradient(circle at 35% 35%, #6699ff, #001f99)'
                      : 'radial-gradient(circle at 35% 35%, #ff6666, #990011)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
