import assert from 'node:assert/strict';
import { createWebSocketCoordinator } from './src/websocket-coordinator.js';

class FakeSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.bufferedAmount = 0;
    this.closeCount = 0;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
  }

  open() {
    this.readyState = 1;
    this.onopen?.({ type: 'open' });
  }

  close() {
    this.closeCount += 1;
    this.readyState = 3;
    this.onclose?.({ type: 'close' });
  }

  message(data) {
    this.onmessage?.({ data });
  }

  error() {
    this.onerror?.({ type: 'error' });
  }
}

function createFakeTimers() {
  let nextId = 1;
  const timers = new Map();
  return {
    setTimer(fn, delay) {
      const id = nextId++;
      timers.set(id, { fn, delay });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    runNext() {
      const entry = timers.entries().next().value;
      if (!entry) return null;
      const [id, timer] = entry;
      timers.delete(id);
      timer.fn();
      return timer.delay;
    },
    count: () => timers.size,
  };
}

{
  const sockets = [];
  const messages = [];
  const closes = [];
  const disposals = [];
  const timers = createFakeTimers();
  let online = true;

  const coordinator = createWebSocketCoordinator({
    url: 'wss://example.test',
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    isOnline: () => online,
    openState: 1,
    connectingState: 0,
    closedState: 3,
    timeoutMs: 12000,
    initialDelay: 1000,
    maxDelay: 15000,
    onMessage: (event, socket) => messages.push([event.data, socket]),
    onClose: (_, socket, state) => closes.push([socket, state.isCurrent, state.synthetic === true]),
    onDisposeSocket: (socket, reason) => disposals.push([socket, reason]),
    reconnectOptions: {
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    },
  });

  assert.equal(coordinator.connect(), true);
  assert.equal(sockets.length, 1);
  const first = sockets[0];
  assert.equal(coordinator.getCurrent(), first);
  assert.equal(coordinator.connect(), false, 'connecting socket must prevent a duplicate connection');

  first.open();
  first.message('first');
  assert.deepEqual(messages.map(([data]) => data), ['first']);

  first.close();
  assert.deepEqual(closes, [[first, true, false]]);
  assert.equal(timers.count(), 1, 'current connection close must schedule one retry');
  assert.equal(timers.runNext(), 1000);
  assert.equal(sockets.length, 2);

  const second = sockets[1];
  second.open();
  first.message('stale');
  first.error();
  assert.deepEqual(messages.map(([data]) => data), ['first'], 'stale socket events must be ignored');
  assert.equal(coordinator.getCurrent(), second);

  online = false;
  coordinator.goOffline();
  assert.equal(second.closeCount, 1);
  assert.equal(coordinator.getCurrent(), null);
  assert.equal(timers.count(), 0);

  online = true;
  assert.equal(coordinator.goOnline(), true);
  assert.equal(sockets.length, 3);
  const third = sockets[2];
  third.open();

  coordinator.stop();
  assert.equal(third.closeCount, 1);
  assert.equal(coordinator.getSnapshot().stopped, true);
  assert.equal(coordinator.connect(), false);
  assert.equal(coordinator.goOnline(), false);
  assert.ok(disposals.some(([socket, reason]) => socket === second && reason === 'offline'));
  assert.ok(disposals.some(([socket, reason]) => socket === third && reason === 'stop'));
}

{
  const sockets = [];
  const coordinator = createWebSocketCoordinator({
    url: 'wss://example.test',
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    isOnline: () => true,
    openState: 1,
    connectingState: 0,
    closedState: 3,
    timeoutMs: 12000,
  });

  coordinator.connect();
  const first = sockets[0];
  assert.equal(coordinator.reconnectNow(), true);
  assert.equal(first.closeCount, 1, 'manual reconnect must replace a stuck connecting socket');
  assert.equal(sockets.length, 2);
  assert.equal(coordinator.getCurrent(), sockets[1]);
  coordinator.stop();
}

{
  const sockets = [];
  const closes = [];
  const disposals = [];
  const timers = createFakeTimers();
  const coordinator = createWebSocketCoordinator({
    url: 'wss://example.test',
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    isOnline: () => true,
    openState: 1,
    connectingState: 0,
    closedState: 3,
    timeoutMs: 12000,
    onClose: (event, socket, state) => closes.push([event.reason, socket, state.synthetic, state.isCurrent]),
    onDisposeSocket: (socket, reason) => disposals.push([socket, reason]),
    reconnectOptions: {
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    },
  });

  coordinator.connect();
  const failed = sockets[0];
  failed.open();
  assert.equal(coordinator.failCurrent('send-failed'), true);
  assert.equal(failed.closeCount, 1, 'failed current socket must close immediately');
  assert.equal(sockets.length, 2, 'send failure must immediately create a replacement connection');
  assert.equal(coordinator.getCurrent(), sockets[1]);
  assert.deepEqual(closes, [['send-failed', failed, true, true]]);
  assert.ok(disposals.some(([socket, reason]) => socket === failed && reason === 'send-failed'));
  assert.equal(timers.count(), 0, 'immediate recovery must not leave a delayed retry');

  failed.message('stale-after-send-failure');
  failed.error();
  assert.equal(coordinator.getCurrent(), sockets[1], 'failed socket events must not replace the recovery socket');
  coordinator.stop();
}

{
  const sockets = [];
  const closes = [];
  const coordinator = createWebSocketCoordinator({
    url: 'wss://example.test',
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    isOnline: () => true,
    openState: 1,
    connectingState: 0,
    closedState: 3,
    timeoutMs: 12000,
    maxBufferedAmount: 1024,
    onClose: (event, socket, state) => closes.push([event.reason, socket, state.synthetic]),
  });

  coordinator.connect();
  const congested = sockets[0];
  congested.open();
  congested.bufferedAmount = 2048;

  assert.equal(coordinator.ensureCurrent('send'), false, 'backpressured socket must be rejected');
  assert.equal(congested.closeCount, 1, 'backpressured socket must close immediately');
  assert.equal(sockets.length, 2, 'backpressure must trigger an immediate replacement connection');
  assert.deepEqual(closes, [['send-backpressure', congested, true]]);
  assert.equal(coordinator.getCurrent(), sockets[1]);
  coordinator.stop();
}

{
  const sockets = [];
  const coordinator = createWebSocketCoordinator({
    url: 'wss://example.test',
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    isOnline: () => true,
    openState: 1,
    connectingState: 0,
    closedState: 3,
    timeoutMs: 12000,
  });

  coordinator.connect();
  const silentlyClosed = sockets[0];
  silentlyClosed.readyState = 3;
  assert.equal(coordinator.ensureCurrent('visibility'), false);
  assert.equal(sockets.length, 2, 'closed current socket must be replaced without waiting for close event');
  assert.equal(coordinator.getCurrent(), sockets[1]);
  coordinator.stop();
}

assert.throws(() => createWebSocketCoordinator(), /url is required/);
assert.throws(() => createWebSocketCoordinator({ url: 'x' }), /createSocket must be a function/);
assert.throws(() => createWebSocketCoordinator({
  url: 'x',
  createSocket: () => ({}),
  isOnline: () => true,
  timeoutMs: 1,
  maxBufferedAmount: -1,
}), /maxBufferedAmount must be non-negative/);

console.log('websocket coordinator tests passed');
