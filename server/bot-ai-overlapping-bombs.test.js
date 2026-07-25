const assert = require('node:assert/strict');
const { chooseWithBase, damageProfile, findBombs } = require('./bot-ai-bomb-preservation');
const { detectPattern } = require('./game-logic');

let nextId = 1;
function card(rank, suit) {
  return { rank, suit, id: `overlap-${nextId++}` };
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

run('单张同时属于黑四和五十K时，改用只破坏黑四的同点牌', () => {
  const five = card('5', '♠');
  const overlappingTen = card('10', '♠');
  const spareSpadeTen = card('10', '♠');
  const clubTenA = card('10', '♣');
  const clubTenB = card('10', '♣');
  const king = card('K', '♠');
  const hand = [five, overlappingTen, spareSpadeTen, clubTenA, clubTenB, king];

  const move = chooseWithBase(
    () => [overlappingTen],
    hand,
    { type: 'single', rank: '9' },
    {},
  );

  assert.equal(move.length, 1);
  assert.notEqual(move[0].id, overlappingTen.id);
  assert.equal(move[0].rank, '10');
  assert.equal(detectPattern(move).type, 'single');

  const remainingIds = new Set(hand.filter(item => item.id !== move[0].id).map(item => item.id));
  assert.ok(remainingIds.has(five.id));
  assert.ok(remainingIds.has(overlappingTen.id));
  assert.ok(remainingIds.has(king.id));
});

run('对子候选优先破坏更少炸弹套数，而不只比较炸弹牌张数', () => {
  const five = card('5', '♠');
  const overlappingTen = card('10', '♠');
  const spareSpadeTen = card('10', '♠');
  const clubTenA = card('10', '♣');
  const clubTenB = card('10', '♣');
  const king = card('K', '♠');
  const hand = [five, overlappingTen, spareSpadeTen, clubTenA, clubTenB, king];
  const bombs = findBombs(hand);

  const damagingPair = [overlappingTen, spareSpadeTen];
  const saferPair = [clubTenA, clubTenB];
  assert.equal(damageProfile(damagingPair, bombs).protectedCardsUsed, 2);
  assert.equal(damageProfile(saferPair, bombs).protectedCardsUsed, 2);
  assert.ok(damageProfile(damagingPair, bombs).bombsBroken > damageProfile(saferPair, bombs).bombsBroken);

  const move = chooseWithBase(
    () => damagingPair,
    hand,
    { type: 'pair', rank: '9' },
    {},
  );

  assert.equal(move.length, 2);
  assert.deepEqual(new Set(move.map(item => item.id)), new Set(saferPair.map(item => item.id)));
  assert.equal(detectPattern(move).type, 'pair');
});

run('红四与方块五十K重叠时，优先使用不碰五十K的红牌', () => {
  const five = card('5', '♦');
  const ten = card('10', '♦');
  const king = card('K', '♦');
  const heartFiveA = card('5', '♥');
  const heartFiveB = card('5', '♥');
  const diamondFiveB = card('5', '♦');
  const hand = [five, ten, king, heartFiveA, heartFiveB, diamondFiveB];

  const move = chooseWithBase(
    () => [five],
    hand,
    { type: 'single', rank: '4' },
    {},
  );

  assert.equal(move.length, 1);
  assert.notEqual(move[0].id, five.id);
  assert.equal(move[0].rank, '5');
});

console.log('重叠炸弹保护测试全部通过。');
