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
  assert.strictEqual(context.nextOpponentId, 'next');
  assert.strictEqual(context.nextOpponentSeatDistance, 1);
  assert.strictEqual(context.activeOpponentCount, 3);
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
  assert.strictEqual(context.minOpponentCards, 5, '低分牌堆不应因远处玩家一张牌就过度防守');
  assert.strictEqual(context.threatSource, 'table-watch');
}

{
  const room = {
    players: [player('bot', 8), player('next', 5), player('far', 1), player('other', 6)],
    pile: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }],
  };
  const context = getBotTurnContext(room, 0, 'bot', scorePile);
  assert.strictEqual(context.pileScore, 20);
  assert.strictEqual(context.nextOpponentCards, 5);
  assert.strictEqual(context.globalMinOpponentCards, 1);
  assert.strictEqual(context.minOpponentCards, 1, '高分牌堆应升级远处残局玩家为紧急威胁');
  assert.strictEqual(context.threatSource, 'table');
}

{
  const room = {
    players: [player('far', 1), player('bot', 6), player('left', 3, { left: true }), player('finished', 0), player('next', 2)],
    pile: [],
  };
  const context = getBotTurnContext(room, 1, 'bot', scorePile);
  assert.strictEqual(context.nextOpponentCards, 2, '应跳过已离场和已出完玩家寻找真正下家');
  assert.strictEqual(context.nextOpponentId, 'next');
  assert.strictEqual(context.nextOpponentSeatDistance, 3);
  assert.strictEqual(context.activeOpponentCount, 2);
  assert.strictEqual(context.minOpponentCards, 2);
  assert.strictEqual(context.threatSource, 'next');
}

{
  const room = {
    players: [player('next', 3), player('left', 2, { left: true }), player('bot', 6), player('finished', 0)],
    pile: [],
  };
  const context = getBotTurnContext(room, 2, 'bot', scorePile);
  assert.strictEqual(context.nextOpponentId, 'next', '座位末端应环形回到第一位有效对手');
  assert.strictEqual(context.nextOpponentCards, 3);
  assert.strictEqual(context.nextOpponentSeatDistance, 2);
  assert.strictEqual(context.threatSource, 'next');
}

{
  const room = {
    players: [player('bot', 4), player('left', 3, { left: true }), player('finished', 0)],
    pile: [],
  };
  const context = getBotTurnContext(room, 0, 'bot', scorePile);
  assert.strictEqual(context.minOpponentCards, Infinity);
  assert.strictEqual(context.nextOpponentCards, Infinity);
  assert.strictEqual(context.nextOpponentId, null);
  assert.strictEqual(context.nextOpponentSeatDistance, Infinity);
  assert.strictEqual(context.activeOpponentCount, 0);
  assert.strictEqual(context.threatSource, 'none');
}

console.log('bot-context tests passed');