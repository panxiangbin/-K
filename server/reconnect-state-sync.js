function syncReconnectingPlayer({
  ws,
  room,
  roomId,
  reconnecting,
  clients,
  send,
  sendHand,
  broadcast,
  getRoomPublicState,
}) {
  if (!ws || !room || !reconnecting || !clients) {
    throw new TypeError('重连状态同步缺少必要参数');
  }
  if (typeof send !== 'function' || typeof sendHand !== 'function' || typeof broadcast !== 'function' || typeof getRoomPublicState !== 'function') {
    throw new TypeError('重连状态同步回调无效');
  }

  reconnecting.isOnline = true;
  clients.set(ws, {
    playerId: reconnecting.id,
    roomId,
    playerName: reconnecting.name,
  });

  send(ws, {
    type: 'room_joined',
    playerId: reconnecting.id,
    playerToken: reconnecting.token,
    roomId,
    playerIndex: room.players.indexOf(reconnecting),
    reconnect: true,
  });
  sendHand(room, reconnecting.id);

  const state = getRoomPublicState(room);
  broadcast(room, { type: 'room_update', state });

  // 重连只恢复当前回合快照，不能再次调用 setTurn/scheduleBotTurn，
  // 否则在电脑行动等待期间重连可能安排第二次机器人出牌。
  if (room.status === 'playing') {
    send(ws, {
      type: 'turn_change',
      currentPlayer: room.currentPlayer,
      playerId: room.players[room.currentPlayer]?.id,
      reconnect: true,
    });
  }

  return state;
}

module.exports = { syncReconnectingPlayer };
