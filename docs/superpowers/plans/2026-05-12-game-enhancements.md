# Game Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix partner reveal logic, chat panel layout, table UI to match reference image, and add an animated SVG male dealer figure.

**Architecture:** Five independent changes: (1) a one-line bug fix in the game engine, (2) a new standalone DealerFigure SVG component, (3) restructuring ChatPanel to remove fixed positioning, (4) restructuring GameTable to flex-row with side-by-side chat + updated 3D table styles + DealerFigure integration, (5) verifying score display logic.

**Tech Stack:** Next.js 15, TypeScript, TailwindCSS, Framer Motion, Socket.IO, Zustand

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/game-engine/roundEngine.ts` | Modify line ~254 | Fix partner reveal condition |
| `components/game/DealerFigure.tsx` | Create | SVG animated male dealer |
| `components/game/ChatPanel.tsx` | Modify | Remove `fixed` positioning, become `flex flex-col h-full` |
| `components/game/GameTable.tsx` | Modify | Flex-row layout, 3D table styles, DealerFigure integration |

---

## Task 1: Fix Partner Reveal Bug (roundEngine.ts)

**Files:**
- Modify: `lib/game-engine/roundEngine.ts` (line ~254)

**Root cause:** `processCardPlay` checks `!updatedPartnerIds.includes(playerId)` to gate the reveal. But `partnerIds` is fully populated in `afterPartnersSelected` (server knows all partners from the start). So by the time a partner plays their called card, they are already in `partnerIds` — the condition is `false` and reveal never fires.

**Fix:** The gate should check `revealedPartnerIds` (the public, revealed list), not `partnerIds` (the secret server list).

- [ ] **Step 1: Apply the fix**

In `lib/game-engine/roundEngine.ts`, find this block (around line 251):

```typescript
  if (
    isCalledCard &&
    playerId !== gameState.bidWinnerId &&
    !updatedPartnerIds.includes(playerId)
  ) {
```

Change to:

```typescript
  if (
    isCalledCard &&
    playerId !== gameState.bidWinnerId &&
    !updatedRevealedPartnerIds.includes(playerId)
  ) {
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd D:\3ofspades && npx tsc --noEmit
```

Expected: `exit code 0`, no errors.

- [ ] **Step 3: Commit**

```bash
cd D:\3ofspades && git add lib/game-engine/roundEngine.ts && git commit -m "fix: partner reveal fires on revealedPartnerIds check, not partnerIds

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: Create DealerFigure Component

**Files:**
- Create: `components/game/DealerFigure.tsx`

The dealer is a standalone SVG male character (bow tie, visor, vest) with Framer Motion animations. It takes `{ isDealing: boolean }` and is positioned separately from all player seats.

- [ ] **Step 1: Create the file**

```typescript
// components/game/DealerFigure.tsx
'use client';
import { motion } from 'framer-motion';

interface DealerFigureProps {
  isDealing: boolean;
}

export default function DealerFigure({ isDealing }: DealerFigureProps) {
  return (
    <motion.div
      className="flex flex-col items-center select-none pointer-events-none"
      animate={{ y: isDealing ? [0, -4, 0] : [0, -2, 0] }}
      transition={{ repeat: Infinity, duration: isDealing ? 0.6 : 3, ease: 'easeInOut' }}
    >
      {/* Dealer label */}
      <div
        className="mb-1 text-[9px] font-black tracking-widest uppercase"
        style={{ color: '#d4a017', textShadow: '0 0 6px rgba(212,160,23,0.5)' }}
      >
        Dealer
      </div>

      {/* SVG Character */}
      <svg
        width="52"
        height="72"
        viewBox="0 0 52 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Head */}
        <circle cx="26" cy="14" r="11" fill="#f5cba7" stroke="#d4a574" strokeWidth="1" />

        {/* Eyes */}
        <circle cx="22" cy="13" r="1.5" fill="#2c1810" />
        <circle cx="30" cy="13" r="1.5" fill="#2c1810" />

        {/* Smile */}
        <path d="M22 17 Q26 20 30 17" stroke="#2c1810" strokeWidth="1" strokeLinecap="round" fill="none" />

        {/* Dealer visor */}
        <path d="M15 11 Q26 6 37 11" fill="#1a6b2a" stroke="#0f4a1e" strokeWidth="1" />
        <path d="M15 11 Q26 9 37 11 L38 13 Q26 11 14 13 Z" fill="#d4a017" />

        {/* Shirt collar */}
        <path d="M21 24 L26 28 L31 24 L28 25 L26 30 L24 25 Z" fill="white" stroke="#ccc" strokeWidth="0.5" />

        {/* Bow tie */}
        <path d="M22 25 L25 27 L22 29 Z" fill="#1a1a2e" stroke="#333" strokeWidth="0.5" />
        <path d="M30 25 L27 27 L30 29 Z" fill="#1a1a2e" stroke="#333" strokeWidth="0.5" />
        <circle cx="26" cy="27" r="1.5" fill="#1a1a2e" />

        {/* Vest / body */}
        <path d="M16 24 Q14 36 15 48 L37 48 Q38 36 36 24 Q31 22 26 22 Q21 22 16 24 Z" fill="#1a1a2e" />
        {/* Vest lapels */}
        <path d="M21 24 L20 32 L26 30 Z" fill="#2a2a4e" />
        <path d="M31 24 L32 32 L26 30 Z" fill="#2a2a4e" />
        {/* White shirt center */}
        <path d="M24 30 L26 48 L28 30 Z" fill="white" opacity="0.6" />

        {/* Left arm (static) */}
        <path d="M16 26 Q10 32 11 40" stroke="#1a1a2e" strokeWidth="7" strokeLinecap="round" />
        <ellipse cx="11" cy="41" rx="4" ry="3" fill="#f5cba7" />

        {/* Right arm — animated during dealing */}
        <motion.g
          animate={isDealing
            ? { rotate: [-10, -55, -10] }
            : { rotate: [0, 5, 0] }
          }
          transition={isDealing
            ? { repeat: Infinity, duration: 0.7, ease: 'easeInOut' }
            : { repeat: Infinity, duration: 3, ease: 'easeInOut' }
          }
          style={{ transformOrigin: '36px 26px' }}
        >
          <path d="M36 26 Q42 32 41 40" stroke="#1a1a2e" strokeWidth="7" strokeLinecap="round" />
          <ellipse cx="41" cy="41" rx="4" ry="3" fill="#f5cba7" />
          {isDealing && (
            <motion.rect
              x="39" y="38" width="10" height="14" rx="1"
              fill="white" stroke="#1e3a8a" strokeWidth="1"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ repeat: Infinity, duration: 0.7 }}
            />
          )}
        </motion.g>

        {/* Legs */}
        <path d="M20 48 Q19 60 20 68" stroke="#1a1a2e" strokeWidth="6" strokeLinecap="round" />
        <path d="M32 48 Q33 60 32 68" stroke="#1a1a2e" strokeWidth="6" strokeLinecap="round" />
        {/* Shoes */}
        <ellipse cx="20" cy="68" rx="5" ry="3" fill="#111" />
        <ellipse cx="32" cy="68" rx="5" ry="3" fill="#111" />
      </svg>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd D:\3ofspades && npx tsc --noEmit
```

Expected: `exit code 0`.

- [ ] **Step 3: Commit**

```bash
cd D:\3ofspades && git add components/game/DealerFigure.tsx && git commit -m "feat: add animated SVG male dealer figure component

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: Fix ChatPanel — Remove Fixed Positioning

**Files:**
- Modify: `components/game/ChatPanel.tsx`

Replace the entire file content. The panel becomes a pure `flex flex-col h-full` container — no `fixed`, no `w-72`, no `isOpen`/`onClose` props. The parent `GameTable` owns open/close state entirely.

- [ ] **Step 1: Replace ChatPanel.tsx content**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd D:\3ofspades && npx tsc --noEmit
```

Expected errors at `GameTable.tsx` about removed props `isOpen`/`onClose` — these will be fixed in Task 4. If there are errors in `ChatPanel.tsx` itself, fix them now.

- [ ] **Step 3: Commit**

```bash
cd D:\3ofspades && git add components/game/ChatPanel.tsx && git commit -m "fix: chat panel uses flex layout, remove fixed positioning

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: Restructure GameTable — Flex-Row + Table Redesign + Dealer

**Files:**
- Modify: `components/game/GameTable.tsx`

Four changes: outer flex-row wrapper, updated table CSS, DealerFigure replacing DealerChip, ChatPanel prop fixes.

- [ ] **Step 1: Add imports**

Add after existing imports near top of file:

```typescript
import DealerFigure from './DealerFigure';
```

- [ ] **Step 2: Add unread state and handler**

After `const [chatOpen, setChatOpen] = useState(false);` add:

```typescript
const [unread, setUnread] = useState(0);
const handleUnread = useCallback(() => setUnread(n => n + 1), []);
useEffect(() => { if (chatOpen) setUnread(0); }, [chatOpen]);
```

- [ ] **Step 3: Replace outermost wrapper with flex-row**

Find and replace the outer `<div className="flex flex-col overflow-hidden select-none" style={{ height: '100dvh', background: ... }}>` opening tag. Wrap ALL existing content in a `flex-1 flex flex-col` inner div, then add the chat panel siblings:

```tsx
<div
  className="flex flex-row overflow-hidden select-none"
  style={{
    height: '100dvh',
    background: 'radial-gradient(ellipse 140% 100% at 50% 70%, #0f2a0f 0%, #050d05 50%, #000000 100%)',
  }}
>
  {/* ── Game section ── */}
  <div className="flex-1 flex flex-col overflow-hidden min-w-0">
    {/* ALL existing content: top bar, table area, card hand, overlays goes here unchanged */}
  </div>

  {/* ── Desktop chat panel ── */}
  <AnimatePresence>
    {chatOpen && !isMobile && (
      <motion.div
        key="chat-desktop"
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 280, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="shrink-0 flex flex-col border-l border-slate-700/60 overflow-hidden"
        style={{ width: 280 }}
      >
        <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 border-b border-slate-700 shrink-0">
          <span className="text-sm font-semibold text-slate-200">💬 Chat</span>
          <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-white text-lg leading-none">&times;</button>
        </div>
        <div className="flex-1 min-h-0">
          <ChatPanel
            roomId={gameState.roomId}
            myPlayerId={myPlayerId}
            myPlayerName={myPlayer?.name ?? ''}
            onUnreadChange={handleUnread}
          />
        </div>
      </motion.div>
    )}
  </AnimatePresence>

  {/* ── Mobile bottom drawer ── */}
  <AnimatePresence>
    {chatOpen && isMobile && (
      <>
        <motion.div
          key="chat-backdrop"
          className="fixed inset-0 bg-black/50 z-40"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setChatOpen(false)}
        />
        <motion.div
          key="chat-mobile"
          className="fixed bottom-0 inset-x-0 z-50 rounded-t-2xl overflow-hidden border-t border-slate-700 flex flex-col"
          style={{ height: '55vh' }}
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        >
          <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
            <span className="text-sm font-semibold text-slate-200">💬 Chat</span>
            <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-white text-lg leading-none">&times;</button>
          </div>
          <div className="flex-1 min-h-0">
            <ChatPanel
              roomId={gameState.roomId}
              myPlayerId={myPlayerId}
              myPlayerName={myPlayer?.name ?? ''}
              onUnreadChange={handleUnread}
            />
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
</div>
```

- [ ] **Step 4: Update chat button in top bar to show unread badge**

Find the chat button in the top bar and replace:

```tsx
<div className="relative shrink-0">
  <button
    onClick={() => setChatOpen((v) => !v)}
    className={`relative flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors ${
      chatOpen
        ? 'bg-sky-700/60 border-sky-600/50 text-sky-300'
        : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border-slate-700/50'
    }`}
  >
    💬 Chat
    {unread > 0 && !chatOpen && (
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
        {unread > 9 ? '9+' : unread}
      </span>
    )}
  </button>
</div>
```

(Remove the old `<ChatPanel ... isOpen={chatOpen} onClose={...} />` that was nested inside this div.)

- [ ] **Step 5: Update felt layers to match reference image**

Find the four felt/rim `<div>` elements inside the Casino Table `<motion.div>` and replace:

```tsx
{/* Wood rim */}
<div className="absolute inset-0 rounded-[50%]" style={{
  background: 'linear-gradient(160deg, #5a2d0c 0%, #2a1005 35%, #4a2208 65%, #1a0800 100%)',
  boxShadow: '0 0 100px rgba(0,0,0,0.98), 0 32px 64px rgba(0,0,0,0.9)',
}} />
{/* Gold bead rim — thicker and brighter */}
<div className="absolute inset-[4px] rounded-[50%]" style={{
  boxShadow: '0 0 0 4px rgba(212,160,23,0.85), 0 0 24px rgba(212,160,23,0.45), 0 0 48px rgba(212,160,23,0.18), inset 0 0 0 3px rgba(212,160,23,0.4)',
}} />
{/* Felt — brighter kelly green */}
<div className="absolute inset-[14px] rounded-[50%]" style={{
  background: 'radial-gradient(ellipse at 50% 38%, #20883e 0%, #186830 35%, #104c22 65%, #082e14 100%)',
  boxShadow: 'inset 0 20px 60px rgba(0,0,0,0.4), inset 0 -12px 30px rgba(0,0,0,0.3)',
}} />
{/* Felt weave texture */}
<div className="absolute inset-[14px] rounded-[50%] pointer-events-none" style={{
  opacity: 0.03,
  backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 6px,rgba(255,255,255,1) 6px,rgba(255,255,255,1) 7px),repeating-linear-gradient(90deg,transparent,transparent 6px,rgba(255,255,255,1) 6px,rgba(255,255,255,1) 7px)',
}} />
```

- [ ] **Step 6: Add center emblem**

Inside the center content div (where TrickPile lives), add above the trump badge:

```tsx
{/* Center emblem */}
<div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 0 }}>
  <div style={{
    width: 76, height: 76, borderRadius: '50%',
    border: '2px solid rgba(212,160,23,0.4)',
    background: 'radial-gradient(circle, rgba(212,160,23,0.07) 0%, transparent 70%)',
    boxShadow: '0 0 20px rgba(212,160,23,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <span style={{ fontSize: 28, opacity: 0.22, color: '#d4a017' }}>♠</span>
  </div>
</div>
```

- [ ] **Step 7: Replace DealerChip with DealerFigure**

Find `{players.length > 1 && (<DealerChip players={players} dealerIndex={dealerIndex} myPlayerId={myPlayerId} />)}` and replace:

```tsx
{players.length > 1 && (
  <div
    className="absolute z-10"
    style={{ left: '50%', top: '4%', transform: 'translate(-50%, 0)' }}
  >
    <DealerFigure isDealing={phase === 'dealing'} />
  </div>
)}
```

Then delete the entire `function DealerChip(...)` function from the file.

- [ ] **Step 8: TypeScript check and fix**

```bash
cd D:\3ofspades && npx tsc --noEmit
```

Fix any remaining prop errors (likely `isOpen`/`onClose` on any remaining ChatPanel usages). Expected: `exit code 0`.

- [ ] **Step 9: Commit**

```bash
cd D:\3ofspades && git add components/game/GameTable.tsx && git commit -m "feat: flex-row chat, 3D table polish, animated SVG dealer, unread badge

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5: Verify Score Display

**Files:**
- Read-only verify: `components/game/GameTable.tsx`
- Read-only verify: `components/game/PlayerSeat.tsx`

- [ ] **Step 1: Confirm getDisplayPoints in GameTable.tsx**

These helpers must exist and be correct (they were added in a prior session):

```typescript
const playerIndividualPoints = useMemo(() => {
  const map: Record<string, number> = {};
  for (const trick of completedTricks ?? []) {
    if (trick.winnerId) {
      const pts = trick.cards.reduce((sum, tc) => sum + tc.card.points, 0);
      map[trick.winnerId] = (map[trick.winnerId] ?? 0) + pts;
    }
  }
  return map;
}, [completedTricks]);

const revealedTeamAIds = useMemo(() => {
  const ids: string[] = [];
  if (bidWinnerId) ids.push(bidWinnerId);
  for (const id of revealedPartnerIds) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}, [bidWinnerId, revealedPartnerIds]);

const teamACombinedPoints = revealedTeamAIds.reduce(
  (sum, id) => sum + (playerIndividualPoints[id] ?? 0), 0
);

function getDisplayPoints(playerId: string): number {
  if (revealedTeamAIds.includes(playerId)) return teamACombinedPoints;
  return playerIndividualPoints[playerId] ?? 0;
}
```

If missing, add them.

- [ ] **Step 2: Final TypeScript + build check**

```bash
cd D:\3ofspades && npx tsc --noEmit
```

Expected: `exit code 0`.

- [ ] **Step 3: Final commit**

```bash
cd D:\3ofspades && git add -A && git commit -m "chore: verify score display wiring after partner reveal fix

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Self-Review

**Spec coverage:**
- ✅ Chat side-by-side desktop → Task 3 + Task 4 steps 3-4
- ✅ Chat mobile bottom drawer → Task 4 step 3
- ✅ Table gold rim brighter/thicker → Task 4 step 5
- ✅ Table kelly green felt → Task 4 step 5
- ✅ Center emblem → Task 4 step 6
- ✅ 3D tilt already in existing code (rotateX 10deg) → preserved
- ✅ Dealer SVG male figure (bow tie, visor, vest) → Task 2
- ✅ Dealer dealing arm animation → Task 2 step 1
- ✅ Dealer separate from player seats → Task 4 step 7 (absolute top-center, not in player loop)
- ✅ Partner reveal bug fix → Task 1
- ✅ Scores individual until reveal, combined after → Task 5

**Placeholder scan:** All code blocks complete, no TBDs.

**Type consistency:** `ChatPanel` props (`roomId`, `myPlayerId`, `myPlayerName`, `onUnreadChange`) consistent across Tasks 3 and 4. `DealerFigure` prop `{ isDealing: boolean }` consistent across Tasks 2 and 4.
