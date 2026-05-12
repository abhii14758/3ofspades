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
import ChatPanel from './ChatPanel';
import { useGameStore } from '@/store/gameStore';
import CardHand from '@/components/cards/CardHand';
import AvatarUpload from './AvatarUpload';

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

// ── Player positioning around ellipse ─────────────────────────────────────────
function getPlayerPositions(
  players: Player[],
  myPlayerId: string,
): Array<{ player: Player; x: number; y: number; angle: number }> {
  const N = players.length;
  const rx = 46;
  const ry = 43;
  const cx = 50;
  const cy = 50;
  const myIndex = players.findIndex((p) => p.id === myPlayerId);

  return players.map((player, i) => {
    const relIndex = (i - myIndex + N) % N;
    const angleDeg = 90 + (360 * relIndex) / N;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = cx + rx * Math.cos(angleRad);
    const y = cy + ry * Math.sin(angleRad);
    return { player, x, y, angle: angleDeg };
  });
}

// ── Deal animation ─────────────────────────────────────────────────────────────
function DealAnimation({
  players,
  myPlayerId,
  cardsPerPlayer,
  tableW,
  tableH,
  onComplete,
}: {
  players: Player[];
  myPlayerId: string;
  cardsPerPlayer: number;
  tableW: number;
  tableH: number;
  onComplete: () => void;
}) {
  const N = players.length;
  const CARD_INTERVAL = 0.18; // seconds between each card
  const ROUNDS = Math.min(cardsPerPlayer, 8); // number of rounds to show
  const totalCards = N * ROUNDS;

  useEffect(() => {
    const t = setTimeout(onComplete, totalCards * CARD_INTERVAL * 1000 + 900);
    return () => clearTimeout(t);
  }, [totalCards, onComplete]);

  // Calculate player positions as pixel offsets from table center
  const positions = useMemo(() => {
    const myIdx = players.findIndex((p) => p.id === myPlayerId);
    const rx = 0.46;
    const ry = 0.42;
    return players.map((p, i) => {
      const relIdx = (i - myIdx + N) % N;
      const angleDeg = 90 + (360 * relIdx) / N;
      const angleRad = (angleDeg * Math.PI) / 180;
      const dx = rx * Math.cos(angleRad) * tableW; // px from center
      const dy = ry * Math.sin(angleRad) * tableH;
      return { dx, dy };
    });
  }, [players, myPlayerId, N, tableW, tableH]);

  // Round-robin deal sequence
  const cards = useMemo(() => {
    const result: { key: number; delay: number; playerIdx: number; rotation: number }[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      for (let pi = 0; pi < N; pi++) {
        result.push({
          key: round * N + pi,
          delay: (round * N + pi) * CARD_INTERVAL,
          playerIdx: pi,
          rotation: (Math.random() - 0.5) * 24,
        });
      }
    }
    return result;
  }, [N, ROUNDS]);

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden rounded-[50%]">
      {/* Deck stack at center — face-down blue backs */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 2 }}>
        {[4, 3, 2, 1, 0].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 36, height: 52,
              borderRadius: 5,
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #1d4ed8 100%)',
              border: '1px solid rgba(96,165,250,0.45)',
              boxShadow: '0 3px 10px rgba(0,0,0,0.55)',
              top: -(i * 0.7),
              left: i * 0.3,
            }}
          >
            {/* Card back pattern */}
            <div style={{
              position: 'absolute', inset: 3, borderRadius: 3,
              border: '1px solid rgba(96,165,250,0.25)',
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.03) 3px, rgba(255,255,255,0.03) 6px)',
            }} />
          </div>
        ))}
      </div>

      {/* Flying cards — one at a time, round-robin */}
      {cards.map(({ key, delay, playerIdx, rotation }) => {
        const { dx, dy } = positions[playerIdx];
        return (
          <motion.div
            key={key}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 34,
              height: 50,
              borderRadius: 5,
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #1d4ed8 100%)',
              border: '1px solid rgba(96,165,250,0.45)',
              boxShadow: '0 6px 18px rgba(0,0,0,0.6)',
              zIndex: 10 + key,
            }}
            initial={{ x: '-50%', y: '-50%', opacity: 0, scale: 0.75, rotate: 0 }}
            animate={{
              x: `calc(-50% + ${dx}px)`,
              y: `calc(-50% + ${dy}px)`,
              opacity: [0, 1, 1, 1, 0],
              scale: [0.75, 1.1, 0.9],
              rotate: rotation,
            }}
            transition={{
              delay,
              duration: 0.55,
              ease: [0.16, 1, 0.3, 1],
              opacity: { times: [0, 0.08, 0.6, 0.85, 1], duration: 0.6, delay },
              scale: { times: [0, 0.25, 1], duration: 0.55, delay },
            }}
          >
            {/* Card back inner pattern */}
            <div style={{
              position: 'absolute', inset: 3, borderRadius: 3,
              border: '1px solid rgba(96,165,250,0.25)',
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.04) 3px, rgba(255,255,255,0.04) 6px)',
            }} />
          </motion.div>
        );
      })}
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
  onSelectPartners?: (cardIds: string[]) => void;
  isHost?: boolean;
  onTerminate?: () => void;
  partnerCount?: number;
  maxBid?: number;
  totalTricks?: number;
  turnTimerTotalSeconds?: number;
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
  partnerCount = 2,
  maxBid = 250,
  totalTricks = 8,
  turnTimerTotalSeconds = 30,
}: GameTableProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const handleUnread = useCallback(() => setUnread(n => n + 1), []);
  useEffect(() => { if (chatOpen) setUnread(0); }, [chatOpen]);
  const [dealAnimDone, setDealAnimDone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const myCalledCards = useGameStore((s) => s.myCalledCards);
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
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Reset deal anim when phase changes to dealing
  useEffect(() => {
    if (gameState.phase === 'dealing') setDealAnimDone(false);
  }, [gameState.phase]);

  const handleDealComplete = useCallback(() => setDealAnimDone(true), []);

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

  function getDisplayPoints(playerId: string): number {
    if (revealedTeamAIds.includes(playerId)) return teamACombinedPoints;
    return playerIndividualPoints[playerId] ?? 0;
  }

  function getPlayerTeamId(playerId: string): 'A' | 'B' | null {
    if (!teams) return null;
    if (revealedTeamAIds.includes(playerId)) return 'A';
    return 'B';
  }

  const myPlayer = players.find((p) => p.id === myPlayerId);
  const isMyTurn = currentTurnPlayerId === myPlayerId;
  const currentTurnPlayer = players.find((p) => p.id === currentTurnPlayerId) ?? null;

  const getTrickCard = (playerId: string): CardType | null =>
    currentTrick?.cards.find((c) => c.playerId === playerId)?.card ?? null;

  const playableCardIds: Set<string> | undefined =
    isMyTurn && phase === 'playing' ? new Set(myHand.map((c) => c.id)) : undefined;

  const showBidPanel = phase === 'bidding' && bidState !== null;
  const showTrumpSelector = phase === 'trump_selection' && bidWinnerId === myPlayerId && onSelectTrump;
  const showPartnerSelector = phase === 'partner_selection' && bidWinnerId === myPlayerId && onSelectPartners;
  const showDealAnim = phase === 'dealing' && !dealAnimDone && players.length > 1;
  const cardsPerPlayer = myHand.length > 0 ? myHand.length : Math.ceil((gameState.hands ? Object.values(gameState.hands)[0]?.length ?? 8 : 8));

  const playerPositions = useMemo(
    () => getPlayerPositions(players, myPlayerId),
    [players, myPlayerId]
  );

  return (
    <div
      className="flex flex-row overflow-hidden select-none"
      style={{
        height: '100dvh',
        background: 'radial-gradient(ellipse 140% 100% at 50% 70%, #0f2a0f 0%, #050d05 50%, #000000 100%)',
      }}
    >
      {/* ── Game section ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ y: -44, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="shrink-0 flex items-center gap-2 px-3 py-2 z-20 bg-black/50 backdrop-blur-sm border-b border-white/5"
      >
        {isHost && onTerminate && (
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={onTerminate}
            className="shrink-0 px-2 py-1 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 text-xs rounded-lg font-bold transition-colors"
          >
            🔴 End
          </motion.button>
        )}

        <div className="flex-1 min-w-0">
          <TurnIndicator currentPlayer={currentTurnPlayer} isMyTurn={isMyTurn} />
        </div>

        {turnTimerEndsAt && <TurnTimer endsAt={turnTimerEndsAt} />}

        <div className="shrink-0">
          <Scoreboard
            teams={teams}
            players={players}
            bidWinnerId={bidWinnerId}
            bidAmount={bidState?.currentBid ?? null}
            trumpSuit={trumpSuit}
            roundNumber={roundNumber}
            revealedPartnerIds={revealedPartnerIds}
          />
        </div>

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

        <AvatarUpload roomId={gameState.roomId} className="shrink-0" />
      </motion.div>

      {/* ── Table area ────────────────────────────────────────────────────── */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-0 p-2">

        {/* Ambient ceiling light */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(255,220,100,0.12) 0%, transparent 70%)' }}
        />

        {/* ── Casino Table ── */}
        <motion.div
          ref={tableRef}
          initial={{ scale: 0.88, opacity: 0, rotateX: 0 }}
          animate={{ scale: 1, opacity: 1, rotateX: 14 }}
          transition={{ type: 'spring', stiffness: 160, damping: 26, delay: 0.04 }}
          className="relative"
          style={{
            width: 'min(92vw, 860px)',
            height: 'min(58vh, 540px)',
            minHeight: '280px',
            perspective: '1000px',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* ── Table layers (bottom to top) ── */}
          {/* Outer wood shadow — creates the table "body" depth */}
          <div className="absolute inset-0 rounded-[50%]" style={{
            background: 'linear-gradient(180deg, #6b3010 0%, #3d1808 40%, #200c04 75%, #0a0301 100%)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.95), 0 12px 32px rgba(0,0,0,0.85), 0 0 120px rgba(0,0,0,0.9), inset 0 -8px 20px rgba(0,0,0,0.5)',
          }} />
          {/* Outer gold rail — wide, bright */}
          <div className="absolute inset-[3px] rounded-[50%]" style={{
            background: 'transparent',
            boxShadow: '0 0 0 8px rgba(184,134,11,0.9), 0 0 0 9px rgba(212,160,23,0.5), 0 0 30px rgba(212,160,23,0.5), 0 0 60px rgba(212,160,23,0.15), inset 0 0 0 6px rgba(212,160,23,0.35)',
          }} />
          {/* Inner wood ring between rail and felt */}
          <div className="absolute inset-[16px] rounded-[50%]" style={{
            background: 'linear-gradient(160deg, #5c2a0a 0%, #2d1206 50%, #1a0803 100%)',
          }} />
          {/* Felt surface — vibrant casino green */}
          <div className="absolute inset-[20px] rounded-[50%]" style={{
            background: 'radial-gradient(ellipse at 48% 36%, #27a34a 0%, #1d8038 25%, #156630 55%, #0d4820 80%, #072e14 100%)',
            boxShadow: 'inset 0 24px 70px rgba(0,0,0,0.45), inset 0 -16px 40px rgba(0,0,0,0.35), inset 0 0 80px rgba(0,0,0,0.2)',
          }} />
          {/* Felt cloth texture */}
          <div className="absolute inset-[20px] rounded-[50%] pointer-events-none" style={{
            opacity: 0.04,
            backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 5px,rgba(255,255,255,1) 5px,rgba(255,255,255,1) 6px),repeating-linear-gradient(90deg,transparent,transparent 5px,rgba(255,255,255,1) 5px,rgba(255,255,255,1) 6px)',
          }} />
          {/* Felt top highlight — simulates overhead light */}
          <div className="absolute inset-[20px] rounded-[50%] pointer-events-none" style={{
            background: 'radial-gradient(ellipse 60% 35% at 50% 28%, rgba(255,255,255,0.06) 0%, transparent 100%)',
          }} />
          {/* Gold inner ring on felt edge */}
          <div className="absolute inset-[20px] rounded-[50%] pointer-events-none" style={{
            boxShadow: 'inset 0 0 0 2px rgba(212,160,23,0.18)',
          }} />

          {/* Trump badge + trick counter — center of table */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Center emblem — gold pot circle like reference image */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 0 }}>
              <div style={{
                width: 100, height: 100, borderRadius: '50%',
                border: '3px solid rgba(212,160,23,0.6)',
                background: 'radial-gradient(circle, rgba(212,160,23,0.12) 0%, rgba(212,160,23,0.04) 60%, transparent 100%)',
                boxShadow: '0 0 0 1px rgba(212,160,23,0.2), 0 0 30px rgba(212,160,23,0.2), 0 0 60px rgba(212,160,23,0.08)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              }}>
                <span style={{ fontSize: 20, opacity: 0.55, color: '#d4a017', lineHeight: 1 }}>♠</span>
                <span style={{ fontSize: 9, opacity: 0.5, color: '#d4a017', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>3 of Spades</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2" style={{ position: 'relative', zIndex: 1 }}>
              <AnimatePresence>
                {trumpSuit && (
                  <motion.div
                    key={trumpSuit}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border backdrop-blur-sm',
                      trumpSuit === 'hearts' || trumpSuit === 'diamonds'
                        ? 'text-red-300 border-red-700/50 bg-red-950/70'
                        : 'text-slate-200 border-slate-500/40 bg-slate-900/70'
                    )}
                    style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
                  >
                    <span className="text-base">{SUIT_SYMBOLS[trumpSuit]}</span>
                    <span className="text-xs uppercase tracking-widest opacity-80">Trump</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <TrickPile
                trick={currentTrick}
                players={players}
                trumpSuit={trumpSuit}
                completedTricksCount={completedTricks.length}
                totalTricks={totalTricks}
              />

              {completedTricks.length > 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[11px] text-green-500/70 font-medium tracking-wide"
                >
                  Trick {completedTricks.length + (currentTrick ? 1 : 0)}/{totalTricks}
                </motion.p>
              )}
            </div>
          </div>

          {/* Deal animation overlay */}
          {showDealAnim && (
            <DealAnimation
              players={players}
              myPlayerId={myPlayerId}
              cardsPerPlayer={cardsPerPlayer}
              tableW={tableDims.w}
              tableH={tableDims.h}
              onComplete={handleDealComplete}
            />
          )}

          {/* Player seats around ellipse */}
          {playerPositions.map(({ player, x, y }) => {
            const isCurrentTurn = player.id === currentTurnPlayerId;
            const isPartner = revealedPartnerIds.includes(player.id);
            const cardCount = hands[player.id]?.length ?? 0;
            const trickCard = getTrickCard(player.id);
            const isLocalPlayer = player.id === myPlayerId;

            return (
              <div
                key={player.id}
                className="absolute"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isLocalPlayer ? 2 : 1,
                }}
              >
                <PlayerSeat
                  player={player}
                  cardCount={isLocalPlayer ? myHand.length : cardCount}
                  isCurrentTurn={isCurrentTurn}
                  isLocalPlayer={isLocalPlayer}
                  isPartner={isPartner}
                  isRevealed={isPartner}
                  trickCard={trickCard}
                  position="bottom"
                  compact={isMobile}
                  displayPoints={getDisplayPoints(player.id)}
                  teamId={getPlayerTeamId(player.id)}
                  turnTimerEndsAt={isCurrentTurn ? turnTimerEndsAt : null}
                  turnTimerTotalSeconds={turnTimerTotalSeconds}
                />
              </div>
            );
          })}
        </motion.div>

        {/* Bid panel */}
        {showBidPanel && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 w-full max-w-xs px-2">
            <BidPanel
              bidState={bidState!}
              players={players}
              myPlayerId={myPlayerId}
              isMyTurn={bidState?.currentBidderId === myPlayerId}
              onBid={onBid ?? (() => {})}
              onPass={onPass ?? (() => {})}
              maxBid={maxBid}
            />
          </div>
        )}
      </div>

      {/* ── Card hand ─────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 z-10 pt-2 pb-3"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 100%)' }}
      >
        {calledCards.length > 0 && phase === 'playing' && (
          <div className="flex items-center justify-center gap-2 mb-2 px-4 flex-wrap">
            <span className="text-[10px] text-slate-400 shrink-0 font-medium">
              {bidWinnerId === myPlayerId ? '🤝 Your partner cards:' : '🤝 Partner cards:'}
            </span>
            {calledCards.map((card) => {
              const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
              const SUIT_SYM: Record<string, string> = {
                spades: '♠',
                hearts: '♥',
                diamonds: '♦',
                clubs: '♣',
              };
              const isMyCard = myHand.some(
                (c) => c.suit === card.suit && c.rank === card.rank
              );
              return (
                <span
                  key={card.id}
                  className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                    isMyCard
                      ? 'text-emerald-300 border-emerald-500/60 bg-emerald-950/50 ring-1 ring-emerald-400/40'
                      : isRed
                      ? 'text-red-400 border-red-700/50 bg-red-950/40'
                      : 'text-slate-200 border-slate-600/50 bg-slate-800/60'
                  }`}
                  title={isMyCard ? 'You hold this partner card!' : undefined}
                >
                  {card.rank}
                  {SUIT_SYM[card.suit]}
                  {isMyCard ? ' 🤝' : ''}
                </span>
              );
            })}
          </div>
        )}
        <CardHand
          cards={myHand}
          playableCardIds={playableCardIds}
          selectedCardId={selectedCardId}
          onCardSelect={(card) => setSelectedCardId(card.id)}
          onCardPlay={(card) => {
            setSelectedCardId(null);
            onPlayCard(card);
          }}
          isMyTurn={isMyTurn && phase === 'playing'}
          leadSuit={currentTrick?.leadSuit}
          trumpSuit={trumpSuit}
        />
      </div>

      {/* ── Full-screen overlays ──────────────────────────────────────────── */}
      {showTrumpSelector && (
        <TrumpSelector
          bidAmount={bidState?.currentBid ?? 0}
          myHand={myHand}
          onSelect={(suit) => onSelectTrump!(suit)}
        />
      )}
      {showPartnerSelector && (
        <PartnerSelector
          trumpSuit={trumpSuit!}
          myHand={myHand}
          partnerCount={partnerCount}
          onSelect={(ids) => onSelectPartners!(ids)}
        />
      )}
      </div>{/* end flex-1 game section */}

      {/* ── Desktop chat panel — always mounted, CSS width transition ── */}
      {!isMobile && (
        <div
          className="shrink-0 flex flex-col border-l border-slate-700/60 overflow-hidden"
          style={{
            width: chatOpen ? 280 : 0,
            transition: 'width 0.32s cubic-bezier(0.4,0,0.2,1)',
            minWidth: 0,
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 bg-slate-800/80 border-b border-slate-700 shrink-0"
            style={{ width: 280 }}
          >
            <span className="text-sm font-semibold text-slate-200">💬 Chat</span>
            <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-white text-lg leading-none">&times;</button>
          </div>
          <div className="flex-1 min-h-0" style={{ width: 280 }}>
            <ChatPanel
              roomId={gameState.roomId}
              myPlayerId={myPlayerId}
              myPlayerName={myPlayer?.name ?? ''}
              onUnreadChange={handleUnread}
            />
          </div>
        </div>
      )}

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
              className="fixed bottom-0 inset-x-0 z-50 rounded-t-2xl border-t border-slate-700 flex flex-col"
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
  );
}
