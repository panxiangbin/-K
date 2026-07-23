const assert = require('assert');
const { getBotTurnContext } = require('./bot-context');

function player(id, cardCount, extra = {}) {
  return {
    id,
    left: false,
    hand: Array.from({ length: cardCount }, (_, index) => ({ id: `${id}-${index}` })),
    ...extra,
  };
}

const scorePile = cards => cards.length * 5;

{
  const room = {
    players: [player('bot', 6), player('next', 2), player('far', 1), player('other', 5)],
    pile: [{ id: 'p1' }, { id: 'p2' }],
  };
  const context = getBotTurnContext(room, 0, 'bot', scorePile);
  assert.strictEqual(context.pileScore, 10);
  assert.strictEqual(context.nextOpponentCards, 2);
  assert.strictEqual(context.minOpponentCards, 2, '下家已进入收尾区时，应优先判断马上行动的人');
  assert.strictEqual(context.globalMinOpponentCards, 1);
  assert.strictEqual(context.threatSource, 'next');
}

{
  const room = {
    players: [player('bot', 8), player('next', 5), player('far', 1), player('other', 6)],
    pile: [],
  };
  const context = getBotTurnContext(room, 0, 'bot', scorePile);
  assert.strictEqual(context.nextOpponentCards, 5);
  assert.strictEqual(context.globalMinOpponentCards, 1);
  assert.strictEqual(context.minOpponentCards, 1, '下家暂时安全时，应提前防范全桌只剩一张的玩家');
  assert.strictEqual(context.threatSource, 'table');
}

{
  const room = {
    players: [player('far', 1), player('bot', 6), player('left', 3, { left: true }), player('next', 2)],
    pile: [],
  };
  const context = getBotTurnContext(room, 1, 'bot', scorePile);
  assert.strictEqual(context.nextOpponentCards, 2, '应跳过已离场玩家并按座位循环寻找下家');
  assert.strictEqual(context.minOpponentCards, 2);
  assert.strictEqual(context.threatSource, 'next');
}

{
  const room = { players: [player('bot', 4)], pile: [] };
  const context = getBotTurnContext(room, 0, 'bot', scorePile);
  assert.strictEqual(context.minOpponentCards, Infinity);
  assert.strictEqual(context.nextOpponentCards, Infinity);
  assert.strictEqual(context.threatSource, 'none');
}

console.log('bot-context tests passed');
