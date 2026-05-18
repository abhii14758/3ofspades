'use client';
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Suit, Rank, Card as CardType } from '@/types';

const SUIT_SYMBOLS: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const SUIT_LABELS: Record<Suit, string> = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
const ALL_SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const ALL_RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

interface SlotEntry { typeId: string; ordinal: 1 | 2; }

interface PartnerSelectorProps {
  onSelect: (slots: SlotEntry[]) => void;
  trumpSuit: Suit;
  myHand: CardType[];
  partnerCount?: number;
  deckCount?: number;
}

function useViewport() {
  const [vp, setVp] = useState({ isMobilePortrait: false, isMobileLandscape: false });
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const landscape = w > h && h < 520;
      const portrait = w < 640 && !landscape;
      setVp({ isMobilePortrait: portrait, isMobileLandscape: landscape });
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => { window.removeEventListener('resize', check); window.removeEventListener('orientationchange', check); };
  }, []);
  return vp;
}

export default function PartnerSelector({
  onSelect, trumpSuit, myHand, partnerCount = 2, deckCount = 1,
}: PartnerSelectorProps) {
  const [selectedSlots, setSelectedSlots] = useState<SlotEntry[]>([]);
  const [pendingCard, setPendingCard] = useState<string | null>(null);
  const [activeSuit, setActiveSuit] = useState<Suit>(trumpSuit);
  const { isMobilePortrait, isMobileLandscape } = useViewport();

  const myHandTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of myHand) { const t = `${c.suit}_${c.rank}`; counts[t] = (counts[t] ?? 0) + 1; }
    return counts;
  }, [myHand]);

  const isRed = (suit: Suit) => suit === 'hearts' || suit === 'diamonds';
  const isComplete = selectedSlots.length === partnerCount;
  const getSlotsForTypeId = (typeId: string) => selectedSlots.filter(s => s.typeId === typeId);

  const handleCardClick = (typeId: string) => {
    const heldCount = myHandTypeCounts[typeId] ?? 0;
    const maxSelectable = deckCount - heldCount;
    if (maxSelectable <= 0) return;
    const currentSlots = selectedSlots.filter(s => s.typeId === typeId);
    const canAddAnother = currentSlots.length < maxSelectable && selectedSlots.length < partnerCount;
    if (currentSlots.length > 0 && !canAddAnother) { setSelectedSlots(prev => prev.filter(s => s.typeId !== typeId)); return; }
    if (currentSlots.length === 0 && selectedSlots.length >= partnerCount) return;
    if (deckCount === 1) {
      if (currentSlots.length > 0) setSelectedSlots(prev => prev.filter(s => s.typeId !== typeId));
      else setSelectedSlots(prev => [...prev, { typeId, ordinal: 1 }]);
    } else { setPendingCard(typeId); }
  };

  const handleOrdinalSelect = (ordinal: 1 | 2) => {
    if (!pendingCard) return;
    if (selectedSlots.some(s => s.typeId === pendingCard && s.ordinal === ordinal)) return;
    setSelectedSlots(prev => [...prev, { typeId: pendingCard, ordinal }]);
    setPendingCard(null);
  };

  // ─── Render helpers ──────────────────────────────────────────────────

  const renderSelectedChips = () => selectedSlots.length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {selectedSlots.map((slot, i) => {
        const [suit, rank] = slot.typeId.split('_') as [Suit, Rank];
        return (
          <span key={i} className={clsx(
            'inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full border',
            isRed(suit) ? 'bg-red-950/60 border-red-700 text-red-300' : 'bg-slate-800 border-slate-600 text-slate-200'
          )}>
            {rank}{SUIT_SYMBOLS[suit]}
            {deckCount === 2 && <span className="ml-0.5 text-[9px] text-slate-400">({slot.ordinal === 1 ? '1st' : '2nd'})</span>}
          </span>
        );
      })}
    </div>
  ) : null;

  const renderConfirmButton = (compact: boolean) => (
    <motion.button
      disabled={!isComplete}
      onClick={() => isComplete && onSelect(selectedSlots)}
      whileHover={isComplete ? { scale: 1.02 } : {}}
      whileTap={isComplete ? { scale: 0.98 } : {}}
      className={clsx(
        'w-full rounded-xl font-black border transition-all duration-150 flex items-center justify-center gap-1',
        compact ? 'py-2.5 text-xs' : 'py-3 text-sm',
        isComplete
          ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-black border-amber-500 shadow-lg shadow-amber-900/40 cursor-pointer'
          : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
      )}
    >
      {isComplete
        ? `Confirm ${selectedSlots.map(s => { const [suit, rank] = s.typeId.split('_') as [Suit, Rank]; return `${rank}${SUIT_SYMBOLS[suit]}`; }).join(', ')}`
        : `Pick ${partnerCount - selectedSlots.length} more`}
    </motion.button>
  );

  const renderSuitTabs = (compact: boolean) => (
    <div className="flex gap-1 shrink-0">
      {ALL_SUITS.map(suit => (
        <button
          key={suit}
          onClick={() => setActiveSuit(suit)}
          className={clsx(
            'flex-1 rounded-lg border font-bold transition-all',
            compact ? 'py-1.5 text-sm' : 'py-2 text-base',
            activeSuit === suit
              ? isRed(suit)
                ? 'bg-red-900/60 border-red-500 text-red-300'
                : 'bg-slate-700 border-slate-400 text-slate-100'
              : 'bg-slate-800/60 border-slate-700 text-slate-500 active:border-slate-500'
          )}
        >
          {SUIT_SYMBOLS[suit]}
          {suit === trumpSuit && <span className="ml-0.5 text-[8px] text-yellow-400">★</span>}
        </button>
      ))}
    </div>
  );

  const renderCardGrid = (suit: Suit, compact: boolean) => (
    <div className="flex flex-wrap gap-1.5">
      {ALL_RANKS.map(rank => {
        const cardTypeId = `${suit}_${rank}`;
        const slots = getSlotsForTypeId(cardTypeId);
        const selectedCount = slots.length;
        const heldCount = myHandTypeCounts[cardTypeId] ?? 0;
        const maxSelectable = deckCount - heldCount;
        const isFullyInHand = maxSelectable <= 0;
        const canAddAnother = selectedCount < maxSelectable && selectedSlots.length < partnerCount;
        const isDisabled = isFullyInHand || (selectedCount === 0 && selectedSlots.length >= partnerCount);
        const isAllSlotsFilled = selectedCount > 0 && !canAddAnother;
        return (
          <motion.button
            key={cardTypeId}
            onClick={() => !isDisabled && handleCardClick(cardTypeId)}
            disabled={isDisabled}
            whileTap={isDisabled ? {} : { scale: 0.92 }}
            className={clsx(
              'relative rounded-lg border-2 flex flex-col justify-between font-bold transition-all',
              compact ? 'w-9 h-12 p-0.5 text-[9px]' : 'w-10 h-14 p-1 text-[10px]',
              isFullyInHand || isDisabled
                ? 'border-slate-700 bg-slate-900/60 opacity-40 cursor-not-allowed'
                : isAllSlotsFilled
                  ? 'border-emerald-400 bg-emerald-950/50 shadow-[0_0_10px_rgba(52,211,153,0.4)]'
                  : selectedCount > 0
                    ? 'border-sky-400 bg-sky-950/50 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                    : isRed(suit)
                      ? 'border-slate-600 bg-slate-800 text-red-400 active:border-slate-400'
                      : 'border-slate-600 bg-slate-800 text-slate-100 active:border-slate-400'
            )}
          >
            <div className={clsx('leading-none', isFullyInHand || isDisabled ? 'text-slate-600' : isAllSlotsFilled ? 'text-emerald-300' : selectedCount > 0 ? 'text-sky-300' : isRed(suit) ? 'text-red-400' : 'text-slate-100')}>
              <div>{rank}</div><div>{SUIT_SYMBOLS[suit]}</div>
            </div>
            <div className={clsx('self-center leading-none', compact ? 'text-sm' : 'text-base', isFullyInHand || isDisabled ? 'text-slate-600' : isAllSlotsFilled ? 'text-emerald-300' : selectedCount > 0 ? 'text-sky-300' : isRed(suit) ? 'text-red-400' : 'text-slate-100')}>
              {SUIT_SYMBOLS[suit]}
            </div>
            {heldCount > 0 && <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />}
            {selectedCount > 0 && (
              <div className="absolute top-0.5 left-0.5 text-[7px] font-black text-sky-200 leading-none">
                {slots.map(s => s.ordinal === 1 ? '1' : '2').join('+')}
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );

  // ─── Ordinal popup (shared across all layouts) ───────────────────────
  const renderOrdinalPopup = () => (
    <AnimatePresence>
      {pendingCard && (
        <motion.div
          className="fixed inset-0 z-[510] flex items-center justify-center bg-black/60"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-slate-800 border border-slate-600 rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4"
            initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 20 }}
          >
            {(() => {
              const [suit, rank] = pendingCard.split('_') as [Suit, Rank];
              const isRedCard = suit === 'hearts' || suit === 'diamonds';
              const takenOrdinals = selectedSlots.filter(s => s.typeId === pendingCard).map(s => s.ordinal);
              const ord1Taken = takenOrdinals.includes(1);
              const ord2Taken = takenOrdinals.includes(2);
              return (
                <>
                  <p className="text-center text-sm text-slate-300 mb-4 font-semibold">
                    Which occurrence of{' '}
                    <span className={clsx('font-black', isRedCard ? 'text-red-400' : 'text-white')}>{rank}{SUIT_SYMBOLS[suit]}</span>
                    {' '}calls your partner?
                  </p>
                  <div className="flex gap-3 mb-4">
                    {([1, 2] as const).map(ord => {
                      const taken = ord === 1 ? ord1Taken : ord2Taken;
                      return (
                        <button key={ord}
                          onClick={() => !taken && handleOrdinalSelect(ord)}
                          disabled={taken}
                          className={clsx(
                            'flex-1 py-3 rounded-xl border font-black text-sm transition-colors',
                            taken
                              ? 'bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed opacity-50'
                              : ord === 1
                                ? 'bg-sky-700 hover:bg-sky-600 border-sky-500 text-white'
                                : 'bg-indigo-700 hover:bg-indigo-600 border-indigo-500 text-white'
                          )}
                        >
                          {ord === 1 ? '🥇 1st played' : '🥈 2nd played'}
                          {taken && <div className="text-[10px] font-normal">already picked</div>}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setPendingCard(null)} className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                    Cancel
                  </button>
                </>
              );
            })()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ─── Portrait mobile: bottom sheet with suit tabs ────────────────────
  if (isMobilePortrait) {
    return (
      <div className="fixed inset-0 z-[500] bg-black/70 flex flex-col-reverse" style={{ touchAction: 'none' }}>
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="bg-slate-900 rounded-t-3xl flex flex-col overflow-hidden"
          style={{ maxHeight: '92dvh', boxShadow: '0 -8px 48px rgba(0,0,0,0.85)' }}
        >
          <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent shrink-0" />
          <div className="flex justify-center pt-2 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-600" />
          </div>
          {/* Header */}
          <div className="px-4 pb-2 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-100">Select Partner Card{partnerCount !== 1 ? 's' : ''}</h2>
              <div className={clsx('text-xs font-bold px-2.5 py-1 rounded-full border',
                isComplete ? 'bg-emerald-900/60 border-emerald-600 text-emerald-300' : 'bg-slate-800 border-slate-600 text-slate-400')}>
                {selectedSlots.length}/{partnerCount}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Trump: <span className={clsx('font-bold', isRed(trumpSuit) ? 'text-red-400' : 'text-slate-200')}>{SUIT_SYMBOLS[trumpSuit]} {SUIT_LABELS[trumpSuit]}</span>
            </p>
          </div>
          {/* Suit tabs */}
          <div className="px-4 pb-2 shrink-0">{renderSuitTabs(true)}</div>
          {/* Card grid for active suit — scrollable */}
          <div className="flex-1 overflow-y-auto px-4 pb-2 min-h-0">
            <AnimatePresence mode="wait">
              <motion.div key={activeSuit} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                {renderCardGrid(activeSuit, true)}
              </motion.div>
            </AnimatePresence>
          </div>
          {/* Footer */}
          <div className="px-4 pt-1 pb-safe shrink-0 space-y-1.5" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            {renderSelectedChips()}
            {renderConfirmButton(true)}
          </div>
        </motion.div>
        {renderOrdinalPopup()}
      </div>
    );
  }

  // ─── Landscape mobile: left panel + right tabbed grid ────────────────
  if (isMobileLandscape) {
    return (
      <div className="fixed inset-0 z-[500] bg-black/90 flex overflow-hidden">
        {/* Left panel */}
        <div className="w-[34%] flex flex-col justify-between p-3 border-r border-slate-700/60 bg-slate-900 shrink-0 overflow-y-auto">
          <div className="space-y-2">
            <h2 className="text-sm font-black text-slate-100 leading-tight">Select Partner Card{partnerCount !== 1 ? 's' : ''}</h2>
            <div className={clsx('text-[11px] font-bold px-2 py-1 rounded-full border w-fit',
              isComplete ? 'bg-emerald-900/60 border-emerald-600 text-emerald-300' : 'bg-slate-800 border-slate-600 text-slate-400')}>
              {selectedSlots.length}/{partnerCount} selected
            </div>
            <p className="text-[10px] text-slate-500">
              Trump: <span className={clsx('font-bold', isRed(trumpSuit) ? 'text-red-400' : 'text-slate-200')}>{SUIT_SYMBOLS[trumpSuit]} {SUIT_LABELS[trumpSuit]}</span>
            </p>
            {renderSelectedChips()}
          </div>
          {renderConfirmButton(true)}
        </div>
        {/* Right panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
          <div className="px-3 pt-2 pb-1 shrink-0">{renderSuitTabs(true)}</div>
          <div className="flex-1 overflow-y-auto px-3 pb-2 min-h-0">
            <AnimatePresence mode="wait">
              <motion.div key={activeSuit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                {renderCardGrid(activeSuit, true)}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        {renderOrdinalPopup()}
      </div>
    );
  }

  // ─── Desktop: centered scrollable modal ─────────────────────────────
  return (
    <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
        {/* Header */}
        <div className="px-6 pt-7 pb-4 border-b border-slate-700 shrink-0">
          <h2 className="text-xl font-black text-slate-100">Select Partner Card{partnerCount !== 1 ? 's' : ''}</h2>
          <p className="text-slate-400 text-sm mt-1">
            Choose {partnerCount} secret partner card{partnerCount !== 1 ? 's' : ''}
            {deckCount === 2 && ' — specify which occurrence (1st or 2nd played)'}
          </p>
          <div className="flex items-center gap-3 mt-3">
            <div className={clsx('text-sm font-bold px-3 py-1 rounded-full border',
              isComplete ? 'bg-emerald-900/60 border-emerald-600 text-emerald-300' : 'bg-slate-800 border-slate-600 text-slate-400')}>
              {selectedSlots.length}/{partnerCount} selected
            </div>
            <div className="text-xs text-slate-500">
              Trump:{' '}
              <span className={clsx('font-bold', isRed(trumpSuit) ? 'text-red-400' : 'text-slate-200')}>
                {SUIT_SYMBOLS[trumpSuit]} {SUIT_LABELS[trumpSuit]}
              </span>
            </div>
          </div>
        </div>
        {/* All 4 suits scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0">
          {ALL_SUITS.map(suit => (
            <div key={suit}>
              <div className={clsx('flex items-center gap-2 mb-2.5', isRed(suit) ? 'text-red-400' : 'text-slate-200')}>
                <span className="text-xl">{SUIT_SYMBOLS[suit]}</span>
                <span className="text-base font-bold">{SUIT_LABELS[suit]}</span>
                {suit === trumpSuit && <span className="text-[10px] bg-yellow-500 text-yellow-900 px-1.5 py-0.5 rounded font-bold">TRUMP</span>}
              </div>
              {renderCardGrid(suit, false)}
            </div>
          ))}
        </div>
        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 space-y-3 shrink-0">
          {renderSelectedChips()}
          {renderConfirmButton(false)}
        </div>
      </motion.div>
      {renderOrdinalPopup()}
    </div>
  );
}
