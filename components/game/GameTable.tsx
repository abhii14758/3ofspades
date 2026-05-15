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
import LandscapeCardColumn from './LandscapeCardColumn';
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
function getSeatPosition(seatIndex: number, totalSeats: number): { x: number; y: number } {
  const SEAT_MAPS: Record<number, Array<[number, number]>> = {
    4: [
      [50, 90], // 0 bottom-center
      [10, 50], // 1 left
      [50, 10], // 2 top-center
      [90, 50], // 3 right
    ],
    6: [
      [50, 89], // 0 bottom-center
      [11, 70], // 1 bottom-left
      [11, 30], // 2 top-left
      [50, 10], // 3 top-center
      [89, 30], // 4 top-right
      [89, 70], // 5 bottom-right
    ],
    8: [
      [50, 90], // 0 bottom-center
      [18, 78], // 1 bottom-left
      [8,  50], // 2 mid-left
      [18, 22], // 3 top-left
      [50, 10], // 4 top-center
      [82, 22], // 5 top-right
      [92, 50], // 6 mid-right
      [82, 78], // 7 bottom-right
    ],
    10: [
      [50, 92], // 0 bottom-center
      [24, 87], // 1 bottom-left
      [8,  68], // 2 mid-left
      [7,  32], // 3 far-left
      [24, 13], // 4 top-left
      [50, 7],  // 5 top-center
      [76, 13], // 6 top-right
      [93, 32], // 7 far-right
      [92, 68], // 8 mid-right
      [76, 87], // 9 bottom-right
    ],
  };

  const map = SEAT_MAPS[totalSeats] ?? SEAT_MAPS[6];
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
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden rounded-[50%]">
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
  const isRed = (suit: string) => suit === 'hearts' || suit === 'diamonds';

  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">
        Dealing your cards…
      </p>
      <div className="flex items-end justify-center gap-1 flex-wrap px-4">
        <AnimatePresence mode="popLayout">
          {visible.map((card, idx) => (
            <motion.div
              key={card.id}
              layout
              initial={{ rotateY: 90, opacity: 0, y: 20, scale: 0.8 }}
              animate={{ rotateY: 0, opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28, delay: 0.04 }}
              style={{ perspective: 600 }}
            >
              <div
                className="flex flex-col items-center justify-between rounded-lg select-none overflow-hidden"
                style={{
                  width: 48, height: 70,
                  background: '#ffffff',
                  border: isRed(card.suit)
                    ? '1.5px solid #ffb3b3'
                    : '1.5px solid #c0c8d8',
                  boxShadow: idx === visible.length - 1
                    ? '0 0 14px rgba(212,160,23,0.6), 0 4px 16px rgba(0,0,0,0.5)'
                    : '0 3px 10px rgba(0,0,0,0.4)',
                  padding: '3px 4px',
                }}
              >
                {/* Top-left */}
                <div style={{ alignSelf: 'flex-start', lineHeight: 1.1 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 800,
                    color: isRed(card.suit) ? '#c0152a' : '#1a1a2e',
                    lineHeight: 1
                  }}>
                    {RANK_DISPLAY[card.rank] ?? card.rank}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: isRed(card.suit) ? '#c0152a' : '#1a1a2e',
                    lineHeight: 1
                  }}>
                    {SUIT_SYM[card.suit]}
                  </div>
                </div>
                {/* Center */}
                <div style={{
                  fontSize: 18, lineHeight: 1,
                  color: isRed(card.suit) ? '#c0152a' : '#1a1a2e'
                }}>
                  {SUIT_SYM[card.suit]}
                </div>
                {/* Bottom-right rotated */}
                <div style={{
                  alignSelf: 'flex-end', lineHeight: 1.1,
                  transform: 'rotate(180deg)'
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 800,
                    color: isRed(card.suit) ? '#c0152a' : '#1a1a2e',
                    lineHeight: 1
                  }}>
                    {RANK_DISPLAY[card.rank] ?? card.rank}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: isRed(card.suit) ? '#c0152a' : '#1a1a2e',
                    lineHeight: 1
                  }}>
                    {SUIT_SYM[card.suit]}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {/* Placeholder slots for undealt cards */}
        {Array.from({ length: Math.max(0, cards.length - visible.length) }).map((_, i) => (
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
    <div style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(0,0,0,0.72)', border:'1px solid rgba(212,175,55,0.4)', borderRadius:20, padding:'4px 10px', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>
      <span style={{ color:'rgba(255,255,255,0.42)', fontSize:9 }}>{label}</span>
      <span style={{ color: valueColor ?? '#fff' }}>{value}</span>
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
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  // Held trick — keeps last full trick visible for 5s after it completes
  const [heldTrick, setHeldTrick] = useState<typeof gameState.currentTrick>(null);
  const myCalledCards = useGameStore((s) => s.myCalledCards);
  const myCalledCardSlots = useGameStore((s) => s.myCalledCardSlots);
  const tableRef = useRef<HTMLDivElement>(null);

  const [tableDims, setTableDims] = useState({ w: 860, h: 540 });
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

  return (
    <div
      className="flex overflow-hidden select-none"
      style={{
        height: '100dvh',
        flexDirection: (isMobile && !isLandscape) ? 'column' : 'row',
        background: 'radial-gradient(ellipse 160% 120% at 50% 60%, #071507 0%, #020802 40%, #000000 100%)',
      }}
    >
      {/* ── Game section ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ position: 'relative' }}>

        {/* ── TOP BAR (all layouts) ── */}
        <motion.div
          initial={{ y: -44, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          className="shrink-0 flex items-center gap-2 z-20 bg-black/50 backdrop-blur-sm border-b border-white/5"
          style={{ padding: isMobile && isLandscape ? '2px 8px' : '8px 12px' }}
        >
          {isHost && onTerminate && (
            <motion.button whileTap={{ scale: 0.93 }} onClick={onTerminate}
              className="shrink-0 px-2 py-1 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 text-xs rounded-lg font-bold transition-colors">
              🔴 End
            </motion.button>
          )}
          {!isHost && onLeave && (
            <motion.button whileTap={{ scale: 0.93 }} onClick={onLeave}
              className="shrink-0 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs rounded-lg font-bold transition-colors">
              ← Leave
            </motion.button>
          )}
          <VotePanel roomId={gameState.roomId} myPlayerId={myPlayerId} voteEndVotes={gameState.voteEndVotes ?? {}} totalPlayers={players.length} />
          <AnimatePresence>
            {isHost && showDealAnim && (
              <motion.button initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.85 }} whileTap={{ scale:0.93 }}
                onClick={handleSkipDeal}
                className="shrink-0 px-2.5 py-1 bg-amber-900/80 hover:bg-amber-800 border border-amber-600/60 text-amber-300 text-xs rounded-lg font-bold transition-colors">
                ⏭ Skip Deal
              </motion.button>
            )}
          </AnimatePresence>
          <div className="flex-1 min-w-0">
            <TurnIndicator currentPlayer={currentTurnPlayer} isMyTurn={isMyTurn} />
          </div>
          {turnTimerEndsAt && <TurnTimer endsAt={turnTimerEndsAt} />}
          <div className="shrink-0">
            <Scoreboard teams={teams} players={players} bidWinnerId={bidWinnerId} bidAmount={bidState?.currentBid ?? null} trumpSuit={trumpSuit} roundNumber={roundNumber} revealedPartnerIds={revealedPartnerIds} playerTotals={gameState.playerTotals ?? {}} />
          </div>
          <AvatarUpload roomId={gameState.roomId} className="shrink-0" />
        </motion.div>

        {/* ── LEFT HUD (desktop only, position:absolute) ── */}
        {!isMobile && (
          <div style={{ position:'absolute', top:52, left:16, zIndex:50, display:'flex', flexDirection:'column', gap:5 }}>
            <HudPill label="Round" value={`${roundNumber ?? 1} / ∞`} />
            <HudPill label="Team A" value={teamACombinedPoints} valueColor="#6ee7b7" />
            <HudPill label="Team B" value={teamBCombinedPoints} valueColor="#fca5a5" />
          </div>
        )}

        {/* ── RIGHT HUD (desktop only, position:absolute) ── */}
        {!isMobile && (
          <div style={{ position:'absolute', top:52, right:16, zIndex:50, display:'flex', flexDirection:'column', gap:5, alignItems:'flex-end' }}>
            <HudPill label="Target" value="500 pts" />
            {phase === 'playing' && (
              <HudPill label="Trick" value={`${completedTricks.length + 1}/${totalTricks}`} />
            )}
          </div>
        )}

        {/* ── MIDDLE: table area ── */}
        <div className="flex-1 relative flex items-center justify-center min-h-0 p-1"
             style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 40%, #0a0f0a 0%, #050808 60%, #020404 100%)', overflow: 'visible' }}>

          {/* Overhead casino lamp glow */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(255,230,120,0.16) 0%, rgba(255,200,60,0.07) 40%, transparent 70%)',
          }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse 30% 60% at 0% 50%, rgba(20,80,20,0.08) 0%, transparent 70%), radial-gradient(ellipse 30% 60% at 100% 50%, rgba(20,80,20,0.08) 0%, transparent 70%)',
          }} />

          {/* ── Casino Table oval ── */}
          <motion.div
            ref={tableRef}
            initial={{ scale: 0.88, opacity: 0, rotateX: 0 }}
            animate={{ scale: 1, opacity: 1, rotateX: isMobile ? 0 : 18 }}
            transition={{ type: 'spring', stiffness: 160, damping: 26, delay: 0.04 }}
            className="relative"
            style={{
              width: isMobile ? (isLandscape ? '96vw' : '96vw') : isTablet ? 'min(94vw, 760px)' : 'min(94vw, 920px)',
              height: isMobile ? (isLandscape ? 'min(85vh, 320px)' : 'auto') : isTablet ? 'min(50vh, 380px)' : 'min(52vh, 480px)',
              aspectRatio: isMobile && !isLandscape ? '5/3' : undefined,
              minHeight: isMobile ? (isLandscape ? '180px' : '200px') : '260px',
              overflow: 'visible',
              ...(!isMobile ? { perspective: '900px', transformStyle: 'preserve-3d' as const } : {}),
            }}
          >
            {/* Table physical body */}
            <div className="absolute rounded-[50%]" style={{
              inset: 0,
              background: 'linear-gradient(175deg, #4a1e08 0%, #1a0a02 45%, #0a0300 100%)',
              boxShadow: ['0 50px 100px rgba(0,0,0,0.98)','0 20px 60px rgba(0,0,0,0.95)','0 0 0 1px rgba(0,0,0,0.8)','inset 0 -30px 60px rgba(0,0,0,0.7)'].join(', '),
              transform: 'translateY(12px) scaleX(0.96)',
            }} />
            {/* Wood/mahogany rail base */}
            <div className="absolute rounded-[50%]" style={{
              inset: 0,
              background: 'radial-gradient(ellipse at 50% 40%, #7a3510 0%, #4a1e08 40%, #2a0e04 70%, #0f0401 100%)',
              boxShadow: '0 0 80px rgba(0,0,0,0.9), 0 30px 60px rgba(0,0,0,0.8)',
            }} />
            {/* Gold bead rail */}
            <div className="absolute rounded-[50%]" style={{
              inset: '4px',
              background: 'transparent',
              boxShadow: ['0 0 0 10px rgba(180,130,10,0.95)','0 0 0 11px rgba(230,175,20,0.7)','0 0 0 13px rgba(150,100,5,0.5)','0 0 40px rgba(212,160,23,0.6)','0 0 80px rgba(212,160,23,0.25)','inset 0 0 0 10px rgba(180,130,10,0.3)'].join(', '),
            }} />
            {/* Wood channel between rail and felt */}
            <div className="absolute rounded-[50%]" style={{
              inset: '18px',
              background: 'linear-gradient(160deg, #3d1a06 0%, #1e0b02 60%, #0f0501 100%)',
              boxShadow: 'inset 0 4px 16px rgba(0,0,0,0.8)',
            }} />
            {/* Felt surface */}
            <div className="absolute rounded-[50%]" style={{
              inset: '26px',
              background: ['radial-gradient(ellipse at 50% 35%,','#2db84d 0%,','#23943e 20%,','#1a7a32 45%,','#125928 70%,','#0a3a1a 100%)'].join(' '),
              boxShadow: ['inset 0 30px 80px rgba(0,0,0,0.5)','inset 0 -20px 50px rgba(0,0,0,0.4)','inset 30px 0 60px rgba(0,0,0,0.25)','inset -30px 0 60px rgba(0,0,0,0.25)'].join(', '),
            }} />
            {/* Felt weave texture */}
            <div className="absolute rounded-[50%] pointer-events-none" style={{
              inset: '26px', opacity: 0.035,
              backgroundImage: ['repeating-linear-gradient(0deg, transparent, transparent 5px,','rgba(255,255,255,1) 5px, rgba(255,255,255,1) 6px),','repeating-linear-gradient(90deg, transparent, transparent 5px,','rgba(255,255,255,1) 5px, rgba(255,255,255,1) 6px)'].join(' '),
            }} />
            {/* Top highlight */}
            <div className="absolute rounded-[50%] pointer-events-none" style={{
              inset: '26px',
              background: 'radial-gradient(ellipse 55% 30% at 50% 25%, rgba(255,255,255,0.07) 0%, transparent 100%)',
            }} />
            {/* Gold inner felt edge ring */}
            <div className="absolute rounded-[50%] pointer-events-none" style={{
              inset: '26px',
              boxShadow: 'inset 0 0 0 2px rgba(212,160,23,0.15), inset 0 0 20px rgba(0,0,0,0.3)',
            }} />
            {/* Subtle gold zone lines on felt */}
            <div className="absolute rounded-[50%] pointer-events-none" style={{
              inset: '52px',
              border: '1px solid rgba(212,160,23,0.18)',
              boxShadow: 'inset 0 0 0 1px rgba(212,160,23,0.08)',
            }} />

            {/* ── NEW TABLE CENTER ── */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: isMobile ? 3 : 5, position:'relative', zIndex:1 }}>
                <div style={{ fontSize: isMobile ? 9 : 13, fontWeight:900, letterSpacing: isMobile ? '1.5px' : '2px', background:'linear-gradient(135deg,#fffdf0 0%,#f9d976 30%,#e9b646 70%,#9a6b1f 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                  3 ♠ SPADES
                </div>
                {trumpSuit && (
                  <div style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(0,0,0,0.72)', border:'1px solid rgba(212,175,55,0.4)', borderRadius:20, padding: isMobile ? '2px 8px' : '3px 10px', fontSize: isMobile ? 8 : 10, fontWeight:700 }}>
                    <span style={{ color:'rgba(255,255,255,0.42)', fontSize: isMobile ? 7 : 9 }}>TRUMP</span>
                    <span style={{ color:'#e2d88b', fontSize: isMobile ? 11 : 14 }}>{SUIT_SYMBOLS[trumpSuit]}</span>
                    <span>{trumpSuit.toUpperCase()}</span>
                  </div>
                )}
                {(phase === 'bidding' || phase === 'playing') && bidState && bidState.currentBid > 0 && (
                  <div style={{ background:'rgba(0,0,0,0.6)', border:'1px solid rgba(212,175,55,0.25)', borderRadius:8, padding: isMobile ? '1px 6px' : '2px 9px', fontSize: isMobile ? 8 : 9, color:'#e2d88b', fontWeight:700, whiteSpace:'nowrap' }}>
                    {phase === 'playing' ? `Bid Won: ${bidState.currentBid} pts` : `Current Bid: ${bidState.currentBid}`}
                    {phase === 'playing' && ` · Trick ${completedTricks.length + (currentTrick?.cards.length === players.length ? 1 : 0)}/${totalTricks}`}
                  </div>
                )}
                {(phase === 'playing' || (currentTrick && currentTrick.cards.length > 0)) && (
                  <TrickPile trick={currentTrick ?? heldTrick} players={players} trumpSuit={trumpSuit} completedTricksCount={completedTricks.length} totalTricks={totalTricks} />
                )}
                {phase === 'playing' && (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                    <div style={{ fontSize: isMobile ? 7 : 8, letterSpacing:'1px', textTransform:'uppercase', color:'rgba(255,255,255,0.4)', fontWeight:600 }}>Collected Pts</div>
                    <div style={{ fontSize: isMobile ? 16 : 22, fontWeight:900, color:'#f9d976', textShadow:'0 0 14px rgba(212,175,55,0.65)', letterSpacing:'1px' }}>
                      {Object.values(playerIndividualPoints).reduce((a, b) => a + Math.max(0, b), 0)}
                    </div>
                  </div>
                )}
                {!trumpSuit && phase !== 'playing' && (
                  <div style={{ opacity:0.35, fontSize:28, color:'#d4a017', lineHeight:1 }}>♠</div>
                )}
              </div>
            </div>

            {/* Deal animation overlay */}
            {showDealAnim && (
              <DealAnimation players={players} myPlayerId={myPlayerId} cardsPerPlayer={cardsPerPlayer} tableW={tableDims.w} tableH={tableDims.h} onCardDealtToMe={handleCardDealtToMe} onComplete={handleDealComplete} />
            )}

            {/* Player seats */}
            {players.map((player) => {
              const myPlayerLocal = players.find((p) => p.id === myPlayerId);
              const mySeatIdx = myPlayerLocal?.seatIndex ?? 0;
              const relativeSeatIdx = (player.seatIndex - mySeatIdx + players.length) % players.length;
              const { x, y } = getSeatPosition(relativeSeatIdx, players.length);
              const isCurrentTurn = player.id === currentTurnPlayerId;
              const isPartner = revealedPartnerIds.includes(player.id);
              const cardCount = hands[player.id]?.length ?? 0;
              const trickCard = getTrickCard(player.id);
              const isLocalPlayer = player.id === myPlayerId;
              return (
                <div key={player.id} className="absolute" style={{ left:`${x}%`, top:`${y}%`, transform:'translate(-50%, -50%)', zIndex: isLocalPlayer ? 2 : 1 }}>
                  <PlayerSeat player={player} cardCount={isLocalPlayer ? myHand.length : cardCount} isCurrentTurn={isCurrentTurn} isLocalPlayer={isLocalPlayer} isPartner={isPartner} isRevealed={isPartner} isBidWinner={player.id === bidWinnerId && !!bidWinnerId} trickCard={trickCard} position="bottom" compact={isMobile} extraCompact={isMobile && isLandscape} displayPoints={getDisplayPoints(player.id)} teamId={getPlayerTeamId(player.id)} turnTimerEndsAt={isCurrentTurn ? turnTimerEndsAt : null} turnTimerTotalSeconds={turnTimerTotalSeconds} showCombinedLabel={allPartnersRevealed && teamBIds.includes(player.id)} />
                </div>
              );
            })}
          </motion.div>

          {/* Partner slot tracker */}
          {phase === 'playing' && myPlayerId === bidWinnerId && myCalledCardSlots.length > 0 && (
            <PartnerTracker slots={myCalledCardSlots} players={players} bidWinnerId={bidWinnerId!} />
          )}

          {/* Table legs */}
          <div className="absolute pointer-events-none" style={{ left:'50%', transform:'translateX(-50%)', bottom:'calc(50% - min(26vh, 240px) - 30px)', width:'min(80vw, 780px)', zIndex:0 }}>
            <div style={{ position:'absolute', left:'10%', right:'10%', top:8, height:40, borderRadius:'50%', background:'radial-gradient(ellipse at 50% 0%, rgba(200,120,10,0.55) 0%, rgba(160,80,5,0.25) 40%, transparent 75%)', filter:'blur(6px)' }} />
            {[{ left:'18%' },{ left:'36%' },{ left:'64%' },{ left:'82%' }].map((pos, i) => (
              <div key={i} style={{ position:'absolute', top:0, left:pos.left, width:18, height:48, transform:'translateX(-50%)', background:'linear-gradient(180deg, #5a2008 0%, #2a0e04 50%, #0f0501 100%)', borderRadius:'0 0 4px 4px', boxShadow:'2px 0 6px rgba(0,0,0,0.7), -2px 0 6px rgba(0,0,0,0.5), inset 2px 0 4px rgba(255,160,60,0.07)' }} />
            ))}
          </div>

        </div>{/* end table area */}

        {/* ── BOTTOM ZONE (card hand + bid actions) ── */}
        <div className="shrink-0 z-10" style={{ background:'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 100%)', paddingBottom: isMobile && isLandscape ? '4px' : '12px', position:'relative' }}>

          {/* BidPanel — inline above hand */}
          {showBidPanel && (
            <div style={{ position:'relative', width:'100%', display:'flex', justifyContent:'center', paddingTop:6, paddingBottom:4 }}>
              <div style={{ width:'min(400px, 90vw)' }}>
                <BidPanel bidState={bidState!} players={players} myPlayerId={myPlayerId} isMyTurn={bidState?.currentBidderId === myPlayerId} onBid={onBid ?? (() => {})} onPass={onPass ?? (() => {})} maxBid={maxBid} />
              </div>
            </div>
          )}

          {/* Deal animation hand reveal */}
          {showDealAnim && (
            <DealHandReveal cards={myHand} revealedCount={dealRevealedCount} />
          )}

          {/* Normal hand */}
          {!showDealAnim && (
            <>
              <div className="flex items-center justify-center pt-1 pb-0.5">
                <button onClick={() => setHandHidden(v => !v)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-semibold transition-all ${handHidden ? 'bg-amber-900/70 border-amber-600/70 text-amber-300 shadow-[0_0_8px_rgba(217,119,6,0.3)]' : 'bg-slate-800/80 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-500/70'}`}
                  title={`${handHidden ? 'Show' : 'Hide'} cards (H)`}
                >
                  <span>{handHidden ? '👁️' : '🙈'}</span>
                  <span>{handHidden ? 'Show' : 'Hide'}</span>
                  <kbd className="ml-1 text-[9px] px-1 py-0.5 rounded bg-slate-700/60 border border-slate-600/50 text-slate-500 font-mono">H</kbd>
                </button>
              </div>
              {(calledCardSlots.length > 0 ? calledCardSlots.length : calledCards.length) > 0 && phase === 'playing' && (
                <div className="flex items-center justify-center gap-1.5 mb-1.5 px-3 flex-wrap">
                  <span className="text-xs text-slate-400 shrink-0 font-medium">
                    {bidWinnerId === myPlayerId ? '🤝 Your partner cards:' : '🤝 Partner cards:'}
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
                              className={`inline-flex items-center gap-0.5 text-sm font-bold px-1.5 py-0.5 rounded border ${isMyCard ? 'text-emerald-300 border-emerald-500/60 bg-emerald-950/50 ring-1 ring-emerald-400/40' : isRed ? 'text-red-400 border-red-700/50 bg-red-950/40' : 'text-slate-200 border-slate-600/50 bg-slate-800/60'}`}
                              title={isMyCard ? 'You hold this partner card!' : undefined}>
                              {showOrdinal && <span className="text-[9px] font-semibold opacity-70 leading-none">{ordinalLabel}</span>}
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
                            className={`text-sm font-bold px-1.5 py-0.5 rounded border ${isMyCard ? 'text-emerald-300 border-emerald-500/60 bg-emerald-950/50 ring-1 ring-emerald-400/40' : isRed ? 'text-red-400 border-red-700/50 bg-red-950/40' : 'text-slate-200 border-slate-600/50 bg-slate-800/60'}`}
                            title={isMyCard ? 'You hold this partner card!' : undefined}>
                            {card.rank}{SUIT_SYM2[card.suit]}{isMyCard ? ' 🤝' : ''}
                          </span>
                        );
                      })
                  }
                </div>
              )}
              <div className="relative overflow-hidden" style={{ minHeight: isMobile && isLandscape ? '80px' : '120px' }}>
                <CardHand cards={myHand} playableCardIds={playableCardIds} selectedCardId={selectedCardId} onCardSelect={(card) => setSelectedCardId(card.id)} onCardPlay={(card) => { setSelectedCardId(null); onPlayCard(card); }} isMyTurn={isMyTurn && phase === 'playing'} leadSuit={currentTrick?.leadSuit} trumpSuit={trumpSuit} expandedView={phase === 'bidding'} compact={isMobile} dimIfNotPlayable={phase !== 'bidding'} hidden={effectivelyHidden} />
              </div>
            </>
          )}
        </div>

        {/* ── Full-screen overlays ── */}
        {showTrumpSelector && (
          <TrumpSelector bidAmount={bidState?.currentBid ?? 0} myHand={myHand} onSelect={(suit) => onSelectTrump!(suit)} />
        )}
        {showPartnerSelector && (
          <PartnerSelector trumpSuit={trumpSuit!} myHand={myHand} partnerCount={partnerCount} deckCount={deckCount} onSelect={(slots) => onSelectPartners!(slots)} />
        )}

      </div>{/* end flex-1 game section */}
    </div>
  );
}
