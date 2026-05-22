'use client';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Player, Card as CardType } from '@/types';
import AvatarDisplay from '@/components/profile/AvatarDisplay';
import { getCardBack } from '@/config/cardBacks';

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};

const AVATAR_GRADIENTS = [
  'from-purple-600 to-indigo-700',
  'from-blue-600 to-cyan-600',
  'from-emerald-600 to-teal-600',
  'from-orange-600 to-red-600',
  'from-pink-600 to-rose-600',
  'from-amber-500 to-orange-600',
  'from-sky-500 to-blue-600',
  'from-violet-600 to-purple-700',
];

const BACK_GRADIENTS: Record<string, string> = {
  default: 'linear-gradient(135deg, #1a2850, #243f8a)',
  midnight: 'linear-gradient(135deg, #1e1b4b, #4338ca)',
  royal: 'linear-gradient(135deg, #581c87, #7e22ce)',
  neon: 'linear-gradient(135deg, #065f46, #059669)',
  galaxy: 'linear-gradient(135deg, #4c1d95, #6d28d9)',
  gold: 'linear-gradient(135deg, #92400e, #d97706)',
  frost: 'linear-gradient(135deg, #164e63, #0891b2)',
  shadow: 'linear-gradient(135deg, #1f2937, #4b5563)',
  cherry: 'linear-gradient(135deg, #9d174d, #db2777)',
  forest: 'linear-gradient(135deg, #14532d, #15803d)',
  ocean: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
  ember: 'linear-gradient(135deg, #9a3412, #ea580c)',
};

function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return h;
}

interface OpponentStripProps {
  opponents: Player[];
  currentTurnPlayerId: string | null;
  trickCards: { playerId: string; card: CardType }[];
  handCounts: Record<string, number>;
  revealedPartnerIds: string[];
}

export default function OpponentStrip({
  opponents,
  currentTurnPlayerId,
  trickCards,
  handCounts,
  revealedPartnerIds,
}: OpponentStripProps) {
  if (opponents.length === 0) return null;

  return (
    <div
      className="shrink-0 flex items-center justify-center gap-2 px-2 py-1.5 overflow-x-auto"
      style={{
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {opponents.map((player) => {
        const isCurrentTurn = player.id === currentTurnPlayerId;
        const isPartner = revealedPartnerIds.includes(player.id);
        const trickCard = trickCards.find((tc) => tc.playerId === player.id)?.card ?? null;
        const cardCount = handCounts[player.id] ?? 0;
        const isRed = trickCard && (trickCard.suit === 'hearts' || trickCard.suit === 'diamonds');
        const gradient = AVATAR_GRADIENTS[nameHash(player.name) % AVATAR_GRADIENTS.length];
        const hasFrame = player.equippedFrameId && player.equippedFrameId !== 'none';

        return (
          <div
            key={player.id}
            className={clsx('flex flex-col items-center gap-0.5 shrink-0', isCurrentTurn && 'opponent-active-pulse')}
          >
            {/* Trick card played — mini face-up */}
            <AnimatePresence>
              {trickCard ? (
                <motion.div
                  key={trickCard.suit + trickCard.rank}
                  initial={{ scale: 0.5, opacity: 0, y: -8 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                  style={{
                    width: 28, height: 40,
                    background: '#fff',
                    borderRadius: 4,
                    border: '1px solid #ccc',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 1,
                    padding: '2px',
                  }}
                >
                  <span style={{
                    fontSize: 9, fontWeight: 800, lineHeight: 1,
                    color: isRed ? '#c0152a' : '#1a1a2e',
                  }}>
                    {trickCard.rank}
                  </span>
                  <span style={{
                    fontSize: 12, lineHeight: 1,
                    color: isRed ? '#c0152a' : '#1a1a2e',
                  }}>
                    {SUIT_SYMBOLS[trickCard.suit]}
                  </span>
                </motion.div>
              ) : (
                /* Card count badge when no trick card yet */
                <div style={{
                  width: 28, height: 40,
                  background: BACK_GRADIENTS[player.equippedCardBackId ?? 'default'] ?? BACK_GRADIENTS['default'],
                  borderRadius: 4,
                  border: '1px solid rgba(96,165,250,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                    {cardCount}
                  </span>
                </div>
              )}
            </AnimatePresence>

            {/* Avatar */}
            <div
              className={clsx('rounded-full flex items-center justify-center font-bold text-xs text-white',
                !player.avatarUrl && !player.presetAvatarId && `bg-gradient-to-br ${gradient}`
              )}
              style={{
                width: 36, height: 36,
                boxShadow: hasFrame ? undefined
                  : isCurrentTurn ? '0 0 0 2px rgba(34,197,94,0.8), 0 0 10px rgba(34,197,94,0.5)'
                  : isPartner ? '0 0 0 2px rgba(52,211,153,0.6)'
                  : '0 0 0 1px rgba(255,255,255,0.1)',
              }}
            >
              {(player.avatarType === 'preset' || player.presetAvatarId) && !player.avatarUrl ? (
                <AvatarDisplay
                  avatarType={player.avatarType ?? 'preset'}
                  presetAvatarId={player.presetAvatarId ?? 'spade'}
                  equippedFrameId={player.equippedFrameId}
                  size={36}
                />
              ) : player.avatarUrl ? (
                <AvatarDisplay
                  avatarType="upload"
                  avatarUrl={player.avatarUrl}
                  equippedFrameId={player.equippedFrameId}
                  size={36}
                />
              ) : (
                <span style={{ fontSize: 10 }}>{player.name.charAt(0)}</span>
              )}
            </div>

            {/* Name */}
            <span
              className="truncate text-center"
              style={{
                fontSize: 8, maxWidth: 36,
                color: isCurrentTurn ? '#86efac' : 'rgba(200,200,200,0.7)',
                fontWeight: isCurrentTurn ? 700 : 400,
              }}
            >
              {player.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
