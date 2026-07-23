const assert = require('node:assert/strict');
const { chooseBotMove } = require('./bot-ai');
const { detectPattern } = require('./game-logic');

let nextId = 1;
function card(rank, suit = '♠') {
  return { rank, suit, id: `test-${nextId++}` };
}

function ranks(cards) {
  return cards.map(item => item.rank);
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

run('先手有三个3时整组出三张，不拆成单张', () => {
  const hand = [card('3', '♠'), card('3', '♥'), card('3', '♣'), card('4', '♦')];
  const move = chooseBotMove(hand, null);
  assert.equal(move.length, 3);
  assert.deepEqual(ranks(move), ['3', '3', '3']);
  assert.equal(detectPattern(move).type, 'triple');
});

run('先手有对子时优先完整打出对子', () => {
  const hand = [card('3', '♠'), card('3', '♥'), card('4', '♦')];
  const move = chooseBotMove(hand, null);
  assert.equal(move.length, 2);
  assert.deepEqual(ranks(move), ['3', '3']);
  assert.equal(detectPattern(move).type, 'pair');
});

run('跟单张时使用独立单张，不拆三张牌组', () => {
  const hand = [card('5', '♠'), card('5', '♥'), card('5', '♣'), card('6', '♦')];
  const move = chooseBotMove(hand, { type: 'single', rank: '4' });
  assert.equal(move.length, 1);
  assert.equal(move[0].rank, '6');
});

run('跟对子时使用完整对子，不拆三张牌组', () => {
  const hand = [
    card('5', '♠'), card('5', '♥'), card('5', '♣'),
    card('6', '♠'), card('6', '♥'),
  ];
  const move = chooseBotMove(hand, { type: 'pair', rank: '4' });
  assert.equal(move.length, 2);
  assert.deepEqual(ranks(move), ['6', '6']);
});

run('有普通小牌时不拆同花五十K炸弹', () => {
  const hand = [card('5', '♠'), card('10', '♠'), card('K', '♠'), card('3', '♦')];
  const move = chooseBotMove(hand, null);
  assert.equal(move.length, 1);
  assert.equal(move[0].rank, '3');
});

run('只剩一个合法牌组时一手出完', () => {
  const hand = [card('7', '♠'), card('7', '♥')];
  const move = chooseBotMove(hand, null);
  assert.equal(move.length, 2);
  assert.equal(detectPattern(move).type, 'pair');
});

run('普通局面跟单张仍优先最小普通牌，不浪费炸弹', () => {
  const hand = [
    card('6', '♦'),
    card('5', '♠'), card('10', '♠'), card('K', '♠'),
  ];
  const move = chooseBotMove(hand, { type: 'single', rank: '4' }, { pileScore: 5, minOpponentCards: 6 });
  assert.equal(move.length, 1);
  assert.equal(move[0].rank, '6');
});

run('对手只剩一张且牌堆分高时，允许用最小炸弹抢回牌权', () => {
  const hand = [
    card('6', '♦'),
    card('5', '♠'), card('10', '♠'), card('K', '♠'),
  ];
  const move = chooseBotMove(hand, { type: 'single', rank: '4' }, { pileScore: 30, minOpponentCards: 1 });
  const pattern = detectPattern(move);
  assert.equal(pattern.type, 'bomb');
  assert.equal(pattern.bombType, '50K');
});

console.log('智能电脑策略测试全部通过。');