'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage } from '@/types';
import { getSocket } from '@/lib/socket/socketClient';

const EMOJIS = ['😀','😂','🤩','😍','🥳','😎','🤔','😮','😤','😅','👍','👎','🙌','👏','🤝','❤️','🔥','⚡','🃏','🎉','💯','🎯','🏆','💪','🤫'];

const PLAYER_COLORS = [
  'text-sky-400','text-emerald-400','text-orange-400',
  'text-pink-400','text-violet-400','text-yellow-400',
  'text-cyan-400','text-red-400','text-teal-400','text-lime-400',
];

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xff;
  return PLAYER_COLORS[h % PLAYER_COLORS.length];
}

interface ChatPanelProps {
  roomId: string;
  myPlayerId: string;
  myPlayerName: string;
  onUnreadChange?: (increment: number) => void;
}

export default function ChatPanel({ roomId, myPlayerId, onUnreadChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
      onUnreadChange?.(1);
    };
    socket.on('chat:receive', handler);
    return () => { socket.off('chat:receive', handler); };
  }, [onUnreadChange]);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, [messages]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    getSocket()?.emit('chat:send', { roomId, text });
    setInput('');
    setShowEmojis(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-slate-500 text-xs text-center mt-10">No messages yet. Say hello! 👋</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.playerId === myPlayerId ? 'items-end' : 'items-start'}`}>
            {msg.playerId !== myPlayerId && (
              <span className={`text-[10px] font-semibold mb-0.5 ${hashColor(msg.playerName)}`}>{msg.playerName}</span>
            )}
            <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-sm break-words leading-snug ${
              msg.playerId === myPlayerId
                ? 'bg-sky-600 text-white rounded-tr-sm'
                : 'bg-slate-700 text-slate-200 rounded-tl-sm'
            }`}>
              {msg.text}
            </div>
            <span className="text-[9px] text-slate-500 mt-0.5">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Emoji picker */}
      <AnimatePresence>
        {showEmojis && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-700 bg-slate-800 overflow-hidden shrink-0"
          >
            <div className="flex flex-wrap gap-1 p-2">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setInput(i => i + e)}
                  className="text-xl hover:bg-slate-700 rounded p-0.5 transition-colors leading-none">{e}</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="border-t border-slate-700 p-2 flex items-center gap-1.5 shrink-0 bg-slate-800/80">
        <button
          onClick={() => setShowEmojis(v => !v)}
          className={`text-xl shrink-0 transition-colors ${showEmojis ? 'text-yellow-400' : 'text-slate-400 hover:text-slate-200'}`}
        >😊</button>
        <input
          className="flex-1 bg-slate-700 text-slate-200 text-sm rounded-lg px-2.5 py-1.5 outline-none border border-slate-600 focus:border-sky-500 placeholder-slate-500 min-w-0"
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          maxLength={200}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs px-2.5 py-1.5 rounded-lg font-semibold shrink-0 transition-colors"
        >Send</button>
      </div>
    </div>
  );
}
