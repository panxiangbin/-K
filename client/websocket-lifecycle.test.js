import assert from 'node:assert/strict';
import { bindWebSocketLifecycle } from './src/websocket-lifecycle.js';

function createSocket(name) {
  return { name, onopen: null, onclose: null, onerror: null, onmessage: null };
}

{
  const first = createSocket('first');
  const second = createSocket('second');
  let current = first;
  const events = [];

  const detachFirst = bindWebSocketLifecycle(first, {
    isCurrent: (socket) => socket === current,
    onOpen: (_, socket) => events.push(`open:${socket.name}`),
    onClose: (_, socket, state) => events.push(`close:${socket.name}:${state.isCurrent}`),
    onError: (_, socket) => events.push(`error:${socket.name}`),
    onMessage: (event, socket) => events.push(`message:${socket.name}:${event.data}`),
  });

  first.onopen({});
  first.onmessage({ data: 'fresh' });
  assert.deepEqual(events, ['open:first', 'message:first:fresh']);

  current = second;
  first.onmessage({ data: 'stale' });
  first.onerror({});
  first.onclose({});
  assert.deepEqual(events, [
    'open:first',
    'message:first:fresh',
    'close:first:false',
  ], 'stale messages and errors must be ignored while close still reports cleanup state');

  bindWebSocketLifecycle(second, {
    isCurrent: (socket) => socket === current,
    onOpen: (_, socket) => events.push(`open:${socket.name}`),
    onClose: (_, socket, state) => events.push(`close:${socket.name}:${state.isCurrent}`),
    onError: (_, socket) => events.push(`error:${socket.name}`),
    onMessage: (event, socket) => events.push(`message:${socket.name}:${event.data}`),
  });

  second.onopen({});
  second.onmessage({ data: 'current' });
  second.onerror({});
  second.onclose({});
  assert.deepEqual(events.slice(-4), [
    'open:second',
    'message:second:current',
    'error:second',
    'close:second:true',
  ]);

  detachFirst();
  assert.equal(first.onopen, null);
  assert.equal(first.onclose, null);
  assert.equal(first.onerror, null);
  assert.equal(first.onmessage, null);
  detachFirst();
}

assert.throws(() => bindWebSocketLifecycle(), /socket/);
assert.throws(() => bindWebSocketLifecycle({}, {}), /isCurrent/);
assert.throws(() => bindWebSocketLifecycle({}, { isCurrent() {}, onOpen: true }), /onOpen/);

console.log('websocket-lifecycle tests passed');
