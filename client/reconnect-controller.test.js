import assert from 'node:assert/strict';
import { createReconnectController } from './src/reconnect-controller.js';

function createFakeTimers() {
  let id = 0;
  const timers = new Map();
  return {
    setTimer(callback, delay) {
      const timerId = ++id;
      timers.set(timerId, { callback, delay });
      return timerId;
    },
    clearTimer(timerId) {
      timers.delete(timerId);
    },
    runNext() {
      const entry = [...timers.entries()][0];
      assert.ok(entry, 'expected a scheduled timer');
      const [timerId, timer] = entry;
      timers.delete(timerId);
      timer.callback();
      return timer.delay;
    },
    size() {
      return timers.size;
    },
    nextDelay() {
      return [...timers.values()][0]?.delay ?? null;
    },
  };
}

{
  const timers = createFakeTimers();
  let online = true;
  let connects = 0;
  const controller = createReconnectController({
    connect: () => { connects += 1; },
    isOnline: () => online,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  assert.equal(controller.schedule(), true);
  assert.equal(controller.schedule(), false, 'duplicate failure must not queue a second retry');
  assert.equal(timers.nextDelay(), 1000);
  assert.equal(timers.runNext(), 1000);
  assert.equal(connects, 1, 'first retry should reconnect once');

  assert.equal(controller.schedule(), true);
  assert.equal(timers.nextDelay(), 1800, 'second failure should use exponential backoff');
  online = false;
  assert.equal(timers.runNext(), 1800);
  assert.equal(connects, 1, 'offline retry callback must not reconnect');
  assert.equal(controller.schedule(), false, 'offline state must not queue retries');

  online = true;
  assert.equal(controller.reconnectNow(), true);
  assert.equal(connects, 2, 'network recovery should reconnect immediately');
  assert.equal(controller.getSnapshot().nextDelay, 1000, 'network recovery resets backoff');

  assert.equal(controller.schedule(), true);
  assert.equal(timers.nextDelay(), 1000, 'successful connection reset keeps the next retry fast');
  controller.reset();
  assert.equal(timers.size(), 0, 'successful connection must cancel stale retries');

  assert.equal(controller.schedule(), true);
  controller.stop();
  assert.equal(timers.size(), 0, 'unmount must cancel pending retries');
  assert.equal(controller.schedule(), false, 'stopped controller must not schedule again');
  assert.equal(controller.reconnectNow(), false, 'stopped controller must not reconnect');
}

{
  const timers = createFakeTimers();
  const controller = createReconnectController({
    connect() {},
    isOnline: () => true,
    initialDelay: 5000,
    maxDelay: 6000,
    multiplier: 2,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  controller.schedule();
  assert.equal(timers.runNext(), 5000);
  controller.schedule();
  assert.equal(timers.nextDelay(), 6000, 'backoff must respect the maximum delay');
}

assert.throws(() => createReconnectController(), /connect/);
assert.throws(() => createReconnectController({ connect() {}, isOnline: true }), /isOnline/);
assert.throws(() => createReconnectController({ connect() {}, isOnline() {}, initialDelay: 0 }), /initialDelay/);

console.log('reconnect-controller tests passed');
