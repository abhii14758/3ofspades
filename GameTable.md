The game table still doesn't match the reference Teen Patti image. 
Read components/game/GameTable.tsx carefully, then apply ONLY these 
targeted visual fixes. DO NOT change any game logic or socket events.

## PROBLEM ANALYSIS (from screenshots)

Current issues:
1. Table oval is too thin/narrow — needs to be wider and shorter (more like 
   an actual card table)
2. Gold rail is too thin — in reference image it's a THICK wood+gold ledge
3. Table body depth is missing — reference shows the table has physical 
   height/legs visible below
4. Felt color too dark — reference is bright kelly green
5. 3D tilt too subtle — need more pronounced perspective
6. Player avatar circles float too far outside the table edge

## FIX 1: Table Container Dimensions + 3D

In GameTable.tsx, find the main casino table motion.div and update:

```tsx
// Table container
style={{
  width: 'min(94vw, 920px)',
  height: 'min(52vh, 480px)',    // <-- shorter height, wider proportions
  minHeight: '260px',
  perspective: '900px',          // <-- tighter perspective
  transformStyle: 'preserve-3d',
}}
// Animation
animate={{ scale: 1, opacity: 1, rotateX: 18 }}  // <-- increase tilt to 18deg
```

## FIX 2: Outer Table Body — Add Physical Depth

The table needs to look like it has a physical body. Add this BEFORE the 
existing rounded ellipse layers. This creates the dark wood "underside":

```tsx
{/* Table physical body — visible below rim due to rotateX tilt */}
<div className="absolute rounded-[50%]" style={{
  inset: 0,
  background: 'linear-gradient(175deg, #4a1e08 0%, #1a0a02 45%, #0a0300 100%)',
  boxShadow: [
    '0 50px 100px rgba(0,0,0,0.98)',
    '0 20px 60px rgba(0,0,0,0.95)',
    '0 0 0 1px rgba(0,0,0,0.8)',
    'inset 0 -30px 60px rgba(0,0,0,0.7)',
  ].join(', '),
  transform: 'translateY(12px) scaleX(0.96)',  // slight downward shift for depth
}} />
```

## FIX 3: Gold Rail — MUCH Thicker and Brighter

Replace the current gold rail div. The rail needs to look like the thick 
wood + brass edge on the reference table:

```tsx
{/* Wood/mahogany rail base */}
<div className="absolute rounded-[50%]" style={{
  inset: 0,
  background: 'radial-gradient(ellipse at 50% 40%, #7a3510 0%, #4a1e08 40%, #2a0e04 70%, #0f0401 100%)',
  boxShadow: '0 0 80px rgba(0,0,0,0.9), 0 30px 60px rgba(0,0,0,0.8)',
}} />

{/* Gold bead rail — this is the bright brass strip */}
<div className="absolute rounded-[50%]" style={{
  inset: '4px',
  background: 'transparent',
  boxShadow: [
    '0 0 0 10px rgba(180,130,10,0.95)',   // thick gold base
    '0 0 0 11px rgba(230,175,20,0.7)',    // bright highlight
    '0 0 0 13px rgba(150,100,5,0.5)',     // outer shadow edge
    '0 0 40px rgba(212,160,23,0.6)',      // ambient gold glow
    '0 0 80px rgba(212,160,23,0.25)',     // wide soft glow
    'inset 0 0 0 10px rgba(180,130,10,0.3)', // inner rail glow
  ].join(', '),
}} />

{/* Wood channel between rail and felt */}
<div className="absolute rounded-[50%]" style={{
  inset: '18px',
  background: 'linear-gradient(160deg, #3d1a06 0%, #1e0b02 60%, #0f0501 100%)',
  boxShadow: 'inset 0 4px 16px rgba(0,0,0,0.8)',
}} />
```

## FIX 4: Felt — Brighter + Better Gradient

```tsx
{/* Felt surface */}
<div className="absolute rounded-[50%]" style={{
  inset: '26px',
  background: [
    'radial-gradient(ellipse at 50% 35%,',
    '#2db84d 0%,',
    '#23943e 20%,',
    '#1a7a32 45%,',
    '#125928 70%,',
    '#0a3a1a 100%)',
  ].join(' '),
  boxShadow: [
    'inset 0 30px 80px rgba(0,0,0,0.5)',
    'inset 0 -20px 50px rgba(0,0,0,0.4)',
    'inset 30px 0 60px rgba(0,0,0,0.25)',
    'inset -30px 0 60px rgba(0,0,0,0.25)',
  ].join(', '),
}} />

{/* Felt weave texture */}
<div className="absolute rounded-[50%] pointer-events-none" style={{
  inset: '26px',
  opacity: 0.035,
  backgroundImage: [
    'repeating-linear-gradient(0deg, transparent, transparent 5px,',
    'rgba(255,255,255,1) 5px, rgba(255,255,255,1) 6px),',
    'repeating-linear-gradient(90deg, transparent, transparent 5px,',
    'rgba(255,255,255,1) 5px, rgba(255,255,255,1) 6px)',
  ].join(' '),
}} />

{/* Top highlight — lamp light from above */}
<div className="absolute rounded-[50%] pointer-events-none" style={{
  inset: '26px',
  background: 'radial-gradient(ellipse 55% 30% at 50% 25%, rgba(255,255,255,0.07) 0%, transparent 100%)',
}} />

{/* Gold inner felt edge ring */}
<div className="absolute rounded-[50%] pointer-events-none" style={{
  inset: '26px',
  boxShadow: 'inset 0 0 0 2px rgba(212,160,23,0.15), inset 0 0 20px rgba(0,0,0,0.3)',
}} />
```

## FIX 5: Center Emblem — Make it More Visible

```tsx
{/* Center pot/emblem area */}
<div style={{
  position: 'absolute', inset: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  pointerEvents: 'none', zIndex: 0,
}}>
  <div style={{
    width: 110, height: 110,
    borderRadius: '50%',
    border: '2px solid rgba(212,160,23,0.5)',
    background: 'radial-gradient(circle, rgba(212,160,23,0.1) 0%, rgba(212,160,23,0.03) 60%, transparent 100%)',
    boxShadow: [
      '0 0 0 1px rgba(212,160,23,0.15)',
      '0 0 40px rgba(212,160,23,0.18)',
      'inset 0 0 30px rgba(0,0,0,0.4)',
    ].join(', '),
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  }}>
    <span style={{ fontSize: 28, opacity: 0.5, color: '#d4a017', lineHeight: 1 }}>♠</span>
    <span style={{
      fontSize: 8, opacity: 0.45, color: '#d4a017',
      fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase',
    }}>3 of Spades</span>
  </div>
</div>
```

## FIX 6: Background — Darker, More Atmospheric

Find the outermost wrapper div in GameTable and update background:

```tsx
background: 'radial-gradient(ellipse 160% 120% at 50% 60%, #071507 0%, #020802 40%, #000000 100%)'
```

Also add the overhead lamp effect (position absolute inside the table area div):
```tsx
{/* Overhead lamp glow */}
<div style={{
  position: 'absolute',
  top: '-60px', left: '50%',
  transform: 'translateX(-50%)',
  width: '700px', height: '300px',
  background: 'radial-gradient(ellipse at 50% 0%, rgba(255,230,120,0.1) 0%, transparent 65%)',
  pointerEvents: 'none', zIndex: 0,
}} />
```

## FIX 7: Player Seat Positioning

Player seats are positioned using left/top percentages on the table div.
The current rx=46, ry=43 pushes them too far outside the table edge.

In `getPlayerPositions` function, reduce the radii:
```tsx
const rx = 41   // was 46 — bring seats closer to table edge
const ry = 38   // was 43 — bring seats closer to table edge
const cx = 50
const cy = 50
```

This keeps avatars overlapping the gold rail, which looks like they're 
"sitting at the table" rather than floating in space.

## FIX 8: PlayerSeat Avatar Size + Styling

In PlayerSeat.tsx, make the avatar slightly larger and more premium:

Avatar div: change w-10 h-10 to w-12 h-12 (48px)
Add a subtle dark background ring behind the avatar for readability:

```tsx
// Wrapper around avatar
<div style={{
  padding: '3px',
  borderRadius: '50%',
  background: 'rgba(0,0,0,0.6)',
  boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.8)',
}}>
  {/* existing avatar circle with w-12 h-12 */}
</div>
```

For the current-turn glow, use a brighter, larger effect:
```tsx
// Turn glow — larger blur
<motion.div style={{
  position: 'absolute',
  inset: -10,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(74,222,128,0.4) 0%, transparent 70%)',
}}
animate={{ opacity: [0.4, 0.9, 0.4], scale: [0.95, 1.05, 0.95] }}
transition={{ duration: 1.5, repeat: Infinity }}
/>
<motion.div style={{
  position: 'absolute', inset: -6,
  borderRadius: '50%',
  border: '2px solid rgba(74,222,128,0.8)',
  boxShadow: '0 0 12px rgba(74,222,128,0.5)',
}}
animate={{ opacity: [0.8, 0.3, 0.8] }}
transition={{ duration: 1.5, repeat: Infinity }}
/>
```

## FIX 9: Card Back Design in Deal Animation

In the DealAnimation component inside GameTable.tsx, update the flying 
card and deck stack to use a richer card back design:

Flying cards:
```tsx
style={{
  background: 'linear-gradient(145deg, #1a2850 0%, #1e3570 55%, #243f8a 100%)',
  border: '1px solid rgba(100,140,255,0.5)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.7), 0 0 8px rgba(60,100,255,0.2)',
}}
// Inner pattern:
<div style={{
  position: 'absolute', inset: 3, borderRadius: 3,
  border: '1px solid rgba(100,140,255,0.25)',
  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.03) 4px, rgba(255,255,255,0.03) 8px)',
}} />
```

## FIX 10: TrickPile — Cards on the Table

Cards played on the table during tricks should be larger and more visible.

In TrickPile.tsx, increase card dimensions:
- Change w-10 h-14 to w-11 h-16 (44x64px)  
- Increase the center suit symbol from text-lg to text-xl
- Make the winner card glow stronger:
```tsx
boxShadow: isWinner 
  ? '0 0 0 2px #fde68a, 0 0 20px rgba(253,224,71,0.8), 0 6px 20px rgba(0,0,0,0.7)'
  : isTrump
  ? '0 0 0 1px rgba(253,186,116,0.6), 0 0 10px rgba(253,186,116,0.3), 0 4px 12px rgba(0,0,0,0.6)'
  : '0 4px 12px rgba(0,0,0,0.6)'
```

## VERIFICATION STEPS

After making all changes, run:
```bash
npx tsc --noEmit
```

Fix any TypeScript errors. Then describe what the table should look like:
- Dark near-black atmospheric room
- Overhead warm light glow
- 3D tilted oval table visible from slightly above
- Thick bright gold bead rail around the oval
- Dark mahogany wood visible between gold rail and felt edge
- Bright kelly green felt surface
- Warm light highlight at top-center of felt
- Gold center emblem (110px circle, ♠ symbol)
- Player avatars overlapping the gold rail, sitting "at the table"
- Flying blue cards during deal animation
- Trump badge + trick pile centered on felt

DO NOT change: 
- Any socket.io events
- Any game state logic  
- Any TypeScript interfaces/types
- The chat panel layout (flex-row side panel)
- The DealerFigure component placement
- The TurnIndicator, BidPanel, Scoreboard components (those are OK)