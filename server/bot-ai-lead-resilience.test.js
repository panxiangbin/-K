const assert = require('node:assert/strict');
const { exactRouteResilience, optimizeResilientLead } = require('./bot-ai-lead-resilience');
const { remainingProfile } = require('./bot-ai-lead-strategy');

let nextId = 1;
function card(rank, suit = '♠') {
  return { rank, suit, id: `lead-resilience-${nextId++}` };
}

function pair(rank) {
  return [card(rank, '♠'), card(rank, '♥')];
}

function ranks(cards) {
  return cards.map(cardItem => cardItem.rank);
}

function run(name, fn) {
  nextId = 1;
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

run('两手路线会衡量最弱一手的控制力', () => {
  const weakRoute = [...pair('4'), ...pair('A')];
  const strongRoute = [...pair('9'), ...pair('A')];
  assert.ok(exactRouteResilience(strongRoute) > exactRouteResilience(weakRoute));
});

run('同为两手走完时优先留下9和A，而不是4和A', () => {
  const lowPair = pair('4');
  const middlePair = pair('9');
  const highPair = pair('A');
  const hand = [...lowPair, ...middlePair, ...highPair];
  const move = optimizeResilientLead({
    hand,
    chosenCards: middlePair,
    context: { pileScore: 20, nextOpponentCards: 2, globalMinOpponentCards: 2, threatSource: 'next' },
  });
  assert.deepEqual(ranks(move), ['4', '4']);
  const remaining = remainingProfile(hand, move);
  assert.equal(remaining.turns, 2);
  assert.ok(exactRouteResilience(remaining.remaining) >= 6);
});

run('优先处理5分对子并留下更抗压的9和A两手路线', () => {
  const scorePair = pair('5');
  const middlePair = pair('9');
  const highPair = pair('A');
  const hand = [...scorePair, ...middlePair, ...highPair];
  const move = optimizeResilientLead({
    hand,
    chosenCards: middlePair,
    context: { pileScore: 30, nextOpponentCards: 1, globalMinOpponentCards: 1, threatSource: 'next' },
  });
  assert.deepEqual(ranks(move), ['5', '5']);
  assert.equal(remainingProfile(hand, move).remainingPoints, 0);
});

run('无有效对手时不改写基础先手', () => {
  const lowPair = pair('4');
  const middlePair = pair('9');
  const highPair = pair('A');
  const hand = [...lowPair, ...middlePair, ...highPair];
  const move = optimizeResilientLead({
    hand,
    chosenCards: middlePair,
    context: { threatSource: 'none', nextOpponentCards: Infinity, globalMinOpponentCards: Infinity },
  });
  assert.deepEqual(move.map(cardItem => cardItem.id), middlePair.map(cardItem => cardItem.id));
});

run('只剩一手时保持直接收尾，不做多余改写', () => {
  const lowPair = pair('4');
  const highPair = pair('A');
  const hand = [...lowPair, ...highPair];
  const move = optimizeResilientLead({
    hand,
    chosenCards: lowPair,
    context: { pileScore: 20, nextOpponentCards: 2, globalMinOpponentCards: 2, threatSource: 'next' },
  });
  assert.deepEqual(move.map(cardItem => cardItem.id), lowPair.map(cardItem => cardItem.id));
});

console.log('两手残局抗压能力测试全部通过。');
