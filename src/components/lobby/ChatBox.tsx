'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';

interface ChatBoxProps {
  roomId: string;
  playerId: string;
  isLastWords?: boolean;
  onLastWords?: (message: string) => void;
}

export function ChatBox({ roomId, playerId, isLastWords, onLastWords }: ChatBoxProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { chatMessages, nickname, canSendMessage, updateLastMessageTime } = useGameStore();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendMessage = async () => {
    if (!input.trim() || isSending || !playerId) return;
    
    if (!canSendMessage()) {
      return; // Cooldown active
    }

    const content = input.trim();
    setInput('');
    setIsSending(true);
    updateLastMessageTime();

    try {
      if (isLastWords && onLastWords) {
        onLastWords(content);
        return;
      }

      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerId, content, isLastWords: false }),
      });
    } catch {
      // Silent fail
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col border-t border-subway-border" style={{ height: '220px' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <AnimatePresence initial={false}>
          {chatMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
            >
              {msg.is_system ? (
                <div className="system-message py-0.5">
                  {msg.is_last_words ? (
                    <span className="text-subway-orange italic">
                      📢 {msg.nickname}: "{msg.content}"
                    </span>
                  ) : (
                    <span className="text-subway-muted">{msg.content}</span>
                  )}
                </div>
              ) : (
                <div className={`flex items-start gap-2 ${msg.player_id === playerId ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 text-xs font-medium mt-1 ${
                    msg.player_id === playerId ? 'text-subway-yellow' : 'text-subway-muted'
                  }`}>
                    {msg.player_id === playerId ? '나' : msg.nickname.split(' ')[1] || '?'}
                  </div>
                  <div
                    className={`chat-bubble text-sm ${
                      msg.player_id === playerId
                        ? 'bg-subway-yellow/20 text-subway-yellow border border-subway-yellow/30 rounded-br-sm'
                        : 'bg-subway-panel text-subway-text border border-subway-border rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 px-3 py-2 border-t border-subway-border/50">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 200))}
          onKeyDown={handleKeyDown}
          placeholder={isLastWords ? "하차 한마디..." : "메시지 입력..."}
          className="flex-1 bg-subway-darker border border-subway-border rounded-xl px-3 py-2 text-sm text-subway-text placeholder-subway-muted focus:outline-none focus:border-subway-yellow/50 transition-colors"
          disabled={isSending}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isSending}
          className="subway-btn bg-subway-yellow/20 text-subway-yellow border border-subway-yellow/30 py-2 px-3 text-sm disabled:opacity-30"
        >
          {isLastWords ? '남기기' : '→'}
        </button>
      </div>
    </div>
  );
}
