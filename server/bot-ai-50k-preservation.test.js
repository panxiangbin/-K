const assert = require('node:assert/strict');
const { chooseBotMove } = require('./bot-ai');
const { detectPattern } = require('./game-logic');

let nextId = 1;
function card(rank, suit) {
  return { rank, suit, id: `50k-preserve-${nextId++}` };
}

function countRemainingSuit50KBombs(hand, move, suit) {
  const playedIds = new Set(move.map(item => item.id));
  const remaining = hand.filter(item => !playedIds.has(item.id));
  const countRank = rank => remaining.filter(item => item.rank === rank && item.suit === suit).length;
  return Math.min(countRank('5'), countRank('10'), countRank('K'));
}

function run(rank, lastRank, extras, expectedExtraCount) {
  nextId = 1;
  const extraCards = extras.map(suit => card(rank, suit));
  const hand = [
    card('5', '♠'), card('5', '♠'),
    card('10', '♠'), card('10', '♠'),
    card('K', '♠'), card('K', '♠'),
    ...extraCards,
  ];

  const type = extraCards.length === 1 ? 'pair' : 'triple';
  const move = chooseBotMove(hand, { type, rank: lastRank });
  assert.equal(detectPattern(move).type, type);
  assert.equal(move.length, extraCards.length + 1);
  assert.equal(move.filter(item => extraCards.some(extra => extra.id === item.id)).length, expectedExtraCount);
  assert.equal(countRemainingSuit50KBombs(hand, move, '♠'), 1);
}

for (const scenario of [
  { rank: '5', lastRank: '4' },
  { rank: '10', lastRank: '9' },
  { rank: 'K', lastRank: 'Q' },
]) {
  run(scenario.rank, scenario.lastRank, ['♥'], 1);
  run(scenario.rank, scenario.lastRank, ['♥', '♦'], 2);
}

console.log('五十K最小拆牌测试全部通过。');
