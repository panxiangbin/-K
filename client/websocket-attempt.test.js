import assert from 'node:assert/strict';
import { createWebSocketAttempt } from './src/websocket-attempt.js';

class FakeSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.closed = 0;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
  }

  close() {
    this.closed += 1;
    this.readyState = 3;
  }

  emit(name, payload = {}) {
    this[`on${name}`]?.(payload);
  }
}

const events = [];
let current = null;
let timeoutCallback = null;
let timeoutCancelled = 0;

const first = createWebSocketAttempt({
  url: 'wss://example.test/game',
  createSocket: (url) => new FakeSocket(url),
  setCurrent: (socket) => { current = socket; },
  isCurrent: (socket) => current === socket,
  timeoutMs: 12000,
  connectingState: 0,
  armTimeout: (socket, options) => {
    timeoutCallback = () => {
      if (options.isCurrent(socket) && socket.readyState === options.connectingState) socket.close();
    };
    return () => { timeoutCancelled += 1; };
  },
  onOpen: () => events.push('first-open'),
  onClose: (_event, _socket, state) => events.push(`first-close:${state.isCurrent}`),
  onError: () => events.push('first-error'),
  onMessage: (event) => events.push(`first-message:${event.data}`),
});

assert.equal(first.socket.url, 'wss://example.test/game');
assert.equal(current, first.socket, 'attempt should register its socket before lifecycle events');

first.socket.emit('message', { data: 'before-open' });
assert.deepEqual(events, ['first-message:before-open']);

first.socket.readyState = 1;
first.socket.emit('open');
assert.equal(timeoutCancelled, 1, 'opening should cancel the connection timeout');
assert.deepEqual(events, ['first-message:before-open', 'first-open']);

timeoutCallback();
assert.equal(first.socket.closed, 0, 'cancelled timeout must not close an opened socket');

const second = createWebSocketAttempt({
  url: 'wss://example.test/game',
  createSocket: (url) => new FakeSocket(url),
  setCurrent: (socket) => { current = socket; },
  isCurrent: (socket) => current === socket,
  timeoutMs: 12000,
  connectingState: 0,
  armTimeout: (socket, options) => {
    timeoutCallback = () => {
      if (options.isCurrent(socket) && socket.readyState === options.connectingState) socket.close();
    };
    return () => { timeoutCancelled += 1; };
  },
  onOpen: () => events.push('second-open'),
  onClose: (_event, _socket, state) => events.push(`second-close:${state.isCurrent}`),
  onError: () => events.push('second-error'),
  onMessage: (event) => events.push(`second-message:${event.data}`),
});

first.socket.emit('message', { data: 'late' });
first.socket.emit('error');
first.socket.emit('close');
assert.ok(!events.includes('first-message:late'), 'replaced socket messages must be ignored');
assert.ok(!events.includes('first-error'), 'replaced socket errors must be ignored');
assert.ok(events.includes('first-close:false'), 'replaced socket close should report stale state for cleanup');

second.socket.emit('message', { data: 'fresh' });
assert.ok(events.includes('second-message:fresh'));
timeoutCallback();
assert.equal(second.socket.closed, 1, 'current connecting socket should be closed by timeout');

second.dispose();
second.dispose();
assert.equal(second.socket.onopen, null);
assert.equal(second.socket.onclose, null);
assert.equal(second.socket.onerror, null);
assert.equal(second.socket.onmessage, null);

assert.throws(() => createWebSocketAttempt(), /url is required/);
assert.throws(() => createWebSocketAttempt({ url: 'x' }), /createSocket/);
assert.throws(() => createWebSocketAttempt({
  url: 'x', createSocket: () => null, setCurrent() {}, isCurrent() {}, timeoutMs: 1,
}), /return a socket/);

console.log('websocket attempt tests passed');
