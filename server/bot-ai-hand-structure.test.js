const assert = require('node:assert/strict');
const {
  optimizeNormalFollowStructure,
  remainingStructure,
} = require('./bot-ai-hand-structure');

let nextId = 1;
function card(rank, suit = '♠') {
  return { rank, suit, id: `hand-structure-${nextId++}` };
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

function optimize(hand, lastPlay, chosenCards) {
  return optimizeNormalFollowStructure({
    hand,
    lastPlay,
    chosenCards,
    detectPattern,
    comparePatterns,
    findBombs: noBombs,
    damageProfile: noDamage,
  });
}

function run(name, fn) {
  try {
    nextId = 1;
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

run('跟对子时不拆三张7留下孤张，改出完整对子10', () => {
  const tripleSeven = [card('7'), card('7', '♥'), card('7', '♣')];
  const pairTen = [card('10'), card('10', '♥')];
  const pairKing = [card('K'), card('K', '♥')];
  const hand = [...tripleSeven, ...pairTen, ...pairKing];

  const move = optimize(hand, { type: 'pair', rank: '6' }, tripleSeven.slice(0, 2));
  assert.deepEqual(new Set(move.map(item => item.id)), new Set(pairTen.map(item => item.id)));
  assert.equal(detectPattern(move).type, 'pair');
  assert.equal(detectPattern(move).rank, '10');
  assert.equal(remainingStructure(hand, move).singletons, 0);
});

run('避免把三张10拆成对子后留下10分孤张', () => {
  const tripleTen = [card('10'), card('10', '♥'), card('10', '♣')];
  const pairJack = [card('J'), card('J', '♥')];
  const hand = [...tripleTen, ...pairJack];

  const move = optimize(hand, { type: 'pair', rank: '9' }, tripleTen.slice(0, 2));
  assert.deepEqual(new Set(move.map(item => item.id)), new Set(pairJack.map(item => item.id)));
  const structure = remainingStructure(hand, move);
  assert.equal(structure.scoreSingletons, 0);
  assert.equal(structure.singletons, 0);
});

run('炸弹损伤更差的候选不会为了整理手牌而被采用', () => {
  const pairSeven = [card('7'), card('7', '♥')];
  const pairEight = [card('8'), card('8', '♥')];
  const hand = [...pairSeven, ...pairEight, card('8', '♣')];
  const protectedIds = new Set(pairEight.map(item => item.id));

  const move = optimizeNormalFollowStructure({
    hand,
    lastPlay: { type: 'pair', rank: '6' },
    chosenCards: pairSeven,
    detectPattern,
    comparePatterns,
    findBombs: () => [pairEight],
    damageProfile(cards) {
      const used = cards.filter(item => protectedIds.has(item.id)).length;
      return {
        bombsBroken: used > 0 && used < 2 ? 1 : 0,
        protectedCardsUsed: used,
        preservedBombStrength: used === 0 ? 100 : 0,
        preservedBombs: used === 0 ? 1 : 0,
      };
    },
  });

  assert.deepEqual(new Set(move.map(item => item.id)), new Set(pairSeven.map(item => item.id)));
});

run('只有一个合法对子时保持原选择', () => {
  const pairEight = [card('8'), card('8', '♥')];
  const hand = [...pairEight, card('3')];
  const move = optimize(hand, { type: 'pair', rank: '7' }, pairEight);
  assert.deepEqual(move, pairEight);
});

console.log('正常跟牌剩余结构测试全部通过。');
