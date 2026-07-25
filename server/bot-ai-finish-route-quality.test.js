const assert = require('node:assert/strict');
const { exactFinishProfile, remainingProfile, optimizeLeadMove } = require('./bot-ai-lead-strategy');

let nextId = 1;
function card(rank, suit = '♠') {
  return { rank, suit, id: `finish-route-${nextId++}` };
}

function run(name, fn) {
  nextId = 1;
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

run('同花五十K按一手计算，不再按三个点数组误算三手', () => {
  const cards = [card('5', '♠'), card('10', '♠'), card('K', '♠')];
  const profile = exactFinishProfile(cards);
  assert.equal(profile.turns, 1);
  assert.equal(profile.finalSize, 3);
  assert.equal(profile.finalPoints, 25);
});

run('五十K加对子准确识别为两手确定收尾路线', () => {
  const opener = card('3', '♦');
  const hand = [
    opener,
    card('5', '♠'), card('10', '♠'), card('K', '♠'),
    card('A', '♣'), card('A', '♦'),
  ];
  const profile = remainingProfile(hand, [opener]);
  assert.equal(profile.turns, 2);
  assert.equal(profile.remaining.length, 5);
});

run('同为最短路线时优先把零分高控制牌组作为最后一手', () => {
  const cards = [card('5', '♦'), card('A', '♠'), card('A', '♥')];
  const profile = exactFinishProfile(cards);
  assert.equal(profile.turns, 2);
  assert.equal(profile.finalPoints, 0);
  assert.equal(profile.finalSize, 2);
});

run('短残局优化会保留五十K加对子两手路线，不被旧点数组估算拖长', () => {
  const lowSingle = card('3', '♦');
  const pair = [card('A', '♣'), card('A', '♦')];
  const fiftyK = [card('5', '♠'), card('10', '♠'), card('K', '♠')];
  const hand = [lowSingle, ...pair, ...fiftyK];
  const move = optimizeLeadMove({
    hand,
    chosenCards: [lowSingle],
    context: { pileScore: 20, nextOpponentCards: 3, globalMinOpponentCards: 3, threatSource: 'next' },
  });
  const profile = remainingProfile(hand, move);
  assert.ok(profile.turns <= 2);
});

run('超过精确分析上限时安全回退，不阻塞正常AI', () => {
  const cards = Array.from({ length: 11 }, (_, index) => card(String((index % 9) + 3), index % 2 ? '♥' : '♠'));
  assert.equal(exactFinishProfile(cards), null);
});

console.log('精确残局手数、五十K路线与最后一手质量测试全部通过。');
