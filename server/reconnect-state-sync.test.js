const assert = require('assert');
const { syncReconnectingPlayer } = require('./reconnect-state-sync');

function makeFixture(status = 'playing') {
  const ws = { id: 'socket-2' };
  const reconnecting = {
    id: 'player-1',
    token: 'token-1',
    name: '测试玩家',
    isOnline: false,
  };
  const room = {
    id: '123456',
    status,
    currentPlayer: 1,
    players: [
      reconnecting,
      { id: 'bot-1', name: '小河' },
      { id: 'bot-2', name: '阿豫' },
    ],
    lastPlay: { type: 'pair', rank: '8' },
    lastPlayCards: [{ id: '8-a' }, { id: '8-b' }],
    lastPlayerId: 'bot-2',
    pile: [{ id: '5-a', rank: '5' }],
    roundScores: [],
  };
  const clients = new Map();
  const sent = [];
  const broadcasts = [];
  const hands = [];
  const state = {
    id: room.id,
    status: room.status,
    currentPlayer: room.currentPlayer,
    lastPlay: room.lastPlay,
    lastPlayCards: room.lastPlayCards,
    lastPlayerId: room.lastPlayerId,
    pile: room.pile,
  };

  const result = syncReconnectingPlayer({
    ws,
    room,
    roomId: room.id,
    reconnecting,
    clients,
    send: (target, message) => sent.push({ target, message }),
    sendHand: (targetRoom, playerId) => hands.push({ targetRoom, playerId }),
    broadcast: (targetRoom, message) => broadcasts.push({ targetRoom, message }),
    getRoomPublicState: targetRoom => {
      assert.strictEqual(targetRoom, room);
      return state;
    },
  });

  return { ws, room, reconnecting, clients, sent, broadcasts, hands, state, result };
}

{
  const fixture = makeFixture('playing');
  assert.strictEqual(fixture.reconnecting.isOnline, true, '重连玩家必须恢复在线状态');
  assert.deepStrictEqual(fixture.clients.get(fixture.ws), {
    playerId: 'player-1',
    roomId: '123456',
    playerName: '测试玩家',
  }, '重连连接必须恢复原身份');
  assert.strictEqual(fixture.hands.length, 1, '重连时必须恢复一次原手牌');
  assert.strictEqual(fixture.hands[0].playerId, 'player-1');
  assert.strictEqual(fixture.broadcasts.length, 1, '重连时必须广播一次完整房间状态');
  assert.strictEqual(fixture.broadcasts[0].message.type, 'room_update');
  assert.strictEqual(fixture.broadcasts[0].message.state, fixture.state);
  assert.strictEqual(fixture.result, fixture.state);

  const joined = fixture.sent.find(entry => entry.message.type === 'room_joined');
  const turn = fixture.sent.find(entry => entry.message.type === 'turn_change');
  assert.ok(joined, '重连时必须确认房间身份');
  assert.strictEqual(joined.message.reconnect, true);
  assert.ok(turn, '进行中的牌局必须恢复当前回合快照');
  assert.deepStrictEqual(turn.message, {
    type: 'turn_change',
    currentPlayer: 1,
    playerId: 'bot-1',
    reconnect: true,
  });
  assert.strictEqual(fixture.sent.filter(entry => entry.message.type === 'turn_change').length, 1, '重连只应发送一次回合快照');
}

{
  const fixture = makeFixture('settlement');
  assert.ok(fixture.sent.some(entry => entry.message.type === 'room_joined'));
  assert.ok(!fixture.sent.some(entry => entry.message.type === 'turn_change'), '结算状态不应伪造回合变化');
  assert.strictEqual(fixture.broadcasts[0].message.state.status, 'settlement');
}

assert.throws(
  () => syncReconnectingPlayer({}),
  /缺少必要参数/,
  '参数缺失时必须明确失败',
);

assert.throws(
  () => syncReconnectingPlayer({ ws: {}, room: {}, reconnecting: {}, clients: new Map() }),
  /回调无效/,
  '回调缺失时必须明确失败',
);

console.log('reconnect-state-sync tests passed');
