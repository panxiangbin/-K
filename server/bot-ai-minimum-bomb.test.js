const assert = require('node:assert/strict');
const {
  chooseBotMove,
  chooseWithBase,
  bombStrength,
} = require('./bot-ai-bomb-preservation');
const { detectPattern, comparePatterns } = require('./game-logic');

let nextId = 1;
function card(rank, suit = '♠') {
  return { rank, suit, id: `minimum-bomb-${nextId++}` };
}

function pattern(cards) {
  return detectPattern(cards);
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

function fiftyK(suit) {
  return [card('5', suit), card('10', suit), card('K', suit)];
}

function colorFour(rank, color) {
  return color === 'black'
    ? [card(rank, '♠'), card(rank, '♣'), card(rank, '♠'), card(rank, '♣')]
    : [card(rank, '♥'), card(rank, '♦'), card(rank, '♥'), card(rank, '♦')];
}

run('高分牌堆且下家只剩一张时，普通单张能压也绝不提前炸', () => {
  const safeSingle = card('6', '♦');
  const hand = [safeSingle, ...fiftyK('♠')];
  const lastPlay = { type: 'single', rank: '4' };

  const move = chooseBotMove(hand, lastPlay, { pileScore: 35, minOpponentCards: 1 });
  assert.equal(move.length, 1);
  assert.equal(move[0].id, safeSingle.id);
  assert.equal(pattern(move).type, 'single');
  assert.ok(comparePatterns(pattern(move), lastPlay));
});

run('没有普通牌可压时，使用最低花色的最小五十K炸弹', () => {
  const diamond50K = fiftyK('♦');
  const spade50K = fiftyK('♠');
  const redFour = colorFour('7', 'red');
  const hand = [...diamond50K, ...spade50K, ...redFour];
  const lastPlay = { type: 'single', rank: '2' };

  const move = chooseWithBase(() => redFour, hand, lastPlay, { pileScore: 5, minOpponentCards: 6 });
  const movePattern = pattern(move);
  assert.equal(movePattern.type, 'bomb');
  assert.equal(movePattern.bombType, '50K');
  assert.equal(movePattern.suit, '♦');
  assert.equal(bombStrength(move), bombStrength(diamond50K));
});

run('压五十K炸弹时，选择刚好够用的最低花色五十K', () => {
  const club50K = fiftyK('♣');
  const spade50K = fiftyK('♠');
  const redFour = colorFour('6', 'red');
  const hand = [...club50K, ...spade50K, ...redFour];
  const lastPlay = { type: 'bomb', bombType: '50K', rank: 'K', suit: '♦' };

  const move = chooseWithBase(() => redFour, hand, lastPlay, {});
  const movePattern = pattern(move);
  assert.equal(movePattern.bombType, '50K');
  assert.equal(movePattern.suit, '♣');
  assert.ok(comparePatterns(movePattern, lastPlay));
});

run('同级色四炸中使用刚好压住的黑七，不浪费更高点红八', () => {
  const blackSeven = colorFour('7', 'black');
  const redEight = colorFour('8', 'red');
  const hand = [...blackSeven, ...redEight];
  const lastPlay = { type: 'bomb', bombType: 'color4', rank: '7', color: 'red' };

  const move = chooseWithBase(() => redEight, hand, lastPlay, {});
  const movePattern = pattern(move);
  assert.equal(movePattern.bombType, 'color4');
  assert.equal(movePattern.rank, '7');
  assert.equal(movePattern.color, 'black');
  assert.ok(comparePatterns(movePattern, lastPlay));
});

run('整手炸弹可以一手出完时直接出完，不为普通跟牌拆炸弹', () => {
  const hand = fiftyK('♠');
  const lastPlay = { type: 'single', rank: '2' };

  const move = chooseBotMove(hand, lastPlay, { pileScore: 30, minOpponentCards: 1 });
  assert.equal(move.length, hand.length);
  assert.equal(pattern(move).type, 'bomb');
  assert.equal(pattern(move).bombType, '50K');
});

console.log('最低够用炸弹与普通牌优先测试全部通过。');