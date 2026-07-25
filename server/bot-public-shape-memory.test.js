const assert = require('assert');
const { summarizePublicPlays } = require('./bot-context');
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

const pair9 = [card('9', '♠', '9a'), card('9', '♥', '9b')];
const pattern = detectPattern(pair9);
const base = controlReliability(pair9, pattern, { recentPlayCounts: {} }, pair9);
const pressured = controlReliability(pair9, pattern, { recentPlayCounts: { 2: 3 } }, pair9);
assert.strictEqual(pressured - base, 45);

const longHistory = Array.from({ length: 20 }, (_, index) => ({ type: 'single', count: index < 8 ? 1 : 2 }));
const bounded = summarizePublicPlays(longHistory);
assert.strictEqual(bounded.recentPlayCounts[1] || 0, 0, '只统计最近12手');
assert.strictEqual(bounded.recentPlayCounts[2], 12);

console.log('recent public shape memory tests passed');
