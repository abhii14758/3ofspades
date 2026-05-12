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
import DealerFigure from './DealerFigure';
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
  onComplete,
}: {
  players: Player[];
  myPlayerId: string;
  onComplete: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const N = players.length;

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, Math.min(2200, N * 320));
    return () => clearTimeout(timer);
  }, [N, onComplete]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 rounded-[50%] overflow-hidden">
      {players.map((player) => {
        const myIdx = players.findIndex((p) => p.id === myPlayerId);
        const pIdx = players.findIndex((p) => p.id === player.id);
        const relIndex = (pIdx - myIdx + N) % N;
        const angleDeg = 90 + (360 * relIndex) / N;
        const angleRad = (angleDeg * Math.PI) / 180;
        const rx = 46;
        const ry = 43;
        const targetX = 50 + rx * Math.cos(angleRad);
        const targetY = 50 + ry * Math.sin(angleRad);

        return [0, 1, 2].map((j) => (
          <motion.div
            key={`${player.id}-${j}`}
            className="absolute w-7 h-10 rounded-sm shadow-xl"
            style={{
              left: '50%',
              top: '50%',
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)',
              border: '1px solid rgba(96,165,250,0.4)',
            }}
            initial={{ x: '-50%', y: '-50%', opacity: 1, scale: 0.7, rotate: 0 }}
            animate={{
              x: `calc(${targetX - 50}% * 2 - 50%)`,
              y: `calc(${targetY - 50}% * 2 - 50%)`,
              opacity: [1, 1, 0],
              rotate: [(Math.random() - 0.5) * 20],
              scale: [0.7, 1, 0.6],
            }}
            transition={{
              delay: relIndex * 0.14 + j * 0.06,
              duration: 0.42,
              ease: 'easeOut',
            }}
          />
        ));
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
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 160, damping: 26, delay: 0.04 }}
          className="relative"
          style={{
            width: 'min(92vw, 860px)',
            height: 'min(58vh, 540px)',
            minHeight: '280px',
          }}
        >
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
          {/* Center glow */}
          <div
            className="absolute inset-0 rounded-[50%] pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 42% 30% at 50% 50%, rgba(34,197,94,0.07) 0%, transparent 100%)',
            }}
          />

          {/* Dealer figure */}
          {players.length > 1 && (
            <div
              className="absolute z-10"
              style={{ left: '50%', top: '4%', transform: 'translate(-50%, 0)' }}
            >
              <DealerFigure isDealing={phase === 'dealing'} />
            </div>
          )}

          {/* Trump badge + trick counter — center of table */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Center emblem */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 0 }}>
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
  );
}
