import { createDeck, shuffleDeck, dealCards } from './lib/game-engine/deck';
import { gameConfig } from './config/gameConfig';

const deck = createDeck(gameConfig);
const shuffled = shuffleDeck(deck);
const hands = dealCards(shuffled, ['p1','p2','p3','p4','p5','p6'], gameConfig);

console.log('Deck size:', deck.length);
console.log('Total pts:', deck.reduce((s, c) => s + c.points, 0));
console.log('Cards per player:', Object.values(hands).map(h => h.length));
console.log('3♠ points:', deck.find(c => c.suit === 'spades' && c.rank === '3')?.points);
console.log('Has 2s:', deck.some(c => (c.rank as string) === '2'));
console.log('✅ Game engine OK');
