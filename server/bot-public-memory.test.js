const assert = require('node:assert/strict');
const { summarizePlayedCards, getBotTurnContext } = require('./bot-context');
const { controlReliability, exactRouteResilience } = require('./bot-ai-lead-resilience');
const { detectPattern } = require('./game-logic');

let nextId = 1;
function card(rank, suit = '♠') {
  return { rank, suit, id: `public-memory-${nextId++}` };
}

function pair(rank) {
  return [card(rank, '♠'), card(rank, '♥')];
}

function playedCopies(rank, count) {
  return Array.from({ length: count }, (_, index) => card(rank, index % 2 ? '♥' : '♠'));
}

{
  const playedCards = [
    card('5'),
    card('10'),
    card('K'),
    card('小王', 'joker'),
    card('大王', 'joker'),
    card('A'),
    card('A'),
  ];
  const summary = summarizePlayedCards(playedCards);
  assert.equal(summary.publicPlayedCount, 7);
  assert.equal(summary.publicRankCounts.A, 2);
  assert.equal(summary.playedJokers, 2);
  assert.equal(summary.publicScoreCards, 25);
}

{
  const room = {
    players: [
      { id: 'bot', hand: pair('9'), left: false },
      { id: 'next', hand: [card('3')], left: false },
    ],
    pile: [card('5')],
    playedCards: [card('5'), card('10'), card('K'), card('大王', 'joker')],
  };
  const context = getBotTurnContext(room, 0, 'bot', cards => cards.length * 5);
  assert.equal(context.publicPlayedCount, 4, '公开记牌应跨牌堆累计，而不是只看当前牌堆');
  assert.equal(context.publicRankCounts['10'], 1);
  assert.equal(context.playedJokers, 1);
  assert.equal(context.publicScoreCards, 25);
}

{
  const move = pair('9');
  const pattern = detectPattern(move);
  const route = [...move];
  const unknownReliability = controlReliability(move, pattern, {}, route);
  const exhaustedHigher = {
    publicRankCounts: {
      '10': 8,
      J: 8,
      Q: 8,
      K: 8,
      A: 8,
      '2': 8,
      小王: 2,
      大王: 2,
    },
  };
  const knownReliability = controlReliability(move, pattern, exhaustedHigher, route);
  assert.ok(knownReliability > unknownReliability, '更大对子公开出尽后，对子9的实际控制力应提高');
}

{
  const route = [...pair('9'), ...pair('A')];
  const baseline = exactRouteResilience(route);
  const publicRankCounts = {};
  for (const rank of ['10', 'J', 'Q', 'K', '2']) publicRankCounts[rank] = 8;
  publicRankCounts.小王 = 2;
  publicRankCounts.大王 = 2;
  const informed = exactRouteResilience(route, { publicRankCounts });
  assert.ok(informed > baseline, '最短残局路线应使用公开牌修正整条路线的最低控制力');
}

{
  const summary = summarizePlayedCards([
    ...playedCopies('A', 8),
    ...playedCopies('2', 8),
    ...playedCopies('小王', 2),
    ...playedCopies('大王', 2),
  ]);
  assert.equal(summary.publicRankCounts.A, 8);
  assert.equal(summary.playedJokers, 4);
}

console.log('公开已出牌记忆与残局控制力测试全部通过。');
