import assert from 'node:assert/strict';
import { armConnectionTimeout } from './src/connection-timeout.js';

function createScheduler() {
  let nextId = 1;
  const callbacks = new Map();
  return {
    setTimer(callback) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    clearTimer(id) {
      callbacks.delete(id);
    },
    runAll() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const callback of pending) callback();
    },
    get size() {
      return callbacks.size;
    },
  };
}

function createSocket(readyState = 0) {
  return {
    readyState,
    closeCalls: 0,
    close() {
      this.closeCalls += 1;
    },
  };
}

{
  const scheduler = createScheduler();
  const socket = createSocket();
  armConnectionTimeout(socket, {
    isCurrent: (target) => target === socket,
    setTimer: scheduler.setTimer,
    clearTimer: scheduler.clearTimer,
  });
  scheduler.runAll();
  assert.equal(socket.closeCalls, 1, 'the active stalled connection should be closed');
}

{
  const scheduler = createScheduler();
  const staleSocket = createSocket();
  const activeSocket = createSocket();
  let currentSocket = staleSocket;
  armConnectionTimeout(staleSocket, {
    isCurrent: (target) => currentSocket === target,
    setTimer: scheduler.setTimer,
    clearTimer: scheduler.clearTimer,
  });
  currentSocket = activeSocket;
  scheduler.runAll();
  assert.equal(staleSocket.closeCalls, 0, 'a stale timeout must not close a replaced connection attempt');
  assert.equal(activeSocket.closeCalls, 0, 'a stale timeout must never touch the active socket');
}

{
  const scheduler = createScheduler();
  const socket = createSocket(1);
  armConnectionTimeout(socket, {
    isCurrent: () => true,
    setTimer: scheduler.setTimer,
    clearTimer: scheduler.clearTimer,
  });
  scheduler.runAll();
  assert.equal(socket.closeCalls, 0, 'an already-open connection must not be closed by its old timeout');
}

{
  const scheduler = createScheduler();
  const socket = createSocket();
  const cancel = armConnectionTimeout(socket, {
    isCurrent: () => true,
    setTimer: scheduler.setTimer,
    clearTimer: scheduler.clearTimer,
  });
  assert.equal(cancel(), true, 'the first cancellation should clear the timer');
  assert.equal(cancel(), false, 'cancelling twice should be harmless');
  assert.equal(scheduler.size, 0, 'a cancelled connection timeout must leave no pending timer');
  scheduler.runAll();
  assert.equal(socket.closeCalls, 0, 'a cancelled timeout must never close the socket');
}

assert.throws(
  () => armConnectionTimeout(null, { isCurrent: () => true }),
  /socket with close\(\) is required/,
);
assert.throws(
  () => armConnectionTimeout(createSocket(), {}),
  /isCurrent must be a function/,
);

console.log('websocket connection timeout tests passed');
