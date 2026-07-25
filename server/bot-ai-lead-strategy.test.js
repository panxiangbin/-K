const assert = require('node:assert/strict');
const { optimizeLeadMove, leadThreatLevel, leadShapeRisk, restrictToSafeFinishRoute } = require('./bot-ai-lead-strategy');
const { detectPattern } = require('./game-logic');

let nextId = 1;
function card(rank, suit = '♠') {
  return { rank, suit, id: `lead-${nextId++}` };
}

function ranks(cards) {
  return cards.map(item => item.rank);
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

run('下家只剩一张时不机械领最小单张，改出完整对子封牌', () => {
  const single = card('3', '♦');
  const pair = [card('A', '♠'), card('A', '♥')];
  const hand = [single, ...pair];
  const move = optimizeLeadMove({
    hand,
    chosenCards: [single],
    context: { pileScore: 0, nextOpponentCards: 1, minOpponentCards: 1, threatSource: 'next' },
  });
  assert.deepEqual(ranks(move), ['A', 'A']);
  assert.equal(detectPattern(move).type, 'pair');
});

run('下家只剩两张时避免领对子，改领完整三张', () => {
  const pair = [card('4', '♠'), card('4', '♥')];
  const triple = [card('9', '♠'), card('9', '♥'), card('9', '♣')];
  const hand = [...pair, ...triple];
  const context = { pileScore: 0, nextOpponentCards: 2, minOpponentCards: 2, threatSource: 'next' };
  const move = optimizeLeadMove({ hand, chosenCards: pair, context });
  assert.deepEqual(ranks(move), ['9', '9', '9']);
  assert.equal(detectPattern(move).type, 'triple');
  assert.ok(leadShapeRisk(2, context) > leadShapeRisk(3, context));
});

run('下家只剩三张时避免领三张，改领完整对子', () => {
  const triple = [card('4', '♠'), card('4', '♥'), card('4', '♣')];
  const pair = [card('9', '♠'), card('9', '♥')];
  const hand = [...triple, ...pair];
  const context = { pileScore: 0, nextOpponentCards: 3, minOpponentCards: 3, threatSource: 'next' };
  const move = optimizeLeadMove({ hand, chosenCards: triple, context });
  assert.deepEqual(ranks(move), ['9', '9']);
  assert.equal(detectPattern(move).type, 'pair');
  assert.ok(leadShapeRisk(3, context) > leadShapeRisk(2, context));
});

run('高分牌堆时下家两张的对子封锁惩罚进一步提高', () => {
  const low = { pileScore: 0, nextOpponentCards: 2, threatSource: 'next' };
  const high = { pileScore: 25, nextOpponentCards: 2, threatSource: 'next' };
  assert.equal(leadThreatLevel(low), 1);
  assert.equal(leadThreatLevel(high), 2);
  assert.ok(leadShapeRisk(2, high) > leadShapeRisk(2, low));
});

run('远处玩家剩两张时不把对子当作紧邻下家的直接送牌风险', () => {
  const context = {
    pileScore: 30,
    nextOpponentCards: 8,
    globalMinOpponentCards: 2,
    threatSource: 'table',
  };
  assert.equal(leadShapeRisk(2, context), 0);
});

run('无有效对手时保持基础先手选择', () => {
  const single = card('3', '♦');
  const hand = [single, card('A', '♠'), card('A', '♥'), card('A', '♣'), card('A', '♦'), card('A', '♠'), card('A', '♥'), card('A', '♣')];
  const move = optimizeLeadMove({
    hand,
    chosenCards: [single],
    context: { pileScore: 30, nextOpponentCards: Infinity, globalMinOpponentCards: Infinity, threatSource: 'none' },
  });
  assert.equal(move[0].id, single.id);
});

run('远处玩家只剩一张但低分牌堆时不按紧邻下家过度封锁', () => {
  const single = card('3', '♦');
  const hand = [single, card('9', '♠'), card('9', '♥'), card('A', '♣'), card('A', '♦'), card('2', '♠'), card('2', '♥'), card('2', '♣')];
  const move = optimizeLeadMove({
    hand,
    chosenCards: [single],
    context: {
      pileScore: 5,
      nextOpponentCards: 8,
      globalMinOpponentCards: 1,
      minOpponentCards: 8,
      threatSource: 'table-watch',
    },
  });
  assert.equal(move[0].id, single.id);
  assert.equal(leadThreatLevel({ pileScore: 5, nextOpponentCards: 8, globalMinOpponentCards: 1, threatSource: 'table-watch' }), 0);
});

run('远处玩家只剩一张且高分牌堆时升级为全桌威胁，但不按紧邻下家强制封单张', () => {
  const single = card('3', '♦');
  const hand = [single, card('9', '♠'), card('9', '♥'), card('A', '♣'), card('A', '♦'), card('2', '♠'), card('2', '♥'), card('2', '♣')];
  const context = {
    pileScore: 30,
    nextOpponentCards: 8,
    globalMinOpponentCards: 1,
    minOpponentCards: 1,
    threatSource: 'table',
  };
  const move = optimizeLeadMove({ hand, chosenCards: [single], context });
  assert.equal(move[0].id, single.id);
  assert.equal(leadThreatLevel(context), 2);
});

run('两手残局优先先处理5分孤张，不把分牌留作最后一手', () => {
  const scoreSingle = card('5', '♦');
  const pair = [card('A', '♠'), card('A', '♥')];
  const hand = [scoreSingle, ...pair];
  const move = optimizeLeadMove({
    hand,
    chosenCards: pair,
    context: { nextOpponentCards: 6, globalMinOpponentCards: 6, threatSource: 'next' },
  });
  assert.equal(move.length, 1);
  assert.equal(move[0].id, scoreSingle.id);
});

run('同等炸弹安全时，两三手收尾路线不能被牌型封锁拖长', () => {
  const safeDamage = { bombsBroken: 0, preservedBombStrength: 0, preservedBombs: 0, protectedCardsUsed: 0 };
  const candidates = [
    { cards: [card('4')], damage: safeDamage, remaining: { turns: 3 } },
    { cards: [card('9'), card('9')], damage: safeDamage, remaining: { turns: 2 } },
    { cards: [card('A'), card('A'), card('A')], damage: safeDamage, remaining: { turns: 1 } },
  ];
  const restricted = restrictToSafeFinishRoute(candidates);
  assert.equal(restricted.length, 1);
  assert.equal(restricted[0].remaining.turns, 1);
});

run('短残局路线筛选仍以炸弹安全为先，不能为少一手增加炸弹损伤', () => {
  const safe = { bombsBroken: 0, preservedBombStrength: 0, preservedBombs: 1, protectedCardsUsed: 0 };
  const damaged = { bombsBroken: 1, preservedBombStrength: 0, preservedBombs: 0, protectedCardsUsed: 1 };
  const candidates = [
    { cards: [card('4')], damage: safe, remaining: { turns: 2 } },
    { cards: [card('A'), card('A')], damage: damaged, remaining: { turns: 0 } },
  ];
  const restricted = restrictToSafeFinishRoute(candidates);
  assert.equal(restricted.length, 1);
  assert.equal(restricted[0].damage.bombsBroken, 0);
  assert.equal(restricted[0].remaining.turns, 2);
});

run('先手优化不能为了封牌破坏五十K炸弹', () => {
  const safeSingle = card('3', '♦');
  const hand = [safeSingle, card('5', '♠'), card('10', '♠'), card('K', '♠')];
  const move = optimizeLeadMove({
    hand,
    chosenCards: [safeSingle],
    context: { pileScore: 30, nextOpponentCards: 1, minOpponentCards: 1, threatSource: 'next' },
  });
  assert.equal(move.length, 1);
  assert.equal(move[0].id, safeSingle.id);
});

run('整手可一手出完时保持直接出完', () => {
  const hand = [card('7', '♠'), card('7', '♥')];
  const move = optimizeLeadMove({
    hand,
    chosenCards: hand,
    context: { nextOpponentCards: 1, minOpponentCards: 1, threatSource: 'next' },
  });
  assert.equal(move.length, 2);
  assert.deepEqual(move.map(item => item.id), hand.map(item => item.id));
});

console.log('先手残局、收尾路线、牌型封锁、对手距离与分数牌处理测试全部通过。');
