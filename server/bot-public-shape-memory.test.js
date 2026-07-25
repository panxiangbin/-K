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

assert.strictEqual(recentShapePressure(2, summary), 30);
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
assert.strictEqual(recentShapePressure(2, distanceAware), 45, '真正下家的两次对子应高于远处一次对子');
assert.strictEqual(recentShapePressure(3, distanceAware), 5, '远处玩家牌型只产生轻度压力');

const nextOnly = { nextOpponentPlayCounts: { 2: 4 }, tableOpponentPlayCounts: {} };
const farOnly = { nextOpponentPlayCounts: {}, tableOpponentPlayCounts: { 2: 4 } };
assert.strictEqual(recentShapePressure(2, nextOnly), 80);
assert.strictEqual(recentShapePressure(2, farOnly), 20);

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

const pair9 = [card('9', '♠', '9a'), card('9', '♥', '9b')];
const pattern = detectPattern(pair9);
const base = controlReliability(pair9, pattern, { recentPlayCounts: {} }, pair9);
const pressured = controlReliability(pair9, pattern, { recentPlayCounts: { 2: 3 } }, pair9);
assert.strictEqual(pressured - base, 45);
const nextPressured = controlReliability(pair9, pattern, nextOnly, pair9);
const farPressured = controlReliability(pair9, pattern, farOnly, pair9);
assert.strictEqual(nextPressured - farPressured, 60, '真正下家的对子趋势应显著高于远处玩家');

const longHistory = Array.from({ length: 20 }, (_, index) => ({ type: 'single', count: index < 8 ? 1 : 2 }));
const bounded = summarizePublicPlays(longHistory);
assert.strictEqual(bounded.recentPlayCounts[1] || 0, 0, '只统计最近12手');
assert.strictEqual(bounded.recentPlayCounts[2], 12);

console.log('distance-aware public shape memory tests passed');