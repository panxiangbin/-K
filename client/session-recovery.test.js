import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createRecoveryRequestTracker,
  getRecoveryAttempt,
  installManualRecoverySourceMarker,
  invalidateSavedSession,
  isMissingRoomError,
  stripRecoveryMetadata,
} from './src/session-recovery.js';

function createStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    removeItem: (key) => values.delete(key),
    snapshot: () => Object.fromEntries(values),
  };
}

{
  const target = {};
  const attempt = getRecoveryAttempt({
    type:'join_room', roomId:'123456', playerId:'p1', playerToken:'token', playerName:'',
  }, target);
  assert.deepEqual(attempt, { source:'auto', roomId:'123456' });
}

{
  let clickHandler;
  const target = {
    document: {
      addEventListener: (name, handler) => { if (name === 'click') clickHandler = handler; },
      removeEventListener: () => {},
    },
  };
  const cleanup = installManualRecoverySourceMarker(target);
  clickHandler({ target:{ closest:() => ({ textContent:'继续上次房间' }) } });
  const attempt = getRecoveryAttempt({
    type:'join_room', roomId:'654321', playerId:'p2', playerToken:'token2', playerName:'',
  }, target);
  assert.equal(attempt.source, 'manual');
  assert.equal(target.__henan50kManualRecoveryPending, false);
  cleanup();
}

assert.equal(getRecoveryAttempt({ type:'join_room', roomId:'123456', playerName:'小潘' }, {}), null);
assert.deepEqual(
  stripRecoveryMetadata({ type:'join_room', roomId:'1', __recoverySource:'manual' }),
  { type:'join_room', roomId:'1' },
);
assert.equal(isMissingRoomError('房间不存在或已经关闭，请检查房间号后重新加入。'), true);
assert.equal(isMissingRoomError('房间人数已满，请加入其他房间。'), false);

{
  const tracker = createRecoveryRequestTracker();
  const socket = {};
  tracker.start(socket, { source:'manual', roomId:'111111' });
  assert.deepEqual(tracker.reject(socket, '房间不存在'), {
    matched:true, shouldClear:true, source:'manual', roomId:'111111',
  });
  assert.deepEqual(tracker.reject(socket, '房间不存在'), { matched:false, shouldClear:false });
}

{
  const tracker = createRecoveryRequestTracker();
  const socket = {};
  tracker.start(socket, { source:'auto', roomId:'222222' });
  assert.deepEqual(tracker.reject(socket, '这个昵称已经有人使用'), {
    matched:true, shouldClear:false, source:'auto', roomId:'222222',
  });
}

{
  const removedButtons = [];
  let observerCallback;
  let observed = false;
  let disconnected = false;
  let stopDelay = 0;
  const buttons = [
    { textContent:'继续上次房间', remove:() => removedButtons.push('continue') },
    { textContent:'创建房间', remove:() => removedButtons.push('create') },
  ];
  const storage = createStorage({
    'henan50k:lastRoomId':'333333',
    'henan50k:333333:playerId':'p3',
    'henan50k:333333:playerToken':'t3',
    'henan50k:444444:playerId':'keep',
  });
  const target = {
    document: {
      body:{},
      querySelectorAll: () => buttons,
    },
    MutationObserver: class {
      constructor(callback) { observerCallback = callback; }
      observe() { observed = true; }
      disconnect() { disconnected = true; }
    },
    setTimeout: (callback, delay) => { stopDelay = delay; callback(); },
    dispatchEvent: () => {},
  };
  assert.equal(invalidateSavedSession({ storage, roomId:'333333', target, source:'auto' }), true);
  assert.deepEqual(storage.snapshot(), { 'henan50k:444444:playerId':'keep' });
  assert.deepEqual(removedButtons, ['continue']);
  assert.equal(observed, true);
  observerCallback();
  assert.deepEqual(removedButtons, ['continue', 'continue']);
  assert.equal(stopDelay, 5000);
  assert.equal(disconnected, true);
}

{
  const storage = createStorage({
    'henan50k:lastRoomId':'555555',
    'henan50k:555555:playerId':'p5',
    'henan50k:555555:playerToken':'t5',
  });
  assert.equal(invalidateSavedSession({ storage, roomId:'999999', target:{}, source:'manual' }), false);
  assert.equal(storage.getItem('henan50k:lastRoomId'), '555555');
}

const wsSource = fs.readFileSync(new URL('./src/hooks/useWebSocket.js', import.meta.url), 'utf8');
assert.match(wsSource, /getRecoveryAttempt\(msg, window\)/);
assert.match(wsSource, /stripRecoveryMetadata\(msg\)/);
assert.match(wsSource, /invalidateSavedSession\(/);
assert.match(wsSource, /recoveryTracker\.current\.reject/);
assert.match(wsSource, /recoveryTracker\.current\.complete/);

console.log('session recovery tests passed');
