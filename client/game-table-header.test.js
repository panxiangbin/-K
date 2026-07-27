import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  extractTableRoomId,
  getTableRoomCopyState,
  copyTableRoomId,
} from './src/game-table-header.js';

assert.equal(extractTableRoomId('河南五十K · 房间ABC123'), 'ABC123');
assert.equal(extractTableRoomId('河南五十K · 4人单机'), '');
assert.equal(extractTableRoomId(''), '');

assert.deepEqual(
  getTableRoomCopyState({ roomId: 'ABC123' }),
  { visible: true, disabled: false, label: '复制', announcement: '复制房间号ABC123' },
);
assert.equal(getTableRoomCopyState({ roomId: 'ABC123', copying: true }).disabled, true);
assert.equal(getTableRoomCopyState({ roomId: 'ABC123', outcome: 'success' }).label, '已复制');
assert.equal(getTableRoomCopyState({ roomId: 'ABC123', outcome: 'error' }).label, '重试复制');
assert.equal(getTableRoomCopyState({ roomId: '', solo: false }).visible, false);
assert.equal(getTableRoomCopyState({ roomId: 'solo', solo: true }).visible, false);

let copied = '';
assert.equal(await copyTableRoomId('ABC123', { writeText: async text => { copied = text; } }), true);
assert.equal(copied, 'ABC123');
assert.equal(await copyTableRoomId('', { writeText: async () => {} }), false);
assert.equal(await copyTableRoomId('ABC123', { writeText: async () => { throw new Error('denied'); } }), false);

const css = readFileSync(new URL('./src/game-table-header.css', import.meta.url), 'utf8');
assert.match(css, /--table-header-control-size:\s*44px/);
assert.match(css, /\.game-table-room-copy\s*\{[\s\S]*?min-height:\s*44px/);
assert.match(css, /grid-template-areas:\s*\n\s*"actions room"\s*\n\s*"turn turn"/);
assert.match(css, /@media \(max-height: 430px\) and \(orientation: landscape\)/);
assert.match(css, /--table-header-control-size:\s*40px/);
assert.match(css, /font-size:\s*12px !important/);
assert.doesNotMatch(css, /font-size:\s*10px/);
assert.match(css, /env\(safe-area-inset-top\)/);
assert.match(css, /env\(safe-area-inset-left\)/);
assert.match(css, /env\(safe-area-inset-right\)/);
assert.match(css, /@media \(forced-colors: active\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.doesNotMatch(css, /backdrop-filter/);
assert.doesNotMatch(css, /#(?:6366f1|7c3aed|8b5cf6|06b6d4)/i);

console.log('game table header tests passed');