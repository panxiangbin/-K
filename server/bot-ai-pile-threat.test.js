const assert = require('node:assert/strict');
const {
  optimizeNormalFollowStructure,
  remainingStructure,
  threatLevel,
  isImmediateThreat,
} = require('./bot-ai-hand-structure');

let nextId = 1;
function card(rank, suit = '♠') {
  return { rank, suit, id: `pile-threat-${nextId++}` };
}

const ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '小王', '大王'];
function detectPattern(cards) {
  if (!cards?.length || !cards.every(item => item.rank === cards[0].rank)) return null;
  const typeByLength = { 1: 'single', 2: 'pair', 3: 'triple', 4: 'four', 5: 'five', 6: 'six', 7: 'seven' };
  const type = typeByLength[cards.length];
  return type ? { type, rank: cards[0].rank } : null;
}
function comparePatterns(next, previous) {
  return next?.type === previous?.type && ORDER.indexOf(next.rank) > ORDER.indexOf(previous.rank);
}
function noBombs() { return []; }
function noDamage() {
  return { bombsBroken: 0, protectedCardsUsed: 0, preservedBombStrength: 0, preservedBombs: 0 };
}
function optimize(hand, lastPlay, chosenCards, context = {}) {
  return optimizeNormalFollowStructure({
    hand,
    lastPlay,
    chosenCards,
    context,
    detectPattern,
    comparePatterns,
    findBombs: noBombs,
    damageProfile: noDamage,
  });
}
function ids(cards) { return new Set(cards.map(item => item.id)); }
function run(name, fn) {
  nextId = 1;
  fn();
  console.log(`✓ ${name}`);
}

run('低分牌堆且下家剩三张时不无故抬高，仍用最小合法对子', () => {
  const pairSeven = [card('7'), card('7', '♥')];
  const pairNine = [card('9'), card('9', '♥')];
  const pairAce = [card('A'), card('A', '♥')];
  const hand = [...pairSeven, ...pairNine, ...pairAce];
  const move = optimize(hand, { type: 'pair', rank: '6' }, pairSeven, {
    pileScore: 0,
    nextOpponentCards: 3,
    minOpponentCards: 3,
    threatSource: 'next',
  });
  assert.deepEqual(ids(move), ids(pairSeven));
});

run('高分牌堆且下家剩三张时优先保留更高控制牌', () => {
  const pairSeven = [card('7'), card('7', '♥')];
  const pairNine = [card('9'), card('9', '♥')];
  const pairAce = [card('A'), card('A', '♥')];
  const hand = [...pairSeven, ...pairNine, ...pairAce];
  const move = optimize(hand, { type: 'pair', rank: '6' }, pairNine, {
    pileScore: 25,
    nextOpponentCards: 3,
    minOpponentCards: 3,
    threatSource: 'next',
  });
  assert.deepEqual(ids(move), ids(pairSeven));
  assert.equal(remainingStructure(hand, move).controlFloor, ORDER.indexOf('9'));
});

run('下家只剩一张时即使牌堆低分也按最高紧迫度保留控制牌', () => {
  const pairSeven = [card('7'), card('7', '♥')];
  const pairNine = [card('9'), card('9', '♥')];
  const pairAce = [card('A'), card('A', '♥')];
  const hand = [...pairSeven, ...pairNine, ...pairAce];
  const move = optimize(hand, { type: 'pair', rank: '6' }, pairNine, {
    pileScore: 0,
    nextOpponentCards: 1,
    minOpponentCards: 1,
    threatSource: 'next',
  });
  assert.deepEqual(ids(move), ids(pairSeven));
});

run('远处玩家剩两张但低分牌堆只观察，不改变正常最小压制', () => {
  const pairSeven = [card('7'), card('7', '♥')];
  const pairNine = [card('9'), card('9', '♥')];
  const pairAce = [card('A'), card('A', '♥')];
  const hand = [...pairSeven, ...pairNine, ...pairAce];
  const move = optimize(hand, { type: 'pair', rank: '6' }, pairSeven, {
    pileScore: 5,
    nextOpponentCards: 5,
    minOpponentCards: 2,
    threatSource: 'table-watch',
  });
  assert.deepEqual(ids(move), ids(pairSeven));
});

run('远处玩家剩两张且高分牌堆时升级为中等威胁并保留控制牌', () => {
  const pairSeven = [card('7'), card('7', '♥')];
  const pairNine = [card('9'), card('9', '♥')];
  const pairAce = [card('A'), card('A', '♥')];
  const hand = [...pairSeven, ...pairNine, ...pairAce];
  const move = optimize(hand, { type: 'pair', rank: '6' }, pairNine, {
    pileScore: 25,
    nextOpponentCards: 5,
    minOpponentCards: 2,
    threatSource: 'table',
  });
  assert.deepEqual(ids(move), ids(pairSeven));
});

run('威胁等级同时考虑距离、剩余张数和牌堆分数', () => {
  assert.equal(threatLevel({ pileScore: 0, nextOpponentCards: 3, threatSource: 'next' }), 0);
  assert.equal(threatLevel({ pileScore: 12, nextOpponentCards: 3, threatSource: 'next' }), 1);
  assert.equal(threatLevel({ pileScore: 25, nextOpponentCards: 3, threatSource: 'next' }), 2);
  assert.equal(threatLevel({ pileScore: 0, nextOpponentCards: 1, threatSource: 'next' }), 2);
  assert.equal(threatLevel({ pileScore: 25, nextOpponentCards: 5, minOpponentCards: 2, threatSource: 'table' }), 1);
  assert.equal(threatLevel({ pileScore: 25, nextOpponentCards: 5, minOpponentCards: 2, threatSource: 'table-watch' }), 0);
  assert.equal(isImmediateThreat({ pileScore: 25, nextOpponentCards: 3 }), true);
  assert.equal(isImmediateThreat({ pileScore: 0, nextOpponentCards: 3 }), false);
});

console.log('高低分牌堆与对手距离威胁测试全部通过。');
