import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const hookSource = await readFile(new URL('./src/hooks/useWebSocket.js', import.meta.url), 'utf8');
const lifecycleSource = await readFile(new URL('./src/websocket-lifecycle.js', import.meta.url), 'utf8');
const coordinatorSource = await readFile(new URL('./src/websocket-coordinator.js', import.meta.url), 'utf8');

assert.match(
  lifecycleSource,
  /const active = \(\) => !detached && Boolean\(isCurrent\(socket\)\)/,
  'socket lifecycle must centralize the current-socket guard',
);
assert.match(
  lifecycleSource,
  /socket\.onmessage = \(event\) => \{[\s\S]*if \(active\(\)\) onMessage\(event, socket\)/,
  'messages from a replaced socket must be ignored before application state receives them',
);
assert.match(
  lifecycleSource,
  /socket\.onerror = \(event\) => \{[\s\S]*if \(active\(\)\) onError\(event, socket\)/,
  'errors from a replaced socket must not affect the active socket',
);
assert.match(
  lifecycleSource,
  /socket\.onclose = \(event\) => \{[\s\S]*onClose\(event, socket, \{ isCurrent: active\(\) \}\)/,
  'close events must report whether their socket is still current',
);
assert.match(
  coordinatorSource,
  /onClose: \(event, socket, state\) => \{[\s\S]*if \(state\.isCurrent\) current = null;[\s\S]*if \(state\.isCurrent\) reconnectController\.schedule\(\)/,
  'only the active socket may clear connection state and schedule a reconnect',
);
assert.match(
  coordinatorSource,
  /isCurrent: \(socket\) => !stopped && current === socket/,
  'coordinator attempts must identify the active socket by identity',
);
assert.match(
  hookSource,
  /onClose: \(_, __, state\) => \{[\s\S]*if \(!state\.isCurrent\) return;[\s\S]*setConnectionState\(false\)/,
  'the React hook must ignore stale close callbacks before updating connection UI',
);
assert.match(
  coordinatorSource,
  /disposeSocket\(socket, reason\)[\s\S]*attempt\.dispose\(\)[\s\S]*attempts\.delete\(socket\)/,
  'replaced socket listeners and timeouts must be detached before disposal',
);

console.log('stale websocket event contract passed');
