import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./src/hooks/useWebSocket.js', import.meta.url), 'utf8');

assert.match(
  source,
  /socket\.onclose = \(\) => \{[\s\S]*joinRequestGuard\.current\.clear\(socket\);[\s\S]*if \(stopped \|\| ws\.current !== socket\) return;[\s\S]*setConnected\(false\);/,
  'a replaced socket must not mark the active connection as disconnected or schedule another reconnect',
);

assert.match(
  source,
  /socket\.onmessage = \(event\) => \{[\s\S]*if \(stopped \|\| ws\.current !== socket\) return;[\s\S]*onMsg\.current\(msg\);/,
  'messages from a replaced socket must be ignored before they reach application state',
);

assert.match(
  source,
  /socket\.onerror = \(\) => \{[\s\S]*if \(ws\.current === socket\) socket\.close\(\);[\s\S]*\};/,
  'an error from a replaced socket must not close the current socket',
);

const onCloseBody = source.match(/socket\.onclose = \(\) => \{([\s\S]*?)\n      \};/)?.[1] ?? '';
assert.ok(
  onCloseBody.indexOf('if (stopped || ws.current !== socket) return;') < onCloseBody.indexOf('clearConnectTimer();'),
  'stale close events must be rejected before touching the active connection timeout',
);

console.log('stale websocket event contract passed');
