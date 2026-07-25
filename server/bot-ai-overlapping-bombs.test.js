const assert = require('node:assert/strict');
const { chooseWithBase, damageProfile, findBombs, bombStrength } = require('./bot-ai-bomb-preservation');
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

run('拆八张同点对子时，破坏套数相同也应保留更强的黑四', () => {
  const redCards = [card('9', '♥'), card('9', '♥'), card('9', '♦'), card('9', '♦')];
  const blackCards = [card('9', '♠'), card('9', '♠'), card('9', '♣'), card('9', '♣')];
  const hand = [...redCards, ...blackCards];
  const bombs = findBombs(hand);
  const redBomb = bombs.find(bomb => detectPattern(bomb)?.bombType === 'color4'
    && detectPattern(bomb)?.color === 'red');
  const blackBomb = bombs.find(bomb => detectPattern(bomb)?.bombType === 'color4'
    && detectPattern(bomb)?.color === 'black');

  assert.ok(redBomb);
  assert.ok(blackBomb);
  assert.ok(bombStrength(blackBomb) > bombStrength(redBomb));

  const originalBlackPair = blackCards.slice(0, 2);
  const redPair = redCards.slice(0, 2);
  const originalDamage = damageProfile(originalBlackPair, bombs);
  const saferDamage = damageProfile(redPair, bombs);
  assert.equal(originalDamage.bombsBroken, saferDamage.bombsBroken);
  assert.equal(originalDamage.protectedCardsUsed, saferDamage.protectedCardsUsed);
  assert.ok(saferDamage.preservedBombStrength > originalDamage.preservedBombStrength);

  const move = chooseWithBase(
    () => originalBlackPair,
    hand,
    { type: 'pair', rank: '8' },
    {},
  );

  assert.equal(move.length, 2);
  assert.ok(move.every(item => item.suit === '♥' || item.suit === '♦'));
  assert.equal(detectPattern(move).type, 'pair');
});

run('拆八张同点三张时，也应保留更强的黑四', () => {
  const redCards = [card('Q', '♥'), card('Q', '♥'), card('Q', '♦'), card('Q', '♦')];
  const blackCards = [card('Q', '♠'), card('Q', '♠'), card('Q', '♣'), card('Q', '♣')];
  const hand = [...redCards, ...blackCards];

  const move = chooseWithBase(
    () => blackCards.slice(0, 3),
    hand,
    { type: 'triple', rank: 'J' },
    {},
  );

  assert.equal(move.length, 3);
  assert.ok(move.every(item => item.suit === '♥' || item.suit === '♦'));
  assert.equal(detectPattern(move).type, 'triple');
});

run('不同点数八张炸弹都能跟对子时，应拆较低点数并保留高点控制炸弹', () => {
  const lowCards = [
    card('7', '♥'), card('7', '♥'), card('7', '♦'), card('7', '♦'),
    card('7', '♠'), card('7', '♠'), card('7', '♣'), card('7', '♣'),
  ];
  const highCards = [
    card('A', '♥'), card('A', '♥'), card('A', '♦'), card('A', '♦'),
    card('A', '♠'), card('A', '♠'), card('A', '♣'), card('A', '♣'),
  ];
  const hand = [...lowCards, ...highCards];

  const move = chooseWithBase(
    () => highCards.slice(0, 2),
    hand,
    { type: 'pair', rank: '6' },
    {},
  );

  assert.equal(move.length, 2);
  assert.ok(move.every(item => item.rank === '7'));
  assert.equal(detectPattern(move).type, 'pair');

  const remainingHigh = hand.filter(item => item.rank === 'A' && !move.some(played => played.id === item.id));
  assert.equal(remainingHigh.length, 8);
  assert.equal(detectPattern(remainingHigh).bombType, 'same8');
});

run('不同点数八张炸弹都能跟三张时，应保留更高点数的完整八张炸弹', () => {
  const lowCards = [
    card('9', '♥'), card('9', '♥'), card('9', '♦'), card('9', '♦'),
    card('9', '♠'), card('9', '♠'), card('9', '♣'), card('9', '♣'),
  ];
  const highCards = [
    card('2', '♥'), card('2', '♥'), card('2', '♦'), card('2', '♦'),
    card('2', '♠'), card('2', '♠'), card('2', '♣'), card('2', '♣'),
  ];
  const hand = [...lowCards, ...highCards];

  const move = chooseWithBase(
    () => highCards.slice(0, 3),
    hand,
    { type: 'triple', rank: '8' },
    {},
  );

  assert.equal(move.length, 3);
  assert.ok(move.every(item => item.rank === '9'));
  assert.equal(detectPattern(move).type, 'triple');

  const remainingHigh = hand.filter(item => item.rank === '2' && !move.some(played => played.id === item.id));
  assert.equal(remainingHigh.length, 8);
  assert.equal(detectPattern(remainingHigh).bombType, 'same8');
});

console.log('重叠炸弹保护测试全部通过。');