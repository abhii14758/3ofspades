import { createDeck, shuffleDeck, dealCards } from './lib/game-engine/deck';
import { initBidState, placeBid, isBiddingComplete, getBidWinner } from './lib/game-engine/bidEngine';
import { initTrick, canPlayCard, playCard as enginePlayCard, resolveTrick, getTrickPoints } from './lib/game-engine/trickEngine';
import { createInitialTeams, calculateRoundScore } from './lib/game-engine/scoreEngine';
import { gameConfig } from './config/gameConfig';
import type { Player } from './types';

const players: Player[] = [
  { id: 'p1', name: 'Alice', type: 'human', status: 'playing', isHost: true, seatIndex: 0 },
  { id: 'p2', name: 'Bob',   type: 'human', status: 'playing', isHost: false, seatIndex: 1 },
  { id: 'p3', name: 'Carol', type: 'human', status: 'playing', isHost: false, seatIndex: 2 },
  { id: 'p4', name: 'Dave',  type: 'human', status: 'playing', isHost: false, seatIndex: 3 },
  { id: 'p5', name: 'Eve',   type: 'human', status: 'playing', isHost: false, seatIndex: 4 },
  { id: 'p6', name: 'Frank', type: 'human', status: 'playing', isHost: false, seatIndex: 5 },
];

// --- Bidding test ---
let bidState = initBidState(players, 0, gameConfig);
console.log('Initial bidder:', bidState.currentBidderId, '(should be p2 - left of dealer p1)');
bidState = placeBid(bidState, 'p2', 140, players, gameConfig);
bidState = placeBid(bidState, 'p3', 'pass', players, gameConfig);
bidState = placeBid(bidState, 'p4', 150, players, gameConfig);
bidState = placeBid(bidState, 'p5', 'pass', players, gameConfig);
bidState = placeBid(bidState, 'p6', 'pass', players, gameConfig);
bidState = placeBid(bidState, 'p1', 'pass', players, gameConfig); // dealer passes
bidState = placeBid(bidState, 'p2', 'pass', players, gameConfig); // p2 passes, p4 wins
console.log('Bid complete:', isBiddingComplete(bidState, players), '(should be true)');
console.log('Bid winner:', getBidWinner(bidState), '(should be p4, bid 150)');

// --- Trick test ---
const deck = shuffleDeck(createDeck(gameConfig));
const hands = dealCards(deck, players.map(p => p.id), gameConfig);

let trick = initTrick(0);
const trumpSuit = 'spades';

// Each player plays a legal card
for (const player of players) {
  const hand = hands[player.id];
  // Find first legal card
  const legalCard = hand.find(card => canPlayCard(hand, card, trick, trumpSuit, gameConfig).valid);
  if (!legalCard) { console.error('No legal card for', player.name); process.exit(1); }
  trick = enginePlayCard(trick, player.id, legalCard);
}
const winnerId = resolveTrick(trick, trumpSuit, gameConfig);
const trickPts = getTrickPoints(trick);
console.log('Trick winner:', winnerId, '| Trick points:', trickPts);

// --- Score test ---
const teams = createInitialTeams('p4', ['p1'], players.map(p => p.id));
console.log('Team A players (p4+p1):', teams.A.playerIds);
console.log('Team B players:', teams.B.playerIds);
console.log('✅ Full engine flow OK');
