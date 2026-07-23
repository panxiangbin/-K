const assert = require('node:assert/strict');
const { chooseBotMove } = require('./bot-ai');
const { detectPattern } = require('./game-logic');

let nextId = 1;
function card(rank, suit = '♠') {
  return { rank, suit, id: `shape-${nextId++}` };
}

function run(name, fn) {
  nextId = 1;
  fn();
  console.log(`✓ ${name}`);
}

run('对手剩两张时避免主动出对子', () => {
  const hand = [card('3', '♦'), card('A', '♠'), card('A', '♥')];
  const move = chooseBotMove(hand, null, { minOpponentCards: 2 });
  assert.equal(move.length, 1);
  assert.equal(move[0].rank, '3');
  assert.equal(detectPattern(move).type, 'single');
});

run('对手剩三张时避免主动出三张', () => {
  const hand = [card('3', '♦'), card('A', '♠'), card('A', '♥'), card('A', '♣')];
  const move = chooseBotMove(hand, null, { minOpponentCards: 3 });
  assert.equal(move.length, 1);
  assert.equal(move[0].rank, '3');
  assert.equal(detectPattern(move).type, 'single');
});

run('自己能一手出完时不受封锁策略影响', () => {
  const hand = [card('7', '♠'), card('7', '♥')];
  const move = chooseBotMove(hand, null, { minOpponentCards: 2 });
  assert.equal(move.length, 2);
  assert.equal(detectPattern(move).type, 'pair');
});

console.log('对手剩余张数封锁策略测试全部通过。');
