import assert from 'node:assert/strict';
import { formatPlayerName, getPresenceState, getRoomCopyState } from './src/waiting-room-display.js';

{
  const value = formatPlayerName('小潘', { isSelf: true });
  assert.equal(value.visible, '小潘（我）');
  assert.equal(value.full, '小潘（我）');
  assert.equal(value.truncated, false);
}

{
  const value = formatPlayerName('这是一个特别特别长的玩家昵称', { isSelf: false, limit: 8 });
  assert.equal(value.visible, '这是一个特别特…');
  assert.equal(value.full, '这是一个特别特别长的玩家昵称');
  assert.equal(value.truncated, true);
}

{
  const value = formatPlayerName('', { isSelf: false });
  assert.equal(value.visible, '未命名玩家');
}

assert.deepEqual(getPresenceState({ isBot: true, isOnline: false }), {
  label: '机器人', tone: 'bot', announced: '机器人玩家',
});
assert.deepEqual(getPresenceState({ isBot: false, isOnline: true }), {
  label: '在线', tone: 'online', announced: '在线',
});
assert.deepEqual(getPresenceState({ isBot: false, isOnline: false }), {
  label: '离线', tone: 'offline', announced: '离线，等待重连',
});

assert.deepEqual(getRoomCopyState({ mode: 'solo', roomId: '123456' }), {
  visible: false, disabled: true, label: '', status: '',
});
assert.equal(getRoomCopyState({ mode: 'online', roomId: '123456' }).label, '复制房间号');
assert.equal(getRoomCopyState({ mode: 'online', roomId: '123456', copyState: 'copying' }).disabled, true);
assert.equal(getRoomCopyState({ mode: 'online', roomId: '123456', copyState: 'success' }).status, '房间号已复制，可以发给亲友。');
assert.equal(getRoomCopyState({ mode: 'online', roomId: '123456', copyState: 'error' }).label, '重新复制');

console.log('waiting room display tests passed');
