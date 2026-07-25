const assert = require('node:assert/strict');
const { chooseBotMove } = require('./bot-ai');

let nextId = 1;
function card(rank, suit) {
  return { rank, suit, id: `50k-lead-${nextId++}` };
}

function add50K(hand, suit, count = 1) {
  for (let index = 0; index < count; index++) {
    hand.push(card('5', suit), card('10', suit), card('K', suit));
  }
}

function countSuit50KBombs(hand, move, suit) {
  const playedIds = new Set(move.map(item => item.id));
  const remaining = hand.filter(item => !playedIds.has(item.id));
  const countRank = rank => remaining.filter(item => item.rank === rank && item.suit === suit).length;
  return Math.min(countRank('5'), countRank('10'), countRank('K'));
}

function countAll50KBombs(hand, move) {
  return ['♠', '♥', '♣', '♦']
    .reduce((total, suit) => total + countSuit50KBombs(hand, move, suit), 0);
}

// 两套同花五十K中，每个点数都有对子候选。先手不能为了少一手直接拆两张，
// 应只动一张受保护牌，至少完整保留另一套炸弹。
for (const rank of ['5', '10', 'K']) {
  nextId = 1;
  const hand = [];
  add50K(hand, '♠', 2);

  const move = chooseBotMove(hand, null);
  assert.equal(move.length, 1, `先手不应把两张${rank}从两套五十K中一起拆出`);
  assert.equal(countSuit50KBombs(hand, move, '♠'), 1);
}

// 三套不同花色五十K会产生三张同点候选。仍应只拆一张，保留其余两套。
nextId = 1;
const tripleRiskHand = [];
add50K(tripleRiskHand, '♠');
add50K(tripleRiskHand, '♥');
add50K(tripleRiskHand, '♣');
const tripleRiskMove = chooseBotMove(tripleRiskHand, null);
assert.equal(tripleRiskMove.length, 1, '先手不应一次拆三套五十K组成三张');
assert.equal(countAll50KBombs(tripleRiskHand, tripleRiskMove), 2);

// 有完全不属于炸弹的普通牌时，先手必须优先使用安全牌，一张五十K也不能动。
nextId = 1;
const safeHand = [];
add50K(safeHand, '♠', 2);
safeHand.push(card('4', '♥'), card('4', '♦'));
const safeMove = chooseBotMove(safeHand, null);
assert.ok(safeMove.every(item => item.rank === '4'), '存在安全普通牌时不应拆五十K');
assert.equal(countSuit50KBombs(safeHand, safeMove, '♠'), 2);

console.log('五十K先手保护测试全部通过。');
