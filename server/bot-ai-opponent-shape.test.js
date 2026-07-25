const assert = require('node:assert/strict');
const { getBotTurnContext } = require('./bot-context');
const leadStrategy = require('./bot-ai-lead-strategy');
const { detectPattern } = require('./game-logic');

let nextId = 1;
function card(rank, suit = '♠') {
  return { rank, suit, id: `shape-${nextId++}` };
}

function player(id, cards, extra = {}) {
  return { id, left: false, hand: cards, ...extra };
}

function run(name, fn) {
  nextId = 1;
  fn();
  console.log(`✓ ${name}`);
}

const scorePile = cards => cards.reduce((sum, current) => sum + (current.points || 0), 0);

run('跳过离场和已出完座位后封锁真正下家的对子收尾', () => {
  const hand = [card('4', '♦'), card('4', '♣'), card('9', '♠'), card('9', '♥'), card('9', '♣')];
  const room = {
    players: [
      player('bot', hand),
      player('left', [card('3')], { left: true }),
      player('finished', []),
      player('true-next', [card('A'), card('A', '♥')]),
      player('far', [card('2')]),
    ],
    pile: [],
  };
  const context = getBotTurnContext(room, 0, 'bot', scorePile);
  const move = leadStrategy.chooseBotMove(hand, null, context);

  assert.equal(context.nextOpponentId, 'true-next');
  assert.equal(context.nextOpponentSeatDistance, 3);
  assert.equal(context.threatSource, 'next');
  assert.equal(move.length, 3, '真正下家剩两张时，不应主动领对子');
  assert.equal(detectPattern(move).type, 'triple');
});

run('座位环形回绕后封锁真正下家的三张收尾', () => {
  const hand = [card('4', '♦'), card('4', '♣'), card('4', '♥'), card('9', '♠'), card('9', '♥')];
  const room = {
    players: [
      player('true-next', [card('A'), card('A', '♥'), card('A', '♣')]),
      player('left', [card('3')], { left: true }),
      player('bot', hand),
      player('finished', []),
    ],
    pile: [{ points: 10 }, { points: 10 }],
  };
  const context = getBotTurnContext(room, 2, 'bot', scorePile);
  const move = leadStrategy.chooseBotMove(hand, null, context);

  assert.equal(context.nextOpponentId, 'true-next');
  assert.equal(context.nextOpponentSeatDistance, 2);
  assert.equal(context.threatSource, 'next');
  assert.equal(move.length, 2, '真正下家剩三张时，不应主动领三张');
  assert.equal(detectPattern(move).type, 'pair');
});

run('远处一张低分牌堆不能冒充紧邻下家', () => {
  const hand = [card('3', '♦'), card('A', '♠'), card('A', '♥')];
  const room = {
    players: [
      player('far', [card('2')]),
      player('left', [card('4')], { left: true }),
      player('bot', hand),
      player('true-next', [card('6'), card('7'), card('8'), card('9'), card('J')]),
    ],
    pile: [],
  };
  const context = getBotTurnContext(room, 2, 'bot', scorePile);
  const move = leadStrategy.chooseBotMove(hand, null, context);

  assert.equal(context.nextOpponentId, 'true-next');
  assert.equal(context.nextOpponentCards, 5);
  assert.equal(context.globalMinOpponentCards, 1);
  assert.equal(context.threatSource, 'table-watch');
  assert.equal(move.length, 1, '远处玩家一张且牌堆低分时，应保持正常最小单张先手');
  assert.equal(move[0].rank, '3');
});

run('无有效对手时保持基础策略且不触发封锁', () => {
  const hand = [card('3', '♦'), card('A', '♠'), card('A', '♥')];
  const room = {
    players: [player('bot', hand), player('left', [card('4')], { left: true }), player('finished', [])],
    pile: [{ points: 10 }, { points: 10 }, { points: 10 }],
  };
  const context = getBotTurnContext(room, 0, 'bot', scorePile);
  const move = leadStrategy.chooseBotMove(hand, null, context);

  assert.equal(context.activeOpponentCount, 0);
  assert.equal(context.threatSource, 'none');
  assert.equal(move.length, 1);
  assert.equal(move[0].rank, '3');
});

run('自己能一手出完时不受下家匹配牌型封锁', () => {
  const hand = [card('7', '♠'), card('7', '♥')];
  const room = {
    players: [player('bot', hand), player('next', [card('A'), card('A', '♥')])],
    pile: [],
  };
  const context = getBotTurnContext(room, 0, 'bot', scorePile);
  const move = leadStrategy.chooseBotMove(hand, null, context);
  assert.equal(move.length, 2);
  assert.equal(detectPattern(move).type, 'pair');
});

console.log('真实下家顺序与先手封锁集成测试全部通过。');