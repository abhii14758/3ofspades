Center emblem inside the table center div:
```tsx
<div style={{
  width: 100, height: 100, borderRadius: '50%',
  border: '3px solid rgba(212,160,23,0.6)',
  background: 'radial-gradient(circle, rgba(212,160,23,0.12) 0%, rgba(212,160,23,0.04) 60%, transparent 100%)',
  boxShadow: '0 0 0 1px rgba(212,160,23,0.2), 0 0 30px rgba(212,160,23,0.2)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
}}>
  <span style={{ fontSize: 20, opacity: 0.55, color: '#d4a017', lineHeight: 1 }}>♠</span>
  <span style={{ fontSize: 9, opacity: 0.5, color: '#d4a017', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>3 of Spades</span>
</div>
```

### Chat panel (already implemented as flex-row side panel — verify it works)
The chat should slide in from the right as a 280px side panel (desktop) and a bottom 
drawer (mobile). Confirm the existing implementation is correct and working.

### Unread badge on chat button — confirm it shows correctly

### Background (outer wrapper)
```tsx
background: 'radial-gradient(ellipse 140% 100% at 50% 70%, #0f2a0f 0%, #050d05 50%, #000000 100%)'
```

### Top ambient light
```tsx
<div style={{
  background: 'radial-gradient(ellipse at 50% 0%, rgba(255,220,100,0.12) 0%, transparent 70%)',
  width: '600px', height: '200px',
  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
  pointerEvents: 'none'
}} />
```

## TASK 2: REDESIGN PlayerSeat.tsx — PREMIUM PLAYER SEATS

Replace the plain player seats with premium casino-style name badges:

### Player avatar circle
- Increase size slightly: w-11 h-11 (44px)
- Current turn: bright green ring-2 + animated glow pulse  
- Partner revealed: emerald ring
- Bot indicator: 🤖 badge bottom-right

### Score display
- Show points with colored text (sky=Team A, orange=Team B)
- Small "(combined)" label for revealed team A partners

### Card count badge
- Small dark pill showing remaining card count for other players

### Turn timer ring  
- SVG arc around the avatar, color transitions: green → amber (< 20s) → red (< 5s)

## TASK 3: REDESIGN BidPanel.tsx — PREMIUM BID PANEL

Make the bid panel look like a real casino chip display:

### Layout
- Dark navy/slate panel with gold border accent
- Current bid shown LARGE (text-5xl) in GOLD color (#d4a017)
- "by PlayerName" in smaller text below
- Bid history scrollable list with pass=muted, bid=gold colored

### Quick bid buttons  
- 3 buttons per row in a grid
- Blue theme for lower bids (sky-700), indigo for mid, purple for high
- MAX button in red/danger styling
- All with rounded-xl, bold text, hover effects
- Pass button: large red danger button full width

### Waiting state
- Animated "waiting for X to bid..." with player name highlighted

## TASK 4: REDESIGN TrickPile.tsx — CARD TRICK DISPLAY

Improve the center trick pile display:

### Currently winning card
- Bright gold border + glow shadow
- 👑 crown above it
- Float up slightly (y: -6)

### 3 of Spades
- Special yellow/gold shimmer border shadow

### Trump cards
- Subtle orange border

### Trick progress dots
- Full 8-dot progress bar below the cards
- Green filled dots for completed tricks
- Gray for remaining

### Empty state
- Large gold-bordered circle with trick count in center

## TASK 5: REDESIGN CardHand.tsx — IMPROVED HAND DISPLAY

The card hand at bottom:

### Card reveal during deal (DealHandReveal component)
- Show cards face-up one by one with a flip animation (rotateY: 90→0)
- Latest card gets a gold outline glow
- Placeholder slots as dashed empty outlines
- Header text: "Dealing your cards…" in muted style

### Partner cards bar (above hand during playing phase)
- Pill badges for each partner card
- Own partner card highlighted in emerald with 🤝 emoji
- Others in red (hearts/diamonds) or slate

### Sort button
- Small pill button top-right of hand area

### Suit highlight glow  
- Lead suit cards get bright green/gold pulsing glow
- Selected card floats up -24px with sky border glow

## TASK 6: REDESIGN Scoreboard.tsx — PREMIUM SCOREBOARD PANEL

The side panel scoreboard:

### Trigger button (top bar)
- Shows: [trump suit icon] [TeamA score] vs [TeamB score] R[round]
- Compact, clean styling

### Slide-in panel (right side)  
- Dark slate-900 background, 320px wide
- Header with "Scoreboard" and round number
- Trump + bid info card at top

### Team sections
- Team A (bidding team): gold accent border, sky-400 score
- Team B: orange-400 score  
- Player list with icons (bid winner ★, revealed partner ✓)
- Hidden partners shown as "+N hidden partner(s)" in italic
- Stats row: tricks won, round pts, cumulative

### Bid progress
- "X/Y bid" text below score, green if made, red if failing

## TASK 7: REDESIGN TrumpSelector.tsx — TRUMP SELECTION OVERLAY

Full-screen overlay for selecting trump:

### Header
- Gold "🏆 Bid Won: {amount}" badge
- Large title

### Hand strip
- Horizontal scrollable mini-cards showing your hand
- Highlighted cards lift up when their suit is the selected trump

### Suit selection grid (2x2)
- Large buttons with suit symbol, name, card count, best rank
- Selected suit: bright colored border + check mark
- Red suits: red border/text, black suits: slate border/text
- Trump suit badge if current selection = trump

### Confirm button  
- Disabled until selection made
- Shows: "Confirm ♠ Spades as Trump"

## TASK 8: REDESIGN PartnerSelector.tsx — PARTNER SELECTION OVERLAY

### Layout
- Full screen modal with backdrop blur
- Suit sections with suit name + TRUMP badge

### Card grid
- Mini playing cards (w-9 h-14) for each rank in each suit
- In hand: grayed out, amber dot indicator, cursor-not-allowed
- Selected: sky border + glow shadow
- Hover: scale + border color change

### Selection counter
- "X/2 selected" pill (green when complete, gray otherwise)
- Shows selected cards in text below

## TASK 9: REDESIGN RoundResult.tsx — ROUND END MODAL

### Game-over banner
- Gold gradient if there's a winner

### Round header
- Bid result badge: green "✅ BID MADE" or red "❌ BID FAILED"
- Large player name + bid amount

### Trump & Partners info cards (2-col)

### Score table
- Clean bordered table  
- Bid team row: subtle gold background
- Round points: green if positive
- Total: large sky-blue text

### Action button
- "Start Next Round →" for host, waiting message for others

## TASK 10: REDESIGN WinnerScreen.tsx — VICTORY SCREEN

### Full screen with confetti animation (already exists, enhance)

### Trophy animation
- Spring animation entrance

### Team scores
- Split card: winner in gold-300, loser in slate-400
- Large score numbers (text-3xl)

### Round history summary
- Compact scrollable list
- Checkmarks/X for bid made/failed
- Trump suit symbol colored correctly

## TASK 11: REDESIGN TurnIndicator.tsx

### "Your Turn!" badge
- Green glowing pill, animated box-shadow pulse
- ✨ sparkle icon prefix

### Other player's turn
- Dark slate pill, player name

## TASK 12: REDESIGN DealerFigure.tsx

Enhance the animated SVG dealer:
- Make sure it's positioned at top-center of table
- Dealing animation: right arm swings forward
- Idle animation: subtle breathing sway
- The dealer is between the top player seat and the table edge
- Add a small "Dealer" gold label above

## TASK 13: REDESIGN Room Page (room/[roomId]/page.tsx)

### Room code card
- Large monospace room code
- Pulsing gold/indigo border animation
- Copy button

### Player list
- Premium card with avatar gradients
- Ready/waiting badges
- Host crown icon
- Bot robot emoji

### Action buttons
- "🎴 Start Game" — green gradient, disabled state
- "🤖 Add Bot" — slate
- "✕ Terminate" — red

## TASK 14: REDESIGN Lobby Page (lobby/page.tsx)

### Tab switcher
- Pill-style active tab (indigo)

### CreateRoom form
- Game mode preset cards: 5 options (4p1d, 6p1d, 6p2d, 8p2d, 10p2d)
- Each shows: player count, decks, cards each, min bid, partners
- Selected card: indigo border + gradient top accent strip
- Color-coded icons per mode

### Settings section
- Turn timer pills (No Limit / 30s / 60s / 90s)
- Max rounds pills
- Auto-fill bots toggle

## TASK 15: ENHANCE DealAnimation in GameTable.tsx

The deal animation flies cards from center dealer to each player:

### Improvements needed:
- Round-robin dealing (one card per player at a time, cycling)
- Cards should fly with smooth spring physics
- Each flying card: dark blue back design with pattern
- Glowing deck stack at center
- Show revealed cards in hand one by one (DealHandReveal) as they arrive
- Auto-end when all cards dealt + 1s pause
- Host can skip with ⏭ Skip Deal button

The DealAnimation already exists — verify and polish it:
1. Cards fly from center to correct polar positions
2. Deal interval: 0.28s per card
3. Total duration capped sensibly (max ~13s visible)
4. Card backs: dark blue gradient with pattern overlay
5. Deck stack at center glows subtly

## TASK 16: HOME PAGE (app/page.tsx)

### Hero section
- Large "3 of Spades" title with gradient
- Suit symbols ♠ ♥ ♦ ♣ row
- Gold "♠ 3 of Spades — 30 Points" badge
- CTA buttons: "🎴 Create Room" (green) + "🔑 Join Room" (slate)

### Rules grid
- 6 rule cards in 2x3 grid
- Icon + title + description

### Card values table
- Clean bordered table in dark card

### Round flow timeline
- Numbered list with step indicator

## GLOBAL DESIGN TOKENS

Apply these consistently everywhere:
- **Primary accent**: Gold #d4a017, amber-500/600
- **Success/ready**: emerald-400/green-500
- **Tables/dark surfaces**: slate-900, slate-800
- **Felt green**: #1a883d family
- **Text on dark**: slate-100, slate-200, slate-300
- **Muted**: slate-500, slate-600
- **Danger/pass**: red-700/600
- **My turn highlight**: green-400/500 with glow
- **Info/bid amounts**: yellow-400
- **Team A scores**: sky-400
- **Team B scores**: orange-400

## IMPLEMENTATION NOTES

1. Read all existing component files before editing
2. Preserve ALL game logic — only change visual/styling code
3. Keep all TypeScript types, socket events, and state management intact
4. Ensure mobile responsiveness (test isMobile checks)
5. Keep AnimatePresence and Framer Motion animations
6. The chat flex-row side panel is already implemented — verify it doesn't break
7. Run `npx tsc --noEmit` after changes to check for type errors
8. Don't remove the DealerFigure component — enhance it
9. The table uses `rotateX(14deg)` for 3D perspective — keep this
10. All components are in `components/game/` and `components/cards/`

## FILE PRIORITY ORDER

Work in this order:
1. `components/game/GameTable.tsx` (table + layout)
2. `components/cards/Card.tsx` (card appearance)
3. `components/game/BidPanel.tsx`
4. `components/game/TrickPile.tsx`  
5. `components/game/PlayerSeat.tsx`
6. `components/game/Scoreboard.tsx`
7. `components/game/TrumpSelector.tsx`
8. `components/game/PartnerSelector.tsx`
9. `components/game/RoundResult.tsx`
10. `components/game/WinnerScreen.tsx`
11. `components/game/TurnIndicator.tsx`
12. `components/cards/CardHand.tsx`
13. `app/room/[roomId]/page.tsx`
14. `app/lobby/page.tsx`
15. `app/page.tsx`

Start with GameTable.tsx and verify the visual result before moving to the next file. 
The goal is a premium, immersive casino card game experience that rivals commercial 
card game apps. Every pixel should feel intentional and polished.