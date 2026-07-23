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
  assert.strictEqual(context.minOpponentCards, 2, '应优先判断紧接着行动的下家，而不是远处的一张牌玩家');
  assert.strictEqual(context.globalMinOpponentCards, 1);
}

{
  const room = {
    players: [player('far', 1), player('bot', 6), player('left', 3, { left: true }), player('next', 2)],
    pile: [],
  };
  const context = getBotTurnContext(room, 1, 'bot', scorePile);
  assert.strictEqual(context.nextOpponentCards, 2, '应跳过已离场玩家并按座位循环寻找下家');
  assert.strictEqual(context.minOpponentCards, 2);
}

{
  const room = { players: [player('bot', 4)], pile: [] };
  const context = getBotTurnContext(room, 0, 'bot', scorePile);
  assert.strictEqual(context.minOpponentCards, Infinity);
  assert.strictEqual(context.nextOpponentCards, Infinity);
}

console.log('bot-context tests passed');
