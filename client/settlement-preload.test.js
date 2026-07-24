import assert from 'node:assert/strict';
import { getSettlementPreloadPolicy, isSettlementImminent, scheduleSettlementPreload } from './src/settlement-preload.js';

function createFakeWindow() {
  let nextId = 1;
  const timers = new Map();
  const idle = new Map();
  return {
    timers,
    idle,
    setTimeout(fn, delay) { const id = nextId++; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestIdleCallback(fn, options) { const id = nextId++; idle.set(id, { fn, options }); return id; },
    cancelIdleCallback(id) { idle.delete(id); },
  };
}

assert.equal(getSettlementPreloadPolicy({ saveData: true }).enabled, false);
assert.equal(getSettlementPreloadPolicy({ effectiveType: '2g' }).enabled, false);
assert.equal(getSettlementPreloadPolicy({ effectiveType: '3g' }).delayMs, 6000);
assert.equal(getSettlementPreloadPolicy({ effectiveType: '4g' }).delayMs, 1200);

assert.equal(isSettlementImminent({ status: 'waiting', players: [{ cardCount: 1 }] }), false);
assert.equal(isSettlementImminent({ status: 'playing', players: [{ cardCount: 7 }] }), false);
assert.equal(isSettlementImminent({ status: 'playing', players: [{ cardCount: 5 }] }), true);
assert.equal(isSettlementImminent({ status: 'playing', players: [{ cardCount: 1, left: true }] }), false);
assert.equal(isSettlementImminent({ status: 'playing', players: [{ cardCount: 0 }] }), false);

{
  const windowObject = createFakeWindow();
  let calls = 0;
  const task = scheduleSettlementPreload({
    windowObject,
    navigatorObject: { connection: { effectiveType: '4g' } },
    preload: () => { calls += 1; },
  });
  assert.equal(windowObject.timers.size, 1);
  const [{ fn, delay }] = windowObject.timers.values();
  assert.equal(delay, 1200);
  fn();
  assert.equal(windowObject.idle.size, 1);
  const [{ fn: idleFn }] = windowObject.idle.values();
  idleFn();
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(task.preloadNow(), false);
}

{
  const windowObject = createFakeWindow();
  let calls = 0;
  const task = scheduleSettlementPreload({
    windowObject,
    navigatorObject: { connection: { saveData: true } },
    preload: () => { calls += 1; },
  });
  assert.equal(windowObject.timers.size, 0);
  assert.equal(task.preloadNow(), true);
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(task.preloadNow(), false);
}

{
  const windowObject = createFakeWindow();
  let calls = 0;
  const task = scheduleSettlementPreload({
    windowObject,
    navigatorObject: { connection: { effectiveType: '3g' } },
    preload: () => { calls += 1; },
  });
  assert.equal(windowObject.timers.size, 1);
  assert.equal(task.preloadNow(), true);
  assert.equal(windowObject.timers.size, 0);
  task.cancel();
  await Promise.resolve();
  assert.equal(calls, 1);
}

assert.throws(() => scheduleSettlementPreload({}), /required/);
console.log('settlement preload tests passed');
