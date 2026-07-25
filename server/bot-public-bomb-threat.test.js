const assert = require('node:assert/strict');
const { detectPattern } = require('./game-logic');
const { summarizePublicPlays } = require('./bot-context');
const {
  controlReliability,
  exactRouteResilience,
  publicBombReliabilityBonus,
} = require('./bot-ai-lead-resilience');

let nextId = 1;
function card(rank, suit = '♠') {
  return { rank, suit, id: `public-bomb-${nextId++}` };
}

function fiftyK(suit = '♦') {
  return [card('5', suit), card('10', suit), card('K', suit)];
}

function colorFour(rank = '7', color = 'red') {
  return color === 'black'
    ? [card(rank, '♠'), card(rank, '♣'), card(rank, '♠'), card(rank, '♣')]
    : [card(rank, '♥'), card(rank, '♦'), card(rank, '♥'), card(rank, '♦')];
}

function sameEight(rank = '9') {
  return ['♠', '♥', '♣', '♦', '♠', '♥', '♣', '♦'].map(suit => card(rank, suit));
}

function jokerFour() {
  return [card('小王', 'JOKER'), card('小王', 'JOKER'), card('大王', 'JOKER'), card('大王', 'JOKER')];
}

const exposed = summarizePublicPlays([
  { type: 'bomb', bombType: 'color4', count: 4 },
  { type: 'bomb', bombType: 'same8', count: 8 },
  { type: 'bomb', bombType: 'joker4', count: 4 },
]);
assert.deepStrictEqual(exposed.publicBombCounts, { color4: 1, same8: 1, joker4: 1 });

assert.equal(publicBombReliabilityBonus('50K', {}), 0, '没有公开炸弹时不得凭空提高可靠性');
assert.equal(publicBombReliabilityBonus('50K', exposed), 60, '公开的更高级炸弹应降低五十K面对未知炸弹的风险');
assert.equal(publicBombReliabilityBonus('color4', exposed), 35, '色四只统计八张同点和四王等更高级炸弹');
assert.equal(publicBombReliabilityBonus('same8', exposed), 15, '八张同点只受已公开四王影响');
assert.equal(publicBombReliabilityBonus('joker4', exposed), 0, '最大四王不能再因低级炸弹获得加成');

const lowerOnly = { publicBombCounts: { '50K': 8, color4: 3 } };
assert.equal(publicBombReliabilityBonus('same8', lowerOnly), 0, '已公开的低级炸弹不能提高更高级炸弹评分');

const capped = { publicBombCounts: { color4: 99, same8: 99, joker4: 99 } };
assert.equal(publicBombReliabilityBonus('50K', capped), 80, '公开炸弹加成必须封顶，不能颠倒固定炸弹等级');

const diamond50K = fiftyK('♦');
const redFour = colorFour('7', 'red');
const eightNine = sameEight('9');
const kings = jokerFour();
const fiftyPattern = detectPattern(diamond50K);
const colorPattern = detectPattern(redFour);
const eightPattern = detectPattern(eightNine);
const kingPattern = detectPattern(kings);

const fiftyWithHistory = controlReliability(diamond50K, fiftyPattern, capped, diamond50K);
const colorWithoutHistory = controlReliability(redFour, colorPattern, {}, redFour);
assert.ok(colorWithoutHistory > fiftyWithHistory, '即使公开更高炸弹很多，色四仍必须大于五十K');
assert.ok(controlReliability(eightNine, eightPattern, {}, eightNine) > colorWithoutHistory, '八张同点固定高于色四');
assert.ok(controlReliability(kings, kingPattern, {}, kings) > controlReliability(eightNine, eightPattern, capped, eightNine), '四王始终最大');

const baseRoute = exactRouteResilience(diamond50K, {});
const informedRoute = exactRouteResilience(diamond50K, exposed);
assert.equal(informedRoute - baseRoute, 60, '精确残局路线必须实际使用公开炸弹校准');

const ordinaryPair = [card('A', '♠'), card('A', '♥')];
const pairPattern = detectPattern(ordinaryPair);
assert.equal(
  controlReliability(ordinaryPair, pairPattern, exposed, ordinaryPair),
  controlReliability(ordinaryPair, pairPattern, {}, ordinaryPair),
  '公开炸弹统计不能直接改写普通牌固定大小',
);

console.log('公开炸弹威胁与固定等级回归测试全部通过。');
