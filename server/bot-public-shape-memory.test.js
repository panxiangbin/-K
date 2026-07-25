const assert = require('assert');
const { summarizePublicPlays, getBotTurnContext } = require('./bot-context');
const { recentShapePressure, controlReliability } = require('./bot-ai-lead-resilience');
const { detectPattern } = require('./game-logic');

function card(rank, suit, id) { return { rank, suit, id }; }

const summary = summarizePublicPlays([
  { type: 'single', count: 1 },
  { type: 'pair', count: 2 },
  { type: 'pair', count: 2 },
  { type: 'bomb', bombType: '50K', count: 3 },
  { type: 'bomb', bombType: 'color4', count: 4 },
]);
assert.deepStrictEqual(summary.recentPlayCounts, { 1: 1, 2: 2, 3: 1, 4: 1 });
assert.deepStrictEqual(summary.publicBombCounts, { '50K': 1, color4: 1 });
assert.strictEqual(summary.publicBombTotal, 2);
assert.strictEqual(summary.recentPlayType, 'bomb');
assert.strictEqual(summary.recentPlayCount, 4);

assert.strictEqual(recentShapePressure(2, summary), 30, '无玩家归属的旧记录应保持兼容评分');
assert.strictEqual(recentShapePressure(3, summary), 15);
assert.strictEqual(recentShapePressure(7, summary), 0);
assert.strictEqual(recentShapePressure(2, { recentPlayCounts: { 2: 99 } }), 60);

const distanceAware = summarizePublicPlays([
  { playerId: 'bot', type: 'pair', count: 2 },
  { playerId: 'next', type: 'pair', count: 2 },
  { playerId: 'next', type: 'pair', count: 2 },
  { playerId: 'far', type: 'pair', count: 2 },
  { playerId: 'far', type: 'triple', count: 3 },
], { botPlayerId: 'bot', nextOpponentId: 'next' });
assert.deepStrictEqual(distanceAware.opponentPlayCounts, { 2: 3, 3: 1 });
assert.deepStrictEqual(distanceAware.nextOpponentPlayCounts, { 2: 2 });
assert.deepStrictEqual(distanceAware.tableOpponentPlayCounts, { 2: 1, 3: 1 });
assert.strictEqual(distanceAware.nextOpponentRecentType, 'pair');
assert.strictEqual(distanceAware.nextOpponentRecentCount, 2);
assert.deepStrictEqual(distanceAware.nextOpponentRecentShapeScores, { 2: 25 });
assert.deepStrictEqual(distanceAware.tableOpponentRecentShapeScores, { 2: 4, 3: 5 });
assert.strictEqual(distanceAware.nextOpponentShapeStreakCount, 2);
assert.strictEqual(distanceAware.nextOpponentShapeStreakLength, 2);
assert.strictEqual(recentShapePressure(2, distanceAware), 39, '较早的对子应衰减，连续对子额外加权');
assert.strictEqual(recentShapePressure(3, distanceAware), 5, '远处玩家最新牌型只产生轻度压力');

const nextOnly = { nextOpponentPlayCounts: { 2: 4 }, tableOpponentPlayCounts: {} };
const farOnly = { nextOpponentPlayCounts: {}, tableOpponentPlayCounts: { 2: 4 } };
assert.strictEqual(recentShapePressure(2, nextOnly), 80);
assert.strictEqual(recentShapePressure(2, farOnly), 20);

const continuousPairs = summarizePublicPlays([
  { playerId: 'next', type: 'pair', count: 2 },
  { playerId: 'far', type: 'single', count: 1 },
  { playerId: 'next', type: 'pair', count: 2 },
  { playerId: 'next', type: 'pair', count: 2 },
], { nextOpponentId: 'next' });
assert.strictEqual(continuousPairs.nextOpponentShapeStreakLength, 3, '下家自己的连续牌型不应被远处玩家插手打断');
assert.strictEqual(recentShapePressure(2, continuousPairs), 68);

const brokenStreak = summarizePublicPlays([
  { playerId: 'next', type: 'pair', count: 2 },
  { playerId: 'next', type: 'triple', count: 3 },
  { playerId: 'next', type: 'pair', count: 2 },
], { nextOpponentId: 'next' });
assert.strictEqual(brokenStreak.nextOpponentShapeStreakLength, 1);
assert.strictEqual(recentShapePressure(2, brokenStreak), 34, '非连续对子不能获得连续加成');

const oneCardThreat = {
  nextOpponentCards: 1,
  nextOpponentRecentShapeScores: { 1: 8, 2: 90 },
  tableOpponentRecentShapeScores: {},
  nextOpponentShapeStreakCount: 2,
  nextOpponentShapeStreakLength: 4,
};
assert.strictEqual(recentShapePressure(1, oneCardThreat), 100, '下家一张时单张威胁必须覆盖历史趋势');
assert.strictEqual(recentShapePressure(2, oneCardThreat), 20, '下家一张时对子趋势只能保留次要影响');

const room = {
  pile: [],
  playedCards: [],
  publicPlays: [
    { playerId: 'bot', type: 'pair', count: 2 },
    { playerId: 'left', type: 'pair', count: 2 },
    { playerId: 'next', type: 'triple', count: 3 },
    { playerId: 'next', type: 'triple', count: 3 },
  ],
  players: [
    { id: 'bot', hand: [card('3', '♠', 'b1')] },
    { id: 'left', left: true, hand: [card('4', '♠', 'l1')] },
    { id: 'next', hand: [card('5', '♠', 'n1'), card('5', '♥', 'n2'), card('5', '♣', 'n3')] },
  ],
};
const context = getBotTurnContext(room, 0, 'bot', () => 0);
assert.strictEqual(context.nextOpponentId, 'next');
assert.deepStrictEqual(context.nextOpponentPlayCounts, { 3: 2 });
assert.deepStrictEqual(context.tableOpponentPlayCounts, { 2: 1 });
assert.strictEqual(context.nextOpponentRecentCount, 3);
assert.strictEqual(context.nextOpponentShapeStreakCount, 3);
assert.strictEqual(context.nextOpponentShapeStreakLength, 2);
assert.strictEqual(recentShapePressure(3, context), 47);

const pair9 = [card('9', '♠', '9a'), card('9', '♥', '9b')];
const pattern = detectPattern(pair9);
const base = controlReliability(pair9, pattern, { recentPlayCounts: {} }, pair9);
const pressured = controlReliability(pair9, pattern, { recentPlayCounts: { 2: 3 } }, pair9);
assert.strictEqual(pressured - base, 45);
const nextPressured = controlReliability(pair9, pattern, nextOnly, pair9);
const farPressured = controlReliability(pair9, pattern, farOnly, pair9);
assert.strictEqual(nextPressured - farPressured, 60, '旧版真正下家权重仍应显著高于远处玩家');

const recentPair = summarizePublicPlays([
  { playerId: 'next', type: 'pair', count: 2 },
  { playerId: 'far', type: 'single', count: 1 },
  { playerId: 'far', type: 'single', count: 1 },
  { playerId: 'next', type: 'pair', count: 2 },
], { nextOpponentId: 'next' });
const oldPair = summarizePublicPlays([
  { playerId: 'next', type: 'pair', count: 2 },
  { playerId: 'next', type: 'pair', count: 2 },
  { playerId: 'far', type: 'single', count: 1 },
  { playerId: 'far', type: 'single', count: 1 },
], { nextOpponentId: 'next' });
assert(recentShapePressure(2, recentPair) > recentShapePressure(2, oldPair), '越近的下家牌型必须拥有更高权重');

const longHistory = Array.from({ length: 20 }, (_, index) => ({ type: 'single', count: index < 8 ? 1 : 2 }));
const bounded = summarizePublicPlays(longHistory);
assert.strictEqual(bounded.recentPlayCounts[1] || 0, 0, '只统计最近12手');
assert.strictEqual(bounded.recentPlayCounts[2], 12);

console.log('recency, streak and one-card public shape tests passed');