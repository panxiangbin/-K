'use strict';

const assert = require('assert');
const gameLogic = require('./game-logic');
const { installJokerPairRule, isForbiddenJokerPair } = require('./joker-pair-rule');

installJokerPairRule(gameLogic);

const smallJokers = [
  { rank: '小王', suit: 'joker', id: 's1' },
  { rank: '小王', suit: 'joker', id: 's2' },
];
const bigJokers = [
  { rank: '大王', suit: 'joker', id: 'b1' },
  { rank: '大王', suit: 'joker', id: 'b2' },
];
const mixedJokers = [smallJokers[0], bigJokers[0]];
const normalPair = [
  { rank: '9', suit: '♠', id: 'n1' },
  { rank: '9', suit: '♥', id: 'n2' },
];

assert.equal(isForbiddenJokerPair(smallJokers), true);
assert.equal(isForbiddenJokerPair(bigJokers), true);
assert.equal(isForbiddenJokerPair(mixedJokers), true);
assert.equal(isForbiddenJokerPair(normalPair), false);
assert.equal(gameLogic.detectPattern(smallJokers), null, '两个小王不能作为对子');
assert.equal(gameLogic.detectPattern(bigJokers), null, '两个大王不能作为对子');
assert.equal(gameLogic.detectPattern(mixedJokers), null, '大小王不能作为对子');
assert.deepEqual(gameLogic.detectPattern(normalPair), { type: 'pair', rank: '9' });

for (const count of [5, 6, 7]) {
  const cards = Array.from({ length: count }, (_, index) => ({ rank: 'Q', suit: ['♠','♥','♣','♦'][index % 4], id: `q-${count}-${index}` }));
  assert.equal(gameLogic.detectPattern(cards)?.type, { 5: 'five', 6: 'six', 7: 'seven' }[count]);
}
const eight = Array.from({ length: 8 }, (_, index) => ({ rank: 'Q', suit: ['♠','♥','♣','♦'][index % 4], id: `q8-${index}` }));
assert.deepEqual(gameLogic.detectPattern(eight), { type: 'bomb', bombType: 'same8', rank: 'Q' });

console.log('joker pair runtime rule tests passed');
