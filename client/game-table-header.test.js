import assert from 'node:assert/strict';
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

console.log('game table header tests passed');
