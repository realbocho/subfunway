'use client';

import { motion } from 'framer-motion';

interface TimerRingProps {
  seconds: number;
  maxSeconds: number;
  size?: number;
  urgent?: boolean;
}

export function TimerRing({ seconds, maxSeconds, size = 44, urgent }: TimerRingProps) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds / maxSeconds;
  const strokeDashoffset = circumference * (1 - progress);

  const color = urgent || seconds <= 3 ? '#E8002D' :
    seconds <= 6 ? '#FF6B35' : '#F5C518';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={4}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transition={{ duration: 0.5, ease: 'linear' }}
        />
      </svg>
      <span
        className="absolute font-mono font-bold tabular-nums text-sm"
        style={{ color }}
      >
        {seconds}
      </span>
    </div>
  );
}
