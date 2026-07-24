import assert from 'node:assert/strict';
import { getPreloadPolicy, scheduleAdaptivePreload } from './src/adaptive-preload.js';

function createFakeWindow({ idle = true } = {}) {
  let nextId = 1;
  const timers = new Map();
  const idleCallbacks = new Map();

  return {
    setTimeout(callback, delay) {
      const id = nextId++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    requestIdleCallback: idle ? (callback, options) => {
      const id = nextId++;
      idleCallbacks.set(id, { callback, options });
      return id;
    } : undefined,
    cancelIdleCallback: idle ? (id) => idleCallbacks.delete(id) : undefined,
    runNextTimer() {
      const entry = timers.entries().next().value;
      if (!entry) return false;
      const [id, timer] = entry;
      timers.delete(id);
      timer.callback();
      return timer;
    },
    runNextIdle() {
      const entry = idleCallbacks.entries().next().value;
      if (!entry) return false;
      const [id, task] = entry;
      idleCallbacks.delete(id);
      task.callback();
      return task;
    },
    timerCount() {
      return timers.size;
    },
    idleCount() {
      return idleCallbacks.size;
    },
  };
}

assert.equal(getPreloadPolicy({ saveData: true }).enabled, false);
assert.equal(getPreloadPolicy({ effectiveType: 'slow-2g' }).enabled, false);
assert.equal(getPreloadPolicy({ effectiveType: '2g' }).enabled, false);
assert.deepEqual(getPreloadPolicy({ effectiveType: '3g' }), {
  enabled: true,
  delayMs: 4000,
  idleTimeoutMs: 5000,
  reason: '3g',
});
assert.equal(getPreloadPolicy({ effectiveType: '4g' }).delayMs, 600);

{
  const windowObject = createFakeWindow();
  let calls = 0;
  const task = scheduleAdaptivePreload({
    windowObject,
    navigatorObject: { connection: { saveData: true, effectiveType: '4g' } },
    preload: () => { calls += 1; },
  });
  assert.equal(task.policy.reason, 'save-data');
  assert.equal(windowObject.timerCount(), 0);
  assert.equal(calls, 0);
}

{
  const windowObject = createFakeWindow();
  let calls = 0;
  const task = scheduleAdaptivePreload({
    windowObject,
    navigatorObject: { connection: { effectiveType: '3g' } },
    preload: () => { calls += 1; },
  });
  const timer = windowObject.runNextTimer();
  assert.equal(timer.delay, 4000);
  assert.equal(windowObject.idleCount(), 1);
  const idleTask = windowObject.runNextIdle();
  assert.equal(idleTask.options.timeout, 5000);
  assert.equal(calls, 1);
  task.cancel();
}

{
  const windowObject = createFakeWindow({ idle: false });
  let calls = 0;
  const task = scheduleAdaptivePreload({
    windowObject,
    navigatorObject: { connection: { effectiveType: '4g' } },
    preload: () => { calls += 1; },
  });
  windowObject.runNextTimer();
  const fallback = windowObject.runNextTimer();
  assert.equal(fallback.delay, 1200);
  assert.equal(calls, 1);
  task.cancel();
}

{
  const windowObject = createFakeWindow();
  let calls = 0;
  const task = scheduleAdaptivePreload({
    windowObject,
    navigatorObject: {},
    preload: () => { calls += 1; },
  });
  task.cancel();
  assert.equal(windowObject.timerCount(), 0);
  assert.equal(windowObject.idleCount(), 0);
  assert.equal(calls, 0);
}

assert.throws(() => scheduleAdaptivePreload({}), /required/);
console.log('adaptive preload tests passed');
