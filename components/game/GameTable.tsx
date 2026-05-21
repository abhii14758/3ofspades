'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { GameState, Card as CardType, Player, Suit } from '@/types';
import PlayerSeat from './PlayerSeat';
import TrickPile from './TrickPile';
import TurnIndicator from './TurnIndicator';
import BidPanel from './BidPanel';
import TrumpSelector from './TrumpSelector';
import PartnerSelector from './PartnerSelector';
import Scoreboard from './Scoreboard';
import VotePanel from './VotePanel';
// import ChatPanel from './ChatPanel';
import { useGameStore } from '@/store/gameStore';
import CardHand from '@/components/cards/CardHand';
import AvatarUpload from './AvatarUpload';
import OpponentStrip from './OpponentStrip';
import PartnerTracker from './PartnerTracker';
import BlackoutOverlay from './BlackoutOverlay';
import { socketEmit } from '@/lib/socket/socketClient';

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

// ── Turn Timer ────────────────────────────────────────────────────────────────
function TurnTimer({ endsAt, totalSeconds = 30 }: { endsAt: number | null; totalSeconds?: number }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!endsAt) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!endsAt || remaining <= 0) return null;

  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(remaining / totalSeconds, 1));
  const color = remaining < 10 ? '#ef4444' : remaining < 20 ? '#f59e0b' : '#22c55e';

  return (
    <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
      <svg width="48" height="48" className="absolute inset-0 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle
          cx="24" cy="24" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.3s' }}
        />
      </svg>
      <span className="relative text-xs font-bold tabular-nums" style={{ color }}>{remaining}</span>
    </div>
  );
}

// ── Absolute seat positioning ─────────────────────────────────────────────────
/**
 * Returns the absolute % position (left, top) for a seat at `seatIndex`
 * given a table with `totalSeats` players.
 *
 * Seat 0 is always bottom-center. Remaining seats go clockwise.
 * All players see the SAME layout regardless of who they are.
 */
function getSeatPosition(
  seatIndex: number,
  totalSeats: number,
  layout: 'desktop' | 'portrait' | 'landscape' = 'desktop'
): { x: number; y: number } {
  // Seat 0 = local player (always bottom-center).
  // y values for seat 0 are intentionally pulled up from the felt edge so
  // the avatar doesn't hide behind the card-hand strip at the bottom.
  const SEAT_MAPS: Record<number, Array<[number, number]>> = {
    4: [
      [50, 82], // 0 local player bottom (raised above card strip)
      [8, 50],  // 1 left-mid
      [50, 12], // 2 top-center
      [92, 50], // 3 right-mid
    ],
    6: [
      [50, 82], // 0 local player
      [10, 58], // 1 left-mid
      [22, 18], // 2 top-left
      [50, 14], // 3 top-center
      [78, 18], // 4 top-right
      [90, 58], // 5 right-mid
    ],
    8: [
      [50, 82], // 0 local
      [10, 68], // 1 bottom-left
      [8, 40],  // 2 mid-left
      [22, 16], // 3 top-left
      [50, 12], // 4 top-center
      [78, 16], // 5 top-right
      [92, 40], // 6 mid-right
      [90, 68], // 7 bottom-right
    ],
    10: [
      [50, 82], // 0 local (raised)
      [20, 82], // 1 bottom-left
      [8,  58], // 2 mid-left
      [8,  32], // 3 top-left
      [26, 14], // 4 upper-left
      [50, 10], // 5 top-center
      [74, 14], // 6 upper-right
      [92, 32], // 7 top-right
      [92, 58], // 8 mid-right
      [80, 82], // 9 bottom-right
    ],
  };

  const LANDSCAPE_SEAT_MAPS: Record<number, Array<[number, number]>> = {
    4: [
      [50, 80], // 0 local (raised in landscape — card strip is below)
      [93, 45],
      [50, 10],
      [7, 45],
    ],
    6: [
      [50, 80], // 0 local
      [93, 38],
      [20, 16],
      [50, 10],
      [80, 16],
      [93, 62],
    ],
    8: [
      [50, 80], // 0 local (raised)
      [93, 28],
      [20, 14],
      [40, 10],
      [60, 10],
      [80, 14],
      [93, 50],
      [93, 72],
    ],
    10: [
      [50, 80], // 0 local (raised)
      [93, 20], [22, 12], [38, 10], [50, 8], [62, 10], [78, 12], [93, 36], [93, 58], [93, 76],
    ],
  };

  const maps = layout === 'landscape' ? LANDSCAPE_SEAT_MAPS : SEAT_MAPS;
  const map = maps[totalSeats] ?? maps[6] ?? SEAT_MAPS[6];
  const [x, y] = map[seatIndex % map.length] ?? [50, 50];
  return { x, y };
}

// ── Deal animation ─────────────────────────────────────────────────────────────
// Shows cardsPerPlayer "rounds" — in each round ALL players receive one card simultaneously.
// Total visual duration = cardsPerPlayer * ROUND_INTERVAL (e.g. 9 rounds × 0.5s = 4.5s)
const ROUND_INTERVAL = 0.5; // seconds between each dealing round
const CARD_FLIGHT = 0.42;   // seconds for one card to fly to its player

function DealAnimation({
  players,
  myPlayerId,
  cardsPerPlayer,
  tableW,
  tableH,
  onCardDealtToMe,
  onComplete,
}: {
  players: Player[];
  myPlayerId: string;
  cardsPerPlayer: number;
  tableW: number;
  tableH: number;
  onCardDealtToMe: () => void;
  onComplete: () => void;
}) {
  const N = players.length;
  const ROUNDS = cardsPerPlayer; // one visual round per card per player
  const totalDuration = ROUNDS * ROUND_INTERVAL + CARD_FLIGHT;

  // Fire onComplete after all rounds finish
  useEffect(() => {
    const t = setTimeout(onComplete, totalDuration * 1000 + 800);
    return () => clearTimeout(t);
  }, [totalDuration, onComplete]);

  // Fire onCardDealtToMe once per round (when the card for "me" arrives)
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      const delay = round * ROUND_INTERVAL * 1000 + (CARD_FLIGHT * 1000 * 0.6);
      timers.push(setTimeout(onCardDealtToMe, delay));
    }
    return () => timers.forEach(clearTimeout);
  }, [ROUNDS, onCardDealtToMe]);

  // Player positions as pixel offsets from table center
  const positions = useMemo(() => {
    const myIdx = players.findIndex((p) => p.id === myPlayerId);
    const rx = 0.46;
    const ry = 0.42;
    return players.map((p, i) => {
      const relIdx = (i - myIdx + N) % N;
      const angleDeg = 90 + (360 * relIdx) / N;
      const angleRad = (angleDeg * Math.PI) / 180;
      const dx = rx * Math.cos(angleRad) * tableW;
      const dy = ry * Math.sin(angleRad) * tableH;
      return { dx, dy };
    });
  }, [players, myPlayerId, N, tableW, tableH]);

  // Build card list: each round has N cards (one per player), all flying simultaneously
  const cards = useMemo(() => {
    const result: { key: number; roundDelay: number; playerIdx: number; playerDelay: number; rotation: number }[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      for (let pi = 0; pi < N; pi++) {
        result.push({
          key: round * N + pi,
          roundDelay: round * ROUND_INTERVAL,
          // stagger slightly within the round so cards don't stack exactly
          playerDelay: round * ROUND_INTERVAL + pi * 0.04,
          playerIdx: pi,
          rotation: (Math.random() - 0.5) * 18,
        });
      }
    }
    return result;
  }, [N, ROUNDS]);

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {/* Circular glow backdrop + deck stack at center */}
      <motion.div
        style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        animate={{ y: [0, -2, 0] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
      >
        {/* Circular glowing disc behind deck */}
        <div style={{
          position: 'absolute',
          width: 80, height: 80,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(30,58,138,0.08) 70%, transparent 100%)',
          boxShadow: '0 0 28px rgba(59,130,246,0.35), 0 0 60px rgba(59,130,246,0.12)',
          border: '1.5px solid rgba(96,165,250,0.22)',
        }} />
        {/* Card stack */}
        <div style={{ position: 'relative', width: 42, height: 60 }}>
          {[6, 5, 4, 3, 2, 1, 0].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: 42, height: 60,
                borderRadius: 7,
                background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 55%, #2563eb 100%)',
                border: '1px solid rgba(96,165,250,0.5)',
                boxShadow: i === 0 ? '0 6px 18px rgba(0,0,0,0.7), 0 0 10px rgba(59,130,246,0.3)' : 'none',
                top: -(i * 0.9),
                left: i * 0.35,
              }}
            >
              <div style={{
                position: 'absolute', inset: 3, borderRadius: 4,
                border: '1px solid rgba(96,165,250,0.22)',
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.04) 3px, rgba(255,255,255,0.04) 6px)',
              }} />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Flying cards — all players get a card simultaneously each round */}
      {cards.map(({ key, playerDelay, playerIdx, rotation }) => {
        const { dx, dy } = positions[playerIdx];
        return (
          <motion.div
            key={key}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 38,
              height: 54,
              borderRadius: 5,
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 55%, #2563eb 100%)',
              border: '1px solid rgba(96,165,250,0.45)',
              boxShadow: '0 8px 20px rgba(0,0,0,0.6), 0 0 6px rgba(59,130,246,0.2)',
              zIndex: 10 + key,
            }}
            initial={{ x: '-50%', y: '-50%', opacity: 0, scale: 0.7, rotate: 0 }}
            animate={{
              x: `calc(-50% + ${dx}px)`,
              y: `calc(-50% + ${dy}px)`,
              opacity: [0, 1, 1, 1, 0],
              scale: [0.7, 1.05, 0.88],
              rotate: rotation,
            }}
            transition={{
              delay: playerDelay,
              duration: CARD_FLIGHT,
              ease: [0.16, 1, 0.3, 1],
              opacity: { times: [0, 0.07, 0.55, 0.82, 1], duration: CARD_FLIGHT + 0.06, delay: playerDelay },
              scale: { times: [0, 0.3, 1], duration: CARD_FLIGHT, delay: playerDelay },
            }}
          >
            <div style={{
              position: 'absolute', inset: 3, borderRadius: 3,
              border: '1px solid rgba(96,165,250,0.22)',
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.04) 3px, rgba(255,255,255,0.04) 6px)',
            }} />
          </motion.div>
        );
      })}
    </div>
  );
}

// ── DealHandReveal — cards appear face-up one by one during deal ────────────────
const RANK_DISPLAY: Record<string, string> = {
  A: 'A', K: 'K', Q: 'Q', J: 'J', '10': '10',
  '9': '9', '8': '8', '7': '7', '6': '6', '5': '5',
  '4': '4', '3': '3',
};
const SUIT_SYM: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

function DealHandReveal({ cards, revealedCount }: { cards: CardType[]; revealedCount: number }) {
  const visible = cards.slice(0, revealedCount);
  const allDealt = revealedCount >= cards.length && cards.length > 0;
  const isRed = (suit: string) => suit === 'hearts' || suit === 'diamonds';

  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <p
        className="text-xs font-medium tracking-widest uppercase"
        style={{ color: allDealt ? '#f9d976' : 'rgba(148,163,184,0.9)', transition: 'color 0.4s' }}
      >
        {allDealt ? '✨ Revealing your hand!' : 'Dealing your cards…'}
      </p>
      <div className="flex items-end justify-center gap-1 flex-wrap px-4">
        <AnimatePresence mode="popLayout">
          {visible.map((card, idx) => (
            <motion.div
              key={card.id}
              layout
              initial={{ scale: 0.7, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28, delay: 0.04 }}
              style={{ width: 48, height: 70, position: 'relative', flexShrink: 0 }}
            >
              {/* Card back — shown while dealing */}
              <AnimatePresence>
                {!allDealt && (
                  <motion.div
                    key="back"
                    exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.18 } }}
                    style={{
                      position: 'absolute', inset: 0, borderRadius: 8,
                      background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 55%, #2563eb 100%)',
                      border: '1.5px solid rgba(96,165,250,0.5)',
                      boxShadow: '0 3px 10px rgba(0,0,0,0.4)',
                    }}
                  >
                    <div style={{
                      position: 'absolute', inset: 4, borderRadius: 5,
                      border: '1px solid rgba(96,165,250,0.3)',
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.05) 3px, rgba(255,255,255,0.05) 6px)',
                    }} />
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Card face — revealed after all dealt with stagger flip */}
              <AnimatePresence>
                {allDealt && (
                  <motion.div
                    key="face"
                    initial={{ opacity: 0, rotateY: 90, scale: 0.85 }}
                    animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24, delay: idx * 0.07 }}
                    style={{
                      position: 'absolute', inset: 0, perspective: 600,
                      borderRadius: 8, overflow: 'hidden',
                    }}
                  >
                    <div
                      className="flex flex-col items-center justify-between select-none"
                      style={{
                        width: '100%', height: '100%',
                        background: '#ffffff',
                        border: isRed(card.suit) ? '1.5px solid #ffb3b3' : '1.5px solid #c0c8d8',
                        boxShadow: '0 0 14px rgba(212,160,23,0.5), 0 4px 16px rgba(0,0,0,0.5)',
                        padding: '3px 4px',
                      }}
                    >
                      <div style={{ alignSelf: 'flex-start', lineHeight: 1.1 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: isRed(card.suit) ? '#c0152a' : '#1a1a2e', lineHeight: 1 }}>
                          {RANK_DISPLAY[card.rank] ?? card.rank}
                        </div>
                        <div style={{ fontSize: 10, color: isRed(card.suit) ? '#c0152a' : '#1a1a2e', lineHeight: 1 }}>
                          {SUIT_SYM[card.suit]}
                        </div>
                      </div>
                      <div style={{ fontSize: 18, lineHeight: 1, color: isRed(card.suit) ? '#c0152a' : '#1a1a2e' }}>
                        {SUIT_SYM[card.suit]}
                      </div>
                      <div style={{ alignSelf: 'flex-end', lineHeight: 1.1, transform: 'rotate(180deg)' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: isRed(card.suit) ? '#c0152a' : '#1a1a2e', lineHeight: 1 }}>
                          {RANK_DISPLAY[card.rank] ?? card.rank}
                        </div>
                        <div style={{ fontSize: 10, color: isRed(card.suit) ? '#c0152a' : '#1a1a2e', lineHeight: 1 }}>
                          {SUIT_SYM[card.suit]}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
        {/* Placeholder slots for undealt cards */}
        {!allDealt && Array.from({ length: Math.max(0, cards.length - visible.length) }).map((_, i) => (
          <div
            key={`ph-${i}`}
            className="rounded-lg border border-dashed border-slate-700/50"
            style={{ width: 44, height: 64, background: 'rgba(255,255,255,0.03)' }}
          />
        ))}
      </div>
    </div>
  );
}

// ── HUD pill ──────────────────────────────────────────────────────────────────
function HudPill({ label, value, valueColor }: { label: string; value: string | number; valueColor?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(0,0,0,0.72)', border:'1px solid rgba(212,175,55,0.4)', borderRadius:20, padding:'4px 10px', fontWeight:700, whiteSpace:'nowrap' }}>
      <span style={{ color:'rgba(255,255,255,0.42)', fontSize:11 }}>{label}</span>
      <span style={{ color: valueColor ?? '#fff', fontSize:14 }}>{value}</span>
    </div>
  );
}

// ── Landscape sidebar helpers ─────────────────────────────────────────────────
function LsHudRow({ label, value, valueColor = '#fff' }: { label: string; value: string | number; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3px 0', width: '100%' }}>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: valueColor, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function LsTeamRow({ letter, pts, color }: { letter: string; pts: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '88%', padding: '3px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.55)' }}>{letter}</span>
      <span style={{ fontSize: 15, fontWeight: 900, color }}>{pts >= 0 ? `+${pts}` : pts}</span>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface GameTableProps {
  gameState: GameState;
  myPlayerId: string;
  myHand: CardType[];
  onPlayCard: (card: CardType) => void;
  onBid?: (amount: number) => void;
  onPass?: () => void;
  onSelectTrump?: (suit: Suit) => void;
  onSelectPartners?: (slots: Array<{ typeId: string; ordinal: 1 | 2 }>) => void;
  isHost?: boolean;
  onTerminate?: () => void;
  onLeave?: () => void;
  partnerCount?: number;
  maxBid?: number;
  totalTricks?: number;
  turnTimerTotalSeconds?: number;
  deckCount?: number;
}

export default function GameTable({
  gameState,
  myPlayerId,
  myHand,
  onPlayCard,
  onBid,
  onPass,
  onSelectTrump,
  onSelectPartners,
  isHost = false,
  onTerminate,
  onLeave,
  partnerCount = 2,
  maxBid = 250,
  totalTricks = 8,
  turnTimerTotalSeconds = 30,
  deckCount = 1,
}: GameTableProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  // const [chatOpen, setChatOpen] = useState(false);
  // const [unread, setUnread] = useState(0);
  // const handleUnread = useCallback(() => setUnread(n => n + 1), []);
  // useEffect(() => { if (chatOpen) setUnread(0); }, [chatOpen]);
  const [dealAnimDone, setDealAnimDone] = useState(false);
  const [dealRevealedCount, setDealRevealedCount] = useState(0);
  const [handHidden, setHandHidden] = useState(false);
  const [sortTrigger, setSortTrigger] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  // Held trick — keeps last full trick visible for 5s after it completes
  const [heldTrick, setHeldTrick] = useState<typeof gameState.currentTrick>(null);
  const [bidAmount, setBidAmount] = useState(0);
  const myCalledCards = useGameStore((s) => s.myCalledCards);
  const myCalledCardSlots = useGameStore((s) => s.myCalledCardSlots);
  const isBlackout = useGameStore((s) => s.isBlackout);
  const setBlackout = useGameStore((s) => s.setBlackout);
  const blackoutCount = useGameStore((s) => s.blackoutCount);
  const blackoutVoterNames = useGameStore((s) => s.blackoutVoterNames);
  const tableRef = useRef<HTMLDivElement>(null);

  const [tableDims, setTableDims] = useState({ w: 860, h: 540 });
  // True when the CSS viewport is small (e.g. 150%+ browser zoom) — used to shift
  // center info upward and keep the local player avatar out of the table info area.
  const isSmallViewport = tableDims.h < 680;
  useEffect(() => {
    if (!tableRef.current) return;
    const el = tableRef.current;
    const update = () => setTableDims({ w: el.offsetWidth, h: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isLandscapePhone = w >= 480 && h < 500 && w > h;
      const isPortraitPhone = w < 640;
      const mobile = isPortraitPhone || isLandscapePhone;
      setIsMobile(mobile);
      setIsTablet(!mobile && w >= 640 && w < 1024);
      setIsLandscape(w > h);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  // Reset deal anim when phase changes to dealing
  useEffect(() => {
    if (gameState.phase === 'dealing') {
      setDealAnimDone(false);
      setDealRevealedCount(0);
      setHandHidden(false);
    }
  }, [gameState.phase]);

  // Keyboard shortcut: H to toggle hide cards
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
        setHandHidden(v => !v);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ESC → blackout all screens; SPACE (when blacked out) → reveal
  useEffect(() => {
    const handleBlackoutKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        socketEmit.blackout(gameState.roomId);
      }
    };
    window.addEventListener('keydown', handleBlackoutKey);
    return () => window.removeEventListener('keydown', handleBlackoutKey);
  }, [gameState.roomId]);

  const handleDealComplete = useCallback(() => setDealAnimDone(true), []);
  const handleSkipDeal = useCallback(() => {
    setDealAnimDone(true);
    setDealRevealedCount(myHand.length);
    socketEmit.skipDeal(gameState.roomId);
  }, [myHand.length, gameState.roomId]);

  // Auto-end deal animation after local player receives their last card
  useEffect(() => {
    if (dealRevealedCount > 0 && myHand.length > 0 && dealRevealedCount >= myHand.length) {
      const t = setTimeout(() => setDealAnimDone(true), 1200);
      return () => clearTimeout(t);
    }
  }, [dealRevealedCount, myHand.length]);

  // Hold the last full trick visible for 5s so players can see the final card played
  const prevTrickRef = useRef<typeof gameState.currentTrick>(null);
  useEffect(() => {
    const incoming = gameState.currentTrick;
    const prev = prevTrickRef.current;
    // When a full trick just cleared (prev had all players' cards, now it's gone)
    if (prev && prev.cards.length === gameState.players.length && (!incoming || incoming.cards.length === 0)) {
      setHeldTrick(prev);
      const t = setTimeout(() => setHeldTrick(null), 5000);
      prevTrickRef.current = incoming ?? null;
      return () => clearTimeout(t);
    }
    prevTrickRef.current = incoming ?? null;
  }, [gameState.currentTrick, gameState.players.length]);

  const {
    players,
    phase,
    currentTrick,
    completedTricks,
    bidState,
    trumpSuit,
    currentTurnPlayerId,
    bidWinnerId,
    teams,
    roundNumber,
    hands,
    turnTimerEndsAt,
    dealerIndex,
  } = gameState;

  const revealedPartnerIds: string[] = gameState.revealedPartnerIds ?? [];
  const calledCards: import('@/types').Card[] = gameState.calledCards ?? [];
  const calledCardSlots = gameState.calledCardSlots ?? [];

  // ── Per-player individual round points ────────────────────────────────────
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

  const teamBIds = useMemo(() => {
    if (teams?.B.playerIds && teams.B.playerIds.length > 0) return teams.B.playerIds;
    // Derive team B once all partner slots are resolved (filled or voided)
    const allSlotsResolved = calledCardSlots.length > 0
      ? calledCardSlots.every((s) => !!s.assignedPartnerId || s.isVoid)
      : revealedPartnerIds.length >= partnerCount;
    if (bidWinnerId && allSlotsResolved) {
      const teamASet = new Set([bidWinnerId, ...revealedPartnerIds]);
      return players.map((p) => p.id).filter((id) => !teamASet.has(id));
    }
    return [];
  }, [teams, bidWinnerId, revealedPartnerIds, partnerCount, players, calledCardSlots]);

  const teamBCombinedPoints = teamBIds.reduce(
    (sum, id) => sum + (playerIndividualPoints[id] ?? 0), 0
  );

  // All partner slots resolved = each slot is either assigned or voided
  const allPartnersRevealed = calledCardSlots.length > 0
    ? calledCardSlots.every((s) => !!s.assignedPartnerId || s.isVoid)
    : revealedPartnerIds.length >= partnerCount;

  function getDisplayPoints(playerId: string): number {
    if (revealedTeamAIds.includes(playerId)) return teamACombinedPoints;
    if (allPartnersRevealed && teamBIds.includes(playerId)) return teamBCombinedPoints;
    return playerIndividualPoints[playerId] ?? 0;
  }

  function getPlayerTeamId(playerId: string): 'A' | 'B' | null {
    if (revealedTeamAIds.includes(playerId)) return 'A';
    if (allPartnersRevealed && teamBIds.includes(playerId)) return 'B';
    return null;
  }

  const myPlayer = players.find((p) => p.id === myPlayerId);
  const isMyTurn = currentTurnPlayerId === myPlayerId;
  const currentTurnPlayer = players.find((p) => p.id === currentTurnPlayerId) ?? null;

  const getTrickCard = (playerId: string): CardType | null =>
    currentTrick?.cards.find((c) => c.playerId === playerId)?.card ?? null;

  const playableCardIds = useMemo<Set<string> | undefined>(
    () => (isMyTurn && phase === 'playing' ? new Set(myHand.map((c) => c.id)) : undefined),
    [isMyTurn, phase, myHand]
  );

  const showBidPanel = phase === 'bidding' && bidState !== null;
  const showTrumpSelector = phase === 'trump_selection' && bidWinnerId === myPlayerId && onSelectTrump;
  const showPartnerSelector = phase === 'partner_selection' && bidWinnerId === myPlayerId && onSelectPartners;
  const showDealAnim = phase === 'dealing' && !dealAnimDone && players.length > 1;
  const cardsPerPlayer = myHand.length > 0 ? myHand.length : Math.ceil((gameState.hands ? Object.values(gameState.hands)[0]?.length ?? 8 : 8));

  // effectivelyHidden: user preference, but auto-reveal during your turn in playing phase
  const effectivelyHidden = handHidden && !(isMyTurn && phase === 'playing');

  const handleCardDealtToMe = useCallback(
    () => setDealRevealedCount(n => n + 1),
    []
  );

  useEffect(() => {
    if (bidState) {
      const nextMin = Math.max((bidState.currentBid > 0 ? bidState.currentBid : 0) + 10, bidState.minBid);
      setBidAmount(nextMin);
    }
  }, [bidState?.currentBid, bidState?.minBid]);

  const nextMinBid = bidState
    ? Math.max((bidState.currentBid > 0 ? bidState.currentBid : 0) + 10, bidState.minBid)
    : 100;


  return (
    <div
      className="select-none"
      style={{
        height: '100dvh',
        width: '100vw',
        position: 'relative',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse 160% 120% at 50% 55%, #051205 0%, #020802 50%, #000 100%)',
      }}
    >
      {/* Shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes trumpShimmer {
          0%, 100% { box-shadow: 0 0 8px rgba(212,175,55,0.3), inset 0 0 8px rgba(212,175,55,0.1); }
          50% { box-shadow: 0 0 20px rgba(212,175,55,0.7), 0 0 40px rgba(212,175,55,0.3), inset 0 0 12px rgba(212,175,55,0.2); }
        }
        @keyframes avPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(249,217,118,0.35), 0 0 20px rgba(249,217,118,0.2), 0 4px 16px rgba(0,0,0,0.5); }
          50% { box-shadow: 0 0 0 6px rgba(249,217,118,0.15), 0 0 36px rgba(249,217,118,0.18), 0 4px 16px rgba(0,0,0,0.5); }
        }
      `}</style>

      {/* ═══ LANDSCAPE SIDEBAR (100px left panel) ═══ */}
      {isMobile && isLandscape && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 100, zIndex: 60,
          background: 'rgba(0,0,0,0.88)',
          borderRight: '2px solid rgba(212,160,23,0.30)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '8px 0 6px', gap: 0,
        }}>
          {isHost && onTerminate && (
            <button onClick={onTerminate} style={{
              width: '80%', padding: '4px 0', textAlign: 'center',
              background: '#450a0a', border: '1px solid #991b1b',
              color: '#fca5a5', fontSize: 10, borderRadius: 6,
              fontWeight: 700, cursor: 'pointer', marginBottom: 6,
            }}>🔴 End</button>
          )}
          {!isHost && onLeave && (
            <button onClick={onLeave} style={{
              width: '80%', padding: '4px 0', textAlign: 'center',
              background: 'rgba(30,30,30,0.9)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)', fontSize: 10, borderRadius: 6,
              fontWeight: 700, cursor: 'pointer', marginBottom: 6,
            }}>← Leave</button>
          )}
          <div style={{ width: '72%', height: 1, background: 'rgba(212,160,23,0.18)', margin: '5px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3px 0', width: '100%' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>Round</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{roundNumber ?? 1}</div>
          </div>
          <div style={{ width: '72%', height: 1, background: 'rgba(212,160,23,0.18)', margin: '5px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '88%', padding: '3px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.55)' }}>A</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#6ee7b7' }}>{teamACombinedPoints >= 0 ? `+${teamACombinedPoints}` : teamACombinedPoints}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '88%', padding: '3px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.55)' }}>B</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#f87171' }}>{teamBCombinedPoints >= 0 ? `+${teamBCombinedPoints}` : teamBCombinedPoints}</span>
          </div>
          <div style={{ width: '72%', height: 1, background: 'rgba(212,160,23,0.18)', margin: '5px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3px 0', width: '100%' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>Target</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#f9d976', lineHeight: 1.1 }}>500</div>
          </div>
          <div style={{ width: '72%', height: 1, background: 'rgba(212,160,23,0.18)', margin: '5px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3px 0', width: '100%' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>Trick</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
              {phase === 'playing' ? `${completedTricks.length + 1}/${totalTricks}` : '-'}
            </div>
          </div>
          <div style={{ width: '72%', height: 1, background: 'rgba(212,160,23,0.18)', margin: '5px 0' }} />
          <VotePanel roomId={gameState.roomId} myPlayerId={myPlayerId} voteEndVotes={gameState.voteEndVotes ?? {}} totalPlayers={players.length} />
        </div>
      )}

      {/* ═══ MAIN PLAY AREA ═══ */}
      <div
        ref={tableRef}
        style={{
          position: 'absolute',
          top: 0, bottom: 0,
          left: isMobile && isLandscape ? 100 : 0,
          right: 0,
        }}
      >
        {/* Green felt surface */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 100% 100% at 50% 50%, #24924a 0%, #1c7a3d 25%, #155e30 55%, #0d4020 80%, #07271a 100%)',
        }} />
        {/* Felt weave texture */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: [
            'repeating-linear-gradient(0deg, transparent, transparent 5px, rgba(255,255,255,0.018) 5px, rgba(255,255,255,0.018) 6px)',
            'repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(255,255,255,0.018) 5px, rgba(255,255,255,0.018) 6px)',
          ].join(', '),
        }} />
        {/* Gold border rail */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          border: '4px solid rgba(212,160,23,0.9)',
          boxShadow: [
            'inset 0 0 0 2px rgba(255,220,80,0.55)',
            'inset 0 0 0 10px rgba(140,90,5,0.32)',
            'inset 0 0 60px rgba(0,0,0,0.38)',
            '0 0 0 1px rgba(100,60,0,0.9)',
            '0 0 12px rgba(212,160,23,0.35)',
          ].join(', '),
        }} />
        {/* Inner accent line */}
        <div style={{
          position: 'absolute', inset: 10, pointerEvents: 'none',
          border: '1px solid rgba(212,160,23,0.22)',
        }} />
        {/* Overhead lamp glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,220,100,0.12) 0%, transparent 60%)',
        }} />
        {/* Corner vignette */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 90% 90% at 50% 50%, transparent 50%, rgba(0,0,0,0.5) 100%)',
        }} />
        {/* Zone guide lines (subtle) */}
        {!isMobile && (
          <>
            <div style={{ position:'absolute', left:60, right:60, top:'33%', height:1, background:'rgba(212,160,23,0.12)', pointerEvents:'none' }} />
            <div style={{ position:'absolute', left:60, right:60, top:'66%', height:1, background:'rgba(212,160,23,0.08)', pointerEvents:'none' }} />
            <div style={{ position:'absolute', top:60, bottom:60, left:'25%', width:1, background:'rgba(212,160,23,0.10)', pointerEvents:'none' }} />
            <div style={{ position:'absolute', top:60, bottom:60, left:'75%', width:1, background:'rgba(212,160,23,0.10)', pointerEvents:'none' }} />
          </>
        )}
        {isMobile && (
          <>
            <div style={{ position:'absolute', left:40, right:40, top:'42%', height:1, background:'rgba(212,160,23,0.12)', pointerEvents:'none' }} />
            <div style={{ position:'absolute', top:40, bottom:40, left:'25%', width:1, background:'rgba(212,160,23,0.10)', pointerEvents:'none' }} />
            <div style={{ position:'absolute', top:40, bottom:40, left:'75%', width:1, background:'rgba(212,160,23,0.10)', pointerEvents:'none' }} />
          </>
        )}

        {/* TOP-LEFT CONTROLS (desktop/portrait only) */}
        {!(isMobile && isLandscape) && (
          <div style={{ position:'absolute', top:8, left:16, zIndex:200, display:'flex', gap:5, alignItems:'center' }}>
            {isHost && onTerminate && (
              <motion.button whileTap={{ scale: 0.93 }} onClick={onTerminate}
                style={{ padding:'4px 10px', background:'#450a0a', border:'1px solid #991b1b', color:'#fca5a5', fontSize:11, borderRadius:8, fontWeight:700, cursor:'pointer' }}>
                🔴 End
              </motion.button>
            )}
            {!isHost && onLeave && (
              <motion.button whileTap={{ scale: 0.93 }} onClick={onLeave}
                style={{ padding:'4px 10px', background:'rgba(30,30,30,.9)', border:'1px solid rgba(255,255,255,.1)', color:'rgba(255,255,255,.6)', fontSize:11, borderRadius:8, fontWeight:700, cursor:'pointer' }}>
                ← Leave
              </motion.button>
            )}
            <VotePanel roomId={gameState.roomId} myPlayerId={myPlayerId} voteEndVotes={gameState.voteEndVotes ?? {}} totalPlayers={players.length} />
            <AnimatePresence>
              {isHost && showDealAnim && (
                <motion.button initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.85 }} whileTap={{ scale:0.93 }}
                  onClick={handleSkipDeal}
                  style={{ padding:'4px 10px', background:'rgba(120,60,0,.8)', border:'1px solid rgba(217,119,6,.6)', color:'#fbbf24', fontSize:11, borderRadius:8, fontWeight:700, cursor:'pointer' }}>
                  ⏭ Skip Deal
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* TURN BANNER (top-center) */}
        <div style={{ position:'absolute', top:8, left:'50%', transform:'translateX(-50%)', zIndex:200, pointerEvents:'none' }}>
          <TurnIndicator currentPlayer={currentTurnPlayer} isMyTurn={isMyTurn} />
        </div>

        {/* LEFT HUD (desktop/portrait only) */}
        {!(isMobile && isLandscape) && (
          <div style={{ position:'absolute', top: isMobile ? 48 : 54, left:14, zIndex:50, display:'flex', flexDirection:'column', gap:5 }}>
            <HudPill label="Round" value={`${roundNumber ?? 1} / ∞`} />
            <HudPill label="Team A" value={teamACombinedPoints >= 0 ? `+${teamACombinedPoints}` : teamACombinedPoints} valueColor="#6ee7b7" />
            <HudPill label="Team B" value={teamBCombinedPoints >= 0 ? `+${teamBCombinedPoints}` : teamBCombinedPoints} valueColor="#fca5a5" />
          </div>
        )}

        {/* RIGHT HUD */}
        {!(isMobile && isLandscape) && (
          <div style={{ position:'absolute', top:8, right:14, zIndex:50, display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end' }}>
            {/* Target + Trick pills */}
            <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
              <HudPill label="Target" value="500 pts" />
              {phase === 'playing' && (
                <HudPill label="Trick" value={`${completedTricks.length + 1}/${totalTricks}`} />
              )}
            </div>
            {/* Timer — clearly separated */}
            {turnTimerEndsAt && (
              <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(0,0,0,.72)', border:'1px solid rgba(212,175,55,0.4)', borderRadius:20, padding:'4px 10px' }}>
                <TurnTimer endsAt={turnTimerEndsAt} totalSeconds={turnTimerTotalSeconds} />
                <span style={{ color:'rgba(255,255,255,.42)', fontSize:9 }}>sec</span>
              </div>
            )}
            {/* Partner slot tracker — inline below HUD pills, no position conflict */}
            {phase === 'playing' && myPlayerId === bidWinnerId && myCalledCardSlots.length > 0 && (
              <PartnerTracker slots={myCalledCardSlots} players={players} bidWinnerId={bidWinnerId!} inline />
            )}
          </div>
        )}
        {/* Landscape: timer top-right */}
        {isMobile && isLandscape && turnTimerEndsAt && (
          <div style={{ position:'absolute', top:8, right:8, zIndex:200, display:'flex', alignItems:'center', gap:4, background:'rgba(0,0,0,.72)', border:'1px solid rgba(212,175,55,0.4)', borderRadius:20, padding:'3px 8px' }}>
            <TurnTimer endsAt={turnTimerEndsAt} totalSeconds={turnTimerTotalSeconds} />
          </div>
        )}

        {/* PLAYER SEATS — opponents only; local player is rendered separately below */}
        {players.map((player) => {
          const myPlayerLocal = players.find((p) => p.id === myPlayerId);
          const mySeatIdx = myPlayerLocal?.seatIndex ?? 0;
          const relativeSeatIdx = (player.seatIndex - mySeatIdx + players.length) % players.length;
          const layout = isMobile && isLandscape ? 'landscape' : isMobile ? 'portrait' : 'desktop';
          const { x, y } = getSeatPosition(relativeSeatIdx, players.length, layout);
          const isCurrentTurn = player.id === currentTurnPlayerId;
          const isPartner = revealedPartnerIds.includes(player.id);
          const cardCount = hands[player.id]?.length ?? 0;
          const trickCard = getTrickCard(player.id);
          const isLocalPlayer = player.id === myPlayerId;
          // Skip local player here — rendered at a fixed offset above card strip below
          if (isLocalPlayer) return null;
          return (
            <div key={player.id} className="absolute" style={{ left:`${x}%`, top:`${y}%`, transform:'translate(-50%, -50%)', zIndex: 1 }}>
              <PlayerSeat player={player} cardCount={cardCount} isCurrentTurn={isCurrentTurn} isLocalPlayer={false} isPartner={isPartner} isRevealed={isPartner} isBidWinner={player.id === bidWinnerId && !!bidWinnerId} trickCard={trickCard} position="bottom" compact={isMobile} extraCompact={isMobile && isLandscape} displayPoints={getDisplayPoints(player.id)} teamId={getPlayerTeamId(player.id)} turnTimerEndsAt={isCurrentTurn ? turnTimerEndsAt : null} turnTimerTotalSeconds={turnTimerTotalSeconds} showCombinedLabel={allPartnersRevealed && teamBIds.includes(player.id)} miniCardCount={hands[player.id]?.length ?? 0} />
              {/* Host kick button — only shown to host, not for bots */}
              {myPlayer?.isHost && player.type !== 'bot' && (
                <button
                  onClick={() => {
                    if (window.confirm(`Kick ${player.name}? A bot will take their seat.`)) {
                      socketEmit.kickPlayer(gameState.roomId, player.id);
                    }
                  }}
                  title={`Kick ${player.name}`}
                  style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'rgba(220,38,38,0.85)', border: '1px solid rgba(239,68,68,0.6)',
                    color: '#fff', fontSize: 9, fontWeight: 900, lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 10,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}

        {/* LOCAL PLAYER SEAT — placed at a fixed pixel offset above the card strip.
            Using tableDims.h avoids breakage at different browser zoom levels. */}
        {(() => {
          const localPlayer = players.find((p) => p.id === myPlayerId);
          if (!localPlayer) return null;
          const isLocalCurrentTurn = currentTurnPlayerId === myPlayerId;
          const localTrickCard = getTrickCard(myPlayerId);
          // Bottom offset: card hand (~90px) + action bar (~50px) + gap (~20px).
          // Scale with tableDims.h so it works at any zoom (larger offset on larger screens).
          const baseBottom = isMobile && isLandscape ? 0.20 : isMobile ? 0.22 : 0.24;
          const minBottom = isMobile && isLandscape ? 110 : isMobile ? 140 : 165;
          const localBottomPx = Math.max(minBottom, Math.round(tableDims.h * baseBottom));
          return (
            <div key="local-player-seat" style={{
              position: 'absolute', bottom: localBottomPx, left: '50%',
              transform: 'translate(-50%, 0)', zIndex: 5,
            }}>
              <PlayerSeat
                player={localPlayer}
                cardCount={myHand.length}
                isCurrentTurn={isLocalCurrentTurn}
                isLocalPlayer={true}
                isPartner={revealedPartnerIds.includes(myPlayerId)}
                isRevealed={revealedPartnerIds.includes(myPlayerId)}
                isBidWinner={myPlayerId === bidWinnerId && !!bidWinnerId}
                trickCard={localTrickCard}
                position="bottom"
                compact={isMobile}
                extraCompact={isMobile && isLandscape}
                displayPoints={getDisplayPoints(myPlayerId)}
                teamId={getPlayerTeamId(myPlayerId)}
                turnTimerEndsAt={isLocalCurrentTurn ? turnTimerEndsAt : null}
                turnTimerTotalSeconds={turnTimerTotalSeconds}
                showCombinedLabel={allPartnersRevealed && teamBIds.includes(myPlayerId)}
                miniCardCount={myHand.length}
              />
            </div>
          );
        })()}

        {/* CENTER TABLE INFO */}
        <div style={{
          position: 'absolute', left: '50%',
          top: isMobile && isLandscape ? '42%'
            : isMobile ? (isSmallViewport ? '28%' : '38%')
            : (isSmallViewport ? '22%' : '44%'),
          transform: 'translate(-50%, -50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: isMobile ? 4 : 14, zIndex: 10, pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: isMobile ? (isLandscape ? 12 : 13) : 20,
            fontWeight: 900,
            letterSpacing: isMobile ? '2px' : '4px',
            background: 'linear-gradient(90deg, #9a6b1f 0%, #f9d976 20%, #fffdf0 40%, #f9d976 60%, #e9b646 80%, #9a6b1f 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'shimmer 3s linear infinite',
          }}>
            3 ♠ SPADES
          </div>
          {trumpSuit && (
            <div style={{
              display:'flex', alignItems:'center', gap: isMobile ? 4 : 6,
              background:'rgba(0,0,0,0.72)', border:'1px solid rgba(212,175,55,0.45)',
              borderRadius:20, padding: isMobile ? '2px 8px' : '4px 14px',
              fontSize: isMobile ? 8 : 11, fontWeight:700,
              animation: 'trumpShimmer 2.5s ease-in-out infinite',
            }}>
              <span style={{ color:'rgba(255,255,255,0.4)', fontSize: isMobile ? 7 : 9 }}>TRUMP</span>
              <span style={{ color:'#e2d88b', fontSize: isMobile ? 11 : 22 }}>{SUIT_SYMBOLS[trumpSuit]}</span>
              <span style={{ color:'rgba(255,255,255,0.7)' }}>{trumpSuit.toUpperCase()}</span>
            </div>
          )}
          {(phase === 'bidding' || phase === 'playing') && bidState && bidState.currentBid > 0 && (
            <div style={{ background:'rgba(0,0,0,0.6)', border:'1px solid rgba(212,175,55,0.25)', borderRadius:8, padding: isMobile ? '1px 6px' : '2px 9px', fontSize: isMobile ? 8 : 9, color:'#e2d88b', fontWeight:700, whiteSpace:'nowrap' }}>
              {phase === 'playing' ? `Bid Won: ${bidState.currentBid} pts` : `Current Bid: ${bidState.currentBid}`}
              {phase === 'playing' && ` · Trick ${completedTricks.length + (currentTrick?.cards.length === players.length ? 1 : 0)}/${totalTricks}`}
            </div>
          )}
          {phase === 'bidding' && bidState && bidState.bids.length > 0 && (
            <div style={{
              maxHeight:72, overflowY:'auto', display:'flex', flexDirection:'column', gap:2,
              background:'rgba(0,0,0,0.5)', borderRadius:8, padding:'4px 8px',
              border:'1px solid rgba(212,175,55,.15)', minWidth:120,
            }}>
              {[...bidState.bids].slice(-5).reverse().map((b, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', gap:8, fontSize:9 }}>
                  <span style={{ color: b.playerId === myPlayerId ? '#f9d976' : 'rgba(255,255,255,.6)', fontWeight:700 }}>
                    {players.find(p => p.id === b.playerId)?.name ?? '?'}
                  </span>
                  <span style={{ color: b.amount === 'pass' ? 'rgba(255,255,255,.4)' : '#f9d976', fontStyle: b.amount === 'pass' ? 'italic' : 'normal' }}>
                    {b.amount === 'pass' ? 'pass' : b.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
          {(phase === 'playing' || (currentTrick && currentTrick.cards.length > 0)) && (
            <div style={{ marginTop: isMobile ? 2 : 6, marginBottom: isMobile ? 2 : 4 }}>
              <TrickPile trick={currentTrick ?? heldTrick} players={players} trumpSuit={trumpSuit} completedTricksCount={completedTricks.length} totalTricks={totalTricks} />
            </div>
          )}
          {phase === 'playing' && (() => {
            const trickInPlay = currentTrick ?? heldTrick;
            const trickPts = trickInPlay?.cards.reduce((sum, tc) => sum + tc.card.points, 0) ?? 0;
            return (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
                <div style={{ fontSize: isMobile ? 9 : 11, letterSpacing:'1.5px', textTransform:'uppercase', color:'rgba(255,255,255,0.35)', fontWeight:600 }}>Pts</div>
                <div style={{ fontSize: isMobile ? (isLandscape ? 22 : 26) : 42, fontWeight:900, color:'#f9d976', textShadow:'0 0 18px rgba(212,175,55,0.7)', lineHeight:1 }}>
                  {trickPts}
                </div>
              </div>
            );
          })()}
          {!trumpSuit && phase !== 'playing' && (
            <div style={{ opacity:0.35, fontSize:28, color:'#d4a017', lineHeight:1 }}>♠</div>
          )}
        </div>

        {/* DEAL ANIMATION */}
        {showDealAnim && (
          <DealAnimation players={players} myPlayerId={myPlayerId} cardsPerPlayer={cardsPerPlayer} tableW={tableDims.w} tableH={tableDims.h} onCardDealtToMe={handleCardDealtToMe} onComplete={handleDealComplete} />
        )}

        {/* BOTTOM ZONE */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: 'linear-gradient(to top, rgba(0,0,0,.97) 60%, transparent 100%)',
          paddingLeft: isMobile ? 8 : 20,
          paddingRight: isMobile ? 8 : 20,
          paddingBottom: isMobile ? 6 : 12,
          paddingTop: isMobile && isLandscape ? 8 : isMobile ? 10 : 16,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: isMobile && isLandscape ? 3 : 6,
        }}>
          {showDealAnim && <DealHandReveal cards={myHand} revealedCount={dealRevealedCount} />}
          {!showDealAnim && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, paddingTop: isMobile && isLandscape ? 4 : 8, width:'100%' }}>
              {(calledCardSlots.length > 0 ? calledCardSlots.length : calledCards.length) > 0 && phase === 'playing' && (
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {calledCardSlots.length > 0
                    ? (() => {
                        const SUIT_SYM2: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
                        const showOrdinal = deckCount > 1;
                        return calledCardSlots.map((slot, idx) => {
                          const parts = slot.typeId.split('_');
                          const suit = parts[0] as import('@/types').Suit;
                          const rank = parts.slice(1).join('_') as import('@/types').Card['rank'];
                          const isRed = suit === 'hearts' || suit === 'diamonds';
                          const isMyCard = myHand.some((c) => c.suit === suit && c.rank === rank);
                          const ordinalLabel = slot.ordinal === 1 ? '1st' : '2nd';
                          return (
                            <span key={`${slot.typeId}-${slot.ordinal}-${idx}`}
                              className={`inline-flex items-center gap-0.5 text-base font-bold px-2 py-1 rounded-lg border ${isMyCard ? 'text-emerald-300 border-emerald-500/60 bg-emerald-950/50 ring-1 ring-emerald-400/40' : isRed ? 'text-red-400 border-red-700/50 bg-red-950/40' : 'text-slate-200 border-slate-600/50 bg-slate-800/60'}`}
                              title={isMyCard ? 'You hold this partner card!' : undefined}>
                              {showOrdinal && <span className="text-[9px] font-semibold opacity-70 leading-none">{ordinalLabel}</span>}
                              {rank}{SUIT_SYM2[suit]}{isMyCard ? ' ��' : ''}
                            </span>
                          );
                        });
                      })()
                    : calledCards.map((card) => {
                        const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
                        const SUIT_SYM2: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
                        const isMyCard = myHand.some((c) => c.suit === card.suit && c.rank === card.rank);
                        return (
                          <span key={card.id}
                            className={`text-base font-bold px-2 py-1 rounded-lg border ${isMyCard ? 'text-emerald-300 border-emerald-500/60 bg-emerald-950/50 ring-1 ring-emerald-400/40' : isRed ? 'text-red-400 border-red-700/50 bg-red-950/40' : 'text-slate-200 border-slate-600/50 bg-slate-800/60'}`}
                            title={isMyCard ? 'You hold this partner card!' : undefined}>
                            {card.rank}{SUIT_SYM2[card.suit]}{isMyCard ? ' 🤝' : ''}
                          </span>
                        );
                      })
                  }
                </div>
              )}
              <CardHand
                cards={myHand}
                playableCardIds={playableCardIds}
                selectedCardId={selectedCardId}
                onCardSelect={(card) => setSelectedCardId(card.id)}
                onCardPlay={(card) => { setSelectedCardId(null); onPlayCard(card); }}
                isMyTurn={isMyTurn && phase === 'playing'}
                leadSuit={currentTrick?.leadSuit}
                trumpSuit={trumpSuit}
                expandedView={phase === 'bidding'}
                compact={isMobile && isLandscape}
                dimIfNotPlayable={phase !== 'bidding'}
                hidden={effectivelyHidden}
                hideSortButton
                sortTrigger={sortTrigger}
              />
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            alignSelf: 'stretch', gap: 10,
          }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:4, flexShrink:0 }}>
              <div style={{
                display:'flex', alignItems:'center', gap:6,
                background:'rgba(0,0,0,.72)', border:'1px solid rgba(212,175,55,0.4)',
                borderRadius:20, padding: isMobile && isLandscape ? '3px 10px' : '4px 12px',
                fontSize:12, fontWeight:700, whiteSpace:'nowrap',
              }}>
                <span style={{ color:'rgba(255,255,255,.42)', fontSize: isMobile && isLandscape ? 10 : 11 }}>Your pts</span>
                <span style={{ color: getDisplayPoints(myPlayerId) < 0 ? '#f87171' : '#6ee7b7', fontSize: isMobile && isLandscape ? 15 : 17, fontWeight:900 }}>
                  {getDisplayPoints(myPlayerId) > 0 ? '+' : ''}{getDisplayPoints(myPlayerId)}
                </span>
              </div>
              {/* Partner cards — desktop bottom bar */}
              {!isMobile && (calledCardSlots.length > 0 ? calledCardSlots.length : calledCards.length) > 0 && phase === 'playing' && (
                <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap', background:'rgba(0,0,0,.55)', border:'1px solid rgba(212,175,55,0.25)', borderRadius:14, padding:'3px 8px' }}>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)', fontWeight:700, whiteSpace:'nowrap' }}>
                    {bidWinnerId === myPlayerId ? '🤝 Partner:' : '🤝 Partner:'}
                  </span>
                  {calledCardSlots.length > 0
                    ? (() => {
                        const SUIT_SYM2: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
                        const showOrdinal = deckCount > 1;
                        return calledCardSlots.map((slot, idx) => {
                          const parts = slot.typeId.split('_');
                          const suit = parts[0] as import('@/types').Suit;
                          const rank = parts.slice(1).join('_') as import('@/types').Card['rank'];
                          const isRed = suit === 'hearts' || suit === 'diamonds';
                          const isMyCard = myHand.some((c) => c.suit === suit && c.rank === rank);
                          const ordinalLabel = slot.ordinal === 1 ? '1st' : '2nd';
                          return (
                            <span key={`${slot.typeId}-${slot.ordinal}-${idx}`}
                              style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:12, fontWeight:800, padding:'1px 6px', borderRadius:8,
                                border: isMyCard ? '1px solid rgba(52,211,153,0.6)' : isRed ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(148,163,184,0.3)',
                                background: isMyCard ? 'rgba(6,78,59,0.5)' : isRed ? 'rgba(127,29,29,0.4)' : 'rgba(30,41,59,0.5)',
                                color: isMyCard ? '#6ee7b7' : isRed ? '#f87171' : '#e2e8f0',
                              }}
                              title={isMyCard ? 'You hold this partner card!' : undefined}>
                              {showOrdinal && <span style={{ fontSize:8, opacity:0.7 }}>{ordinalLabel}</span>}
                              {rank}{SUIT_SYM2[suit]}{isMyCard ? ' 🤝' : ''}
                            </span>
                          );
                        });
                      })()
                    : calledCards.map((card) => {
                        const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
                        const SUIT_SYM2: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
                        const isMyCard = myHand.some((c) => c.suit === card.suit && c.rank === card.rank);
                        return (
                          <span key={card.id}
                            style={{ display:'inline-flex', alignItems:'center', fontSize:12, fontWeight:800, padding:'1px 6px', borderRadius:8,
                              border: isMyCard ? '1px solid rgba(52,211,153,0.6)' : isRed ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(148,163,184,0.3)',
                              background: isMyCard ? 'rgba(6,78,59,0.5)' : isRed ? 'rgba(127,29,29,0.4)' : 'rgba(30,41,59,0.5)',
                              color: isMyCard ? '#6ee7b7' : isRed ? '#f87171' : '#e2e8f0',
                            }}
                            title={isMyCard ? 'You hold this partner card!' : undefined}>
                            {card.rank}{SUIT_SYM2[card.suit]}{isMyCard ? ' 🤝' : ''}
                          </span>
                        );
                      })
                  }
                </div>
              )}
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, flex:1, justifyContent:'center' }}>
              {showBidPanel && bidState?.currentBidderId === myPlayerId && (
                <>
                  {(() => {
                    const quickBids: number[] = [];
                    for (let v = nextMinBid; v <= maxBid && quickBids.length < 5; v += 10) quickBids.push(v);
                    return quickBids.length > 0 ? (
                      <div style={{ display:'flex', gap:5, alignItems:'center', flexWrap:'wrap', justifyContent:'center' }}>
                        {quickBids.map(amount => (
                          <button key={amount} onClick={() => setBidAmount(amount)}
                            style={{
                              padding: isMobile && isLandscape ? '2px 10px' : '3px 12px',
                              fontSize:12, fontWeight:700, borderRadius:20,
                              border: bidAmount === amount ? '1px solid #d4af37' : '1px solid rgba(212,175,55,0.25)',
                              background: bidAmount === amount ? 'rgba(212,175,55,0.22)' : 'rgba(0,0,0,.5)',
                              color: bidAmount === amount ? '#f9d976' : 'rgba(255,255,255,0.6)',
                              cursor:'pointer', transition:'all .15s',
                            }}
                          >{amount}{amount === maxBid ? ' MAX' : ''}</button>
                        ))}
                      </div>
                    ) : null;
                  })()}
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button onClick={() => onPass?.()}
                      style={{ padding:'0 20px', fontSize:13, fontWeight:800, letterSpacing:'.6px', borderRadius:8, border:'1px solid #991b1b', cursor:'pointer', textTransform:'uppercase', minHeight:44, display:'flex', alignItems:'center', background:'#7f1d1d', color:'#fca5a5' }}>
                      Pass
                    </button>
                    <div style={{ display:'flex', alignItems:'center', gap:3, background:'rgba(0,0,0,.7)', border:'1px solid rgba(212,175,55,0.4)', borderRadius:8, padding:'3px 6px' }}>
                      <button onClick={() => setBidAmount(n => Math.max(nextMinBid, n - 10))}
                        style={{ background:'rgba(255,255,255,.1)', border:'none', color:'#fff', fontSize:17, borderRadius:5, cursor:'pointer', width:28, height:32, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>−</button>
                      <span style={{ color:'#d4af37', fontSize:9, fontWeight:700, padding:'0 2px' }}>BID</span>
                      <input type="number" value={bidAmount} onChange={e => setBidAmount(Number(e.target.value))}
                        style={{ background:'transparent', border:'none', color:'#fff', fontSize:15, fontWeight:800, width:60, textAlign:'center', outline:'none' }} />
                      <button onClick={() => setBidAmount(n => Math.min(maxBid, n + 10))}
                        style={{ background:'rgba(255,255,255,.1)', border:'none', color:'#fff', fontSize:17, borderRadius:5, cursor:'pointer', width:28, height:32, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>+</button>
                    </div>
                    <button onClick={() => onBid?.(bidAmount)}
                      style={{ padding:'0 22px', fontSize:13, fontWeight:800, letterSpacing:'.6px', borderRadius:8, border:'none', cursor:'pointer', textTransform:'uppercase', minHeight:44, display:'flex', alignItems:'center', background:'linear-gradient(135deg,#fffdf0 0%,#f9d976 30%,#e9b646 70%,#9a6b1f 100%)', color:'#1a0d00' }}>
                      Confirm Bid
                    </button>
                  </div>
                </>
              )}
              {showBidPanel && bidState?.currentBidderId !== myPlayerId && (
                <div style={{ color:'rgba(255,255,255,.5)', fontSize:11, fontStyle:'italic' }}>
                  ⏳ Waiting for{' '}
                  <span style={{ color:'#f9d976', fontStyle:'normal', fontWeight:700 }}>
                    {bidState?.currentBidderId
                      ? (players.find(p => p.id === bidState?.currentBidderId)?.name ?? 'player')
                      : 'player'}
                  </span>{' '}to bid…
                </div>
              )}
              {phase === 'playing' && isMyTurn && selectedCardId && (
                <button
                  onClick={() => {
                    const card = myHand.find(c => c.id === selectedCardId);
                    if (card) { setSelectedCardId(null); onPlayCard(card); }
                  }}
                  style={{ padding:'0 28px', fontSize:13, fontWeight:800, letterSpacing:'.6px', borderRadius:8, border:'1px solid #166534', cursor:'pointer', textTransform:'uppercase', minHeight:44, background:'linear-gradient(135deg,#d4af37 0%,#f9d976 50%,#d4af37 100%)', color:'#000', boxShadow:'0 4px 18px rgba(212,175,55,0.4)' }}>
                  ▶ Play Card
                </button>
              )}
            </div>
            <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
              <button onClick={() => setSortTrigger(n => n + 1)} title="Sort cards"
                style={{ width:isMobile && isLandscape ? 30 : 44, height:isMobile && isLandscape ? 30 : 44, borderRadius:8, border:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.07)', color:'rgba(255,255,255,.7)', cursor:'pointer', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>↕</button>
              <button onClick={() => setHandHidden(v => !v)} title={`${handHidden ? 'Show' : 'Hide'} cards (H)`}
                style={{ width:isMobile && isLandscape ? 30 : 44, height:isMobile && isLandscape ? 30 : 44, borderRadius:8, border:'1px solid rgba(255,255,255,.1)', background: handHidden ? 'rgba(217,119,6,.3)' : 'rgba(255,255,255,.07)', color:'#fff', cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {handHidden ? '👁️' : '🙈'}
              </button>
              <div style={{ position:'relative' }}>
                <Scoreboard teams={teams} players={players} bidWinnerId={bidWinnerId} bidAmount={bidState?.currentBid ?? null} trumpSuit={trumpSuit} roundNumber={roundNumber} revealedPartnerIds={revealedPartnerIds} playerTotals={gameState.playerTotals ?? {}} />
              </div>
              <AvatarUpload roomId={gameState.roomId} className="shrink-0" />
            </div>
          </div>
        </div>

      </div>

      {/* FULL-SCREEN OVERLAYS */}
      {showTrumpSelector && (
        <TrumpSelector bidAmount={bidState?.currentBid ?? 0} myHand={myHand} onSelect={(suit) => onSelectTrump!(suit)} />
      )}
      {showPartnerSelector && (
        <PartnerSelector trumpSuit={trumpSuit!} myHand={myHand} partnerCount={partnerCount} deckCount={deckCount} onSelect={(slots) => onSelectPartners!(slots)} />
      )}
      <BlackoutOverlay
        visible={isBlackout}
        onReveal={() => socketEmit.blackoutReveal(gameState.roomId)}
        isHost={myPlayer?.isHost ?? false}
        blackoutCount={blackoutCount}
        blackoutVoterNames={blackoutVoterNames}
        totalPlayers={players.length}
      />
    </div>
  );
}
