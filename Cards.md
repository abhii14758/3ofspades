Read these files carefully before making any changes:
- components/cards/Card.tsx
- components/cards/CardHand.tsx  
- components/cards/CardBack.tsx
- app/globals.css

## PROBLEM 1: Cards Are Not Fully Visible During Bidding

During bidding phase, the cards in the hand at the bottom are overlapping 
too much and are hard to read. Players need to clearly see ALL their cards 
to make bidding decisions.

## PROBLEM 2: Cards Don't Look Like Real Playing Cards

Cards need to look exactly like standard playing cards:
- White background
- Rank + suit symbol in TOP-LEFT corner (small)
- Rank + suit symbol in BOTTOM-RIGHT corner (rotated 180°, small)
- Large suit symbol(s) in the CENTER of the card
- Number cards show multiple suit symbols arranged in the standard pattern
- Face cards (J, Q, K) show a large letter with decorative border
- 3♠ gets gold shimmer treatment (special card)

## TASK 1: Redesign Card.tsx — Full Playing Card Look

Replace the entire Card.tsx with a proper playing card design:

```tsx
'use client';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Card as CardType, Suit } from '@/types';

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_COLORS: Record<Suit, string> = {
  spades: '#1a1a2e',
  hearts: '#c0152a',
  diamonds: '#c0152a',
  clubs: '#1a1a2e',
};

// How many center pips to show and their positions for number cards
const PIP_LAYOUTS: Record<string, { positions: string[]; size: string }> = {
  '3':  { positions: ['top', 'mid', 'bot'], size: '1.1rem' },
  '4':  { positions: ['tl', 'tr', 'bl', 'br'], size: '1rem' },
  '5':  { positions: ['tl', 'tr', 'mid', 'bl', 'br'], size: '1rem' },
  '6':  { positions: ['tl', 'tr', 'ml', 'mr', 'bl', 'br'], size: '1rem' },
  '7':  { positions: ['tl', 'tr', 'tc', 'ml', 'mr', 'bl', 'br'], size: '0.95rem' },
  '8':  { positions: ['tl', 'tr', 'tc', 'ml', 'mr', 'bc', 'bl', 'br'], size: '0.9rem' },
  '9':  { positions: ['tl', 'tr', 'ml', 'mr', 'mid', 'bl', 'br', 'bl2', 'br2'], size: '0.9rem' },
  '10': { positions: ['tl', 'tr', 'tc', 'ml', 'mr', 'mc', 'bl', 'br', 'bc', 'bc2'], size: '0.85rem' },
};

const FACE_LABELS: Record<string, string> = { J: 'J', Q: 'Q', K: 'K', A: 'A' };

interface CardProps {
  card: CardType;
  faceDown?: boolean;
  selected?: boolean;
  playable?: boolean;
  onClick?: () => void;
  className?: string;
  small?: boolean;
  animate?: boolean;
  flat?: boolean;
}

function PipGrid({ rank, suit, color }: { rank: string; suit: string; color: string }) {
  const sym = SUIT_SYMBOLS[suit as Suit];
  
  // Face cards and Ace — show large symbol or letter
  if (rank === 'A') {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '1.8rem', color, lineHeight: 1, fontWeight: 700 }}>{sym}</span>
      </div>
    );
  }
  
  if (['J', 'Q', 'K'].includes(rank)) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 2,
      }}>
        {/* Decorative border for face cards */}
        <div style={{
          position: 'absolute', inset: '10%',
          border: `1.5px solid ${color}33`,
          borderRadius: 4,
        }} />
        <span style={{ 
          fontSize: '1.6rem', color, lineHeight: 1, fontWeight: 900,
          fontFamily: 'serif',
          textShadow: `0 1px 2px ${color}44`,
        }}>
          {rank}
        </span>
        <span style={{ fontSize: '0.75rem', color: color + '99', lineHeight: 1 }}>{sym}</span>
      </div>
    );
  }
  
  // Number cards — pip grid
  const count = parseInt(rank) || 0;
  
  // Simple approach: arrange pips in rows
  const getRows = (n: number): number[][] => {
    const layouts: Record<number, number[][]> = {
      2:  [[1], [0], [1]],
      3:  [[1], [1], [1]],
      4:  [[2], [0], [2]],
      5:  [[2], [1], [2]],
      6:  [[2], [2], [2]],
      7:  [[2], [1], [2], [2]],
      8:  [[2], [2], [2], [2]],
      9:  [[2], [2], [1], [2], [2]],
      10: [[2], [2], [2], [2], [2]],
    };
    return layouts[n] || [[1]];
  };
  
  const rows = getRows(count);
  const fontSize = count <= 6 ? '0.95rem' : count <= 8 ? '0.82rem' : '0.72rem';
  
  return (
    <div style={{
      position: 'absolute',
      inset: '18% 12%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{
          display: 'flex',
          justifyContent: row[0] === 0 ? 'center' : 'space-between',
          width: '100%',
        }}>
          {row[0] === 0 ? null : Array.from({ length: row[0] }).map((_, ci) => (
            <span key={ci} style={{
              fontSize,
              color,
              lineHeight: 1,
              // Bottom half pips are flipped
              transform: ri >= Math.floor(rows.length / 2) ? 'rotate(180deg)' : 'none',
              display: 'block',
            }}>
              {sym}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Card({
  card,
  faceDown = false,
  selected = false,
  playable = true,
  onClick,
  className,
  small = false,
  animate = false,
  flat = false,
}: CardProps) {
  const isThreeOfSpades = card.suit === 'spades' && card.rank === '3';
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const color = SUIT_COLORS[card.suit];
  const sym = SUIT_SYMBOLS[card.suit];

  if (faceDown) {
    return (
      <motion.div
        layoutId={animate ? `card-${card.id}` : undefined}
        className={clsx(
          'relative rounded-lg overflow-hidden select-none',
          small ? 'w-10 h-[60px]' : 'w-14 h-[84px] sm:w-16 sm:h-[96px]',
          className
        )}
        style={{
          background: 'linear-gradient(145deg, #1a2850 0%, #1e3570 55%, #243f8a 100%)',
          border: '1px solid rgba(100,140,255,0.45)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{
          position: 'absolute', inset: 3, borderRadius: 4,
          border: '1px solid rgba(100,140,255,0.22)',
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.03) 4px, rgba(255,255,255,0.03) 8px)',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: small ? '1rem' : '1.4rem', color: 'rgba(100,140,255,0.4)' }}>♠</span>
        </div>
      </motion.div>
    );
  }

  const cardWidth = small ? '40px' : 'clamp(52px, 7vw, 64px)';
  const cardHeight = small ? '60px' : 'clamp(76px, 10.5vw, 96px)';

  return (
    <motion.div
      layoutId={animate ? `card-${card.id}` : undefined}
      className={clsx(
        'relative rounded-lg select-none',
        !playable && !selected && 'opacity-60',
        className
      )}
      style={{
        width: cardWidth,
        height: cardHeight,
        background: '#ffffff',
        border: isThreeOfSpades
          ? '2px solid #d4a017'
          : selected
          ? '2px solid #38bdf8'
          : '1.5px solid #d0d0d0',
        boxShadow: isThreeOfSpades
          ? '0 0 0 1px rgba(212,160,23,0.4), 0 0 16px rgba(212,160,23,0.5), 0 4px 16px rgba(0,0,0,0.4)'
          : selected
          ? '0 0 0 1px rgba(56,189,248,0.5), 0 0 14px rgba(56,189,248,0.4), 0 6px 20px rgba(0,0,0,0.4)'
          : '0 3px 10px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)',
        cursor: playable ? 'pointer' : 'default',
        overflow: 'hidden',
        flexShrink: 0,
      }}
      onClick={playable || selected ? onClick : undefined}
      animate={flat ? {} : { y: selected ? -14 : 0 }}
      whileHover={(!flat && playable) ? { scale: 1.06, y: selected ? -18 : -5, transition: { type: 'spring', stiffness: 400, damping: 25 } } : {}}
      whileTap={(!flat && playable) ? { scale: 0.97 } : {}}
    >
      {/* Top-left corner: rank + suit */}
      <div style={{
        position: 'absolute', top: 3, left: 4,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        lineHeight: 1.1,
      }}>
        <span style={{
          fontSize: small ? '0.6rem' : '0.72rem',
          fontWeight: 800,
          color,
          lineHeight: 1,
          fontFamily: 'system-ui, sans-serif',
        }}>{card.rank}</span>
        <span style={{
          fontSize: small ? '0.55rem' : '0.65rem',
          color,
          lineHeight: 1,
        }}>{sym}</span>
      </div>

      {/* Bottom-right corner: rank + suit (rotated 180°) */}
      <div style={{
        position: 'absolute', bottom: 3, right: 4,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        lineHeight: 1.1,
        transform: 'rotate(180deg)',
      }}>
        <span style={{
          fontSize: small ? '0.6rem' : '0.72rem',
          fontWeight: 800,
          color,
          lineHeight: 1,
          fontFamily: 'system-ui, sans-serif',
        }}>{card.rank}</span>
        <span style={{
          fontSize: small ? '0.55rem' : '0.65rem',
          color,
          lineHeight: 1,
        }}>{sym}</span>
      </div>

      {/* Center pip area */}
      {!small && <PipGrid rank={card.rank} suit={card.suit} color={color} />}

      {/* Small card — just center symbol */}
      {small && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '1rem', color, lineHeight: 1 }}>{sym}</span>
        </div>
      )}

      {/* 3 of Spades gold shimmer overlay */}
      {isThreeOfSpades && (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(212,160,23,0.08) 0%, transparent 50%, rgba(212,160,23,0.12) 100%)',
            pointerEvents: 'none',
          }} />
          {/* Points badge */}
          <div style={{
            position: 'absolute', top: 0, right: 0,
            background: '#d4a017',
            color: '#fff',
            fontSize: '0.5rem',
            fontWeight: 900,
            padding: '2px 4px',
            borderBottomLeftRadius: 4,
            lineHeight: 1,
          }}>30</div>
        </>
      )}

      {/* Points badge for other scoring cards (not 3♠) */}
      {!isThreeOfSpades && card.points > 0 && !small && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          background: 'rgba(212,160,23,0.85)',
          color: '#fff',
          fontSize: '0.45rem',
          fontWeight: 900,
          padding: '1px 3px',
          borderBottomLeftRadius: 3,
          lineHeight: 1.2,
        }}>{card.points}</div>
      )}
    </motion.div>
  );
}
```

## TASK 2: Fix CardHand.tsx — Make All Cards Visible During Bidding

The cards overlap too much. During bidding the player MUST see all cards 
clearly to make informed bids.

Find the CardHand.tsx and update the overlap/spacing logic:

```tsx
// In CardHand.tsx, update the step calculation:

// Current card dimensions  
const CARD_W = 64;  // increase from 56
const CARD_H = 96;  // increase from 80

// New scale logic — less aggressive shrinking
const cardScale = count > 14 ? 0.68 : count > 11 ? 0.78 : count > 8 ? 0.90 : 1;
const scaledW = CARD_W * cardScale;
const scaledH = CARD_H * cardScale;

// WIDER step — less overlap so cards are readable
// Key change: minimum step is now 28px (was 10px) so cards are never too crowded
const availW = Math.max(containerWidth - 120, 80);
const step = count <= 1 
  ? scaledW 
  : Math.max(28, Math.min(scaledW * 0.85, (availW - scaledW) / (count - 1)));

// Also add a hint text during bidding:
// Add a prop: isMyTurn + phase passed down, show hint when phase === 'bidding'
```

Also update the hand container height to give more room:
```tsx
const containerH = scaledH + 40; // was +32, give more lift room
const baseTop = Math.round(containerH - scaledH - 6); // was -4
```

## TASK 3: Show Cards Expanded During Bidding Phase

In GameTable.tsx, when phase === 'bidding', pass a special prop to CardHand
to show cards more spread out:

```tsx
// In CardHand component, add an expandedView prop
// When expandedView=true (during bidding):
// - Increase step to show more of each card 
// - Add a subtle "View your cards to bid wisely" hint label above

// In GameTable.tsx where CardHand is rendered:
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
  expandedView={phase === 'bidding'}  // <-- add this
/>
```

In CardHand.tsx add the expandedView prop:
```tsx
interface CardHandProps {
  // ... existing props
  expandedView?: boolean;
}

// Then in the step calculation:
const step = expandedView 
  ? Math.max(scaledW * 0.75, Math.min(scaledW * 0.90, (availW - scaledW) / (count - 1)))
  : count <= 1 
  ? scaledW 
  : Math.max(28, Math.min(scaledW * 0.85, (availW - scaledW) / (count - 1)));
```

Also when expandedView is true, show a hint above the cards:
```tsx
{expandedView && (
  <div style={{
    textAlign: 'center',
    fontSize: '11px',
    color: 'rgba(212,160,23,0.8)',
    fontWeight: 600,
    letterSpacing: '0.05em',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  }}>
    <span style={{ 
      width: 6, height: 6, borderRadius: '50%', 
      background: '#d4a017', display: 'inline-block' 
    }} />
    View your cards to bid wisely
  </div>
)}
```

## TASK 4: Update CardBack.tsx — Premium Blue Card Back

```tsx
'use client';
import clsx from 'clsx';

interface CardBackProps {
  small?: boolean;
  className?: string;
}

export default function CardBack({ small = false, className }: CardBackProps) {
  const w = small ? '40px' : '64px';
  const h = small ? '60px' : '96px';
  
  return (
    <div
      className={clsx('relative rounded-lg select-none overflow-hidden', className)}
      style={{
        width: w, height: h,
        background: 'linear-gradient(145deg, #1a2850 0%, #1e3570 55%, #243f8a 100%)',
        border: '1.5px solid rgba(100,140,255,0.45)',
        boxShadow: '0 3px 10px rgba(0,0,0,0.5)',
        flexShrink: 0,
      }}
    >
      {/* Outer border inset */}
      <div style={{
        position: 'absolute', inset: 3, borderRadius: 4,
        border: '1px solid rgba(100,140,255,0.25)',
      }} />
      {/* Diamond grid pattern */}
      <div style={{
        position: 'absolute', inset: 4,
        backgroundImage: [
          'repeating-linear-gradient(45deg,',
          'transparent, transparent 4px,',
          'rgba(255,255,255,0.04) 4px, rgba(255,255,255,0.04) 8px)',
        ].join(' '),
        borderRadius: 3,
      }} />
      {/* Center spade */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ 
          fontSize: small ? '0.9rem' : '1.3rem', 
          color: 'rgba(100,140,255,0.35)',
          lineHeight: 1,
        }}>♠</span>
      </div>
      {/* Corner dots */}
      {['3px 3px', '3px auto', 'auto 3px', 'auto auto'].map((pos, i) => {
        const [t, l] = pos.split(' ');
        return (
          <div key={i} style={{
            position: 'absolute',
            top: t === 'auto' ? undefined : t,
            bottom: t === 'auto' ? '3px' : undefined,
            left: l === 'auto' ? undefined : l,
            right: l === 'auto' ? '3px' : undefined,
            width: 3, height: 3, borderRadius: '50%',
            background: 'rgba(100,140,255,0.3)',
          }} />
        );
      })}
    </div>
  );
}
```

## TASK 5: Fix DealHandReveal in GameTable.tsx

The DealHandReveal component shows cards arriving during deal animation.
Update it to use the same Card component styling (white bg, proper corners):

Find the DealHandReveal function in GameTable.tsx and update the card 
inner div to match proper playing card appearance:

```tsx
// In DealHandReveal, update the card div:
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
```

## TASK 6: TrickPile Cards — Same Design

In TrickPile.tsx, the cards played on the table also need the proper design.
Update the card div in the map to use white background with proper corners:

```tsx
// In TrickPile.tsx, find the played card div and update:
<div
  style={{
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 8,
    width: 44, height: 64,
    background: '#ffffff',
    border: isWinner
      ? '2px solid #fde68a'
      : is3Spades
      ? '2px solid #d4a017'
      : isTrump
      ? '1.5px solid rgba(253,186,116,0.7)'
      : '1.5px solid #d0d0d0',
    boxShadow: isWinner
      ? '0 0 0 1px rgba(253,224,71,0.5), 0 0 18px rgba(253,224,71,0.7), 0 6px 16px rgba(0,0,0,0.6)'
      : is3Spades
      ? '0 0 14px rgba(212,160,23,0.6), 0 4px 12px rgba(0,0,0,0.5)'
      : isTrump
      ? '0 0 8px rgba(253,186,116,0.4), 0 4px 10px rgba(0,0,0,0.5)'
      : '0 4px 10px rgba(0,0,0,0.5)',
    padding: '3px 4px',
    overflow: 'hidden',
  }}
>
  {/* Top-left rank+suit */}
  <div style={{ alignSelf: 'flex-start', lineHeight: 1 }}>
    <div style={{ 
      fontSize: 10, fontWeight: 800, lineHeight: 1,
      color: isRed ? '#c0152a' : '#1a1a2e',
    }}>{tc.card.rank}</div>
    <div style={{ 
      fontSize: 9, lineHeight: 1,
      color: isRed ? '#c0152a' : '#1a1a2e',
    }}>{SUIT_SYMBOLS[tc.card.suit]}</div>
  </div>
  {/* Center suit */}
  <div style={{ 
    fontSize: 18, lineHeight: 1, fontWeight: 700,
    color: isRed ? '#c0152a' : '#1a1a2e',
  }}>
    {SUIT_SYMBOLS[tc.card.suit]}
  </div>
  {/* Bottom-right rotated */}
  <div style={{ 
    alignSelf: 'flex-end', lineHeight: 1,
    transform: 'rotate(180deg)',
  }}>
    <div style={{ 
      fontSize: 10, fontWeight: 800, lineHeight: 1,
      color: isRed ? '#c0152a' : '#1a1a2e',
    }}>{tc.card.rank}</div>
    <div style={{ 
      fontSize: 9, lineHeight: 1,
      color: isRed ? '#c0152a' : '#1a1a2e',
    }}>{SUIT_SYMBOLS[tc.card.suit]}</div>
  </div>
</div>
```

## VERIFICATION

After all changes run:
```bash
npx tsc --noEmit
```

Fix any TypeScript errors. The result should show:
1. Cards with WHITE background, rank in top-left, suit in top-left below rank
2. Bottom-right corner same but rotated 180°
3. Center of card shows pip arrangement or large symbol
4. During bidding: cards are spread wider so all are readable
5. Card backs: dark blue gradient with diamond pattern
6. 3 of Spades: gold border + shimmer + "30" badge top-right
7. All scoring cards: small gold points badge (10, 4, 3, 2, 5)
8. Selected card: sky-blue glow border, lifted up
9. Trump/winner cards in trick pile: gold glow