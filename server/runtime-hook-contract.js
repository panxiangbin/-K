const replacements = [
  {
    name: '智能电脑出牌',
    oldCode: 'const move = chooseBotMove(player.hand, room.lastPlay);',
    newCode: `const botContext = require('./bot-context').getBotTurnContext(room, idx, player.id, calcPileScore);
    const move = require('./bot-ai-lead-resilience').chooseBotMove(player.hand, room.lastPlay, botContext);`,
  },
  {
    name: 'HTTP静态交付与健康检查',
    oldCode: `app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});`,
    newCode: `require('./http-delivery').configureHttpDelivery(app, express, path, __dirname);`,
  },
  {
    name: 'WebSocket心跳清理',
    oldCode: "wss.on('connection', (ws) => {",
    newCode: `require('./ws-heartbeat').startWebSocketHeartbeat(wss, WebSocket, {
  onSocketError(error, socket, phase) {
    console.warn('[ws-heartbeat]', phase, error && error.message ? error.message : error);
  },
});

wss.on('connection', (ws) => {`,
  },
  {
    name: '单机断线宽限期',
    oldCode: `  if (room.mode === 'solo') {
    rooms.delete(room.id);
    clients.set(ws, { playerId: null, roomId: null, playerName: null });
    return;
  }`,
    newCode: `  if (room.mode === 'solo') {
    const handledImmediately = require('./solo-room-reconnect').handleSoloDisconnect(room, rooms, manual);
    if (handledImmediately) {
      clients.set(ws, { playerId: null, roomId: null, playerName: null });
      return;
    }
  }`,
  },
  {
    name: '重连状态快照与回合去重',
    oldCode: `      if (reconnecting) {
        reconnecting.isOnline = true;
        clients.set(ws, { playerId: reconnecting.id, roomId, playerName: reconnecting.name });
        send(ws, { type: 'room_joined', playerId: reconnecting.id, playerToken: reconnecting.token, roomId, playerIndex: room.players.indexOf(reconnecting), reconnect: true });
        sendHand(room, reconnecting.id);
        broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });
        if (room.status === 'playing') setTurn(room, room.currentPlayer);
        return;
      }`,
    newCode: `      if (reconnecting) {
        require('./solo-room-reconnect').cancelSoloRoomCleanup(roomId);
        require('./reconnect-state-sync').syncReconnectingPlayer({
          ws,
          room,
          roomId,
          reconnecting,
          clients,
          send,
          sendHand,
          broadcast,
          getRoomPublicState,
        });
        return;
      }`,
  },
  {
    name: '公开已出牌记录初始化',
    oldCode: `        pile: [],
        passCount: 0,`,
    newCode: `        pile: [],
        playedCards: [],
        publicPlays: [],
        passCount: 0,`,
  },
  {
    name: '新局公开已出牌记录重置',
    oldCode: `  room.pile = [];
  room.passCount = 0;`,
    newCode: `  room.pile = [];
  room.playedCards = [];
  room.publicPlays = [];
  room.passCount = 0;`,
  },
  {
    name: '每次出牌写入公开记牌',
    oldCode: `  room.pile.push(...selectedCards);
  room.lastPlay = pattern;`,
    newCode: `  room.pile.push(...selectedCards);
  room.playedCards = room.playedCards || [];
  room.playedCards.push(...selectedCards);
  room.publicPlays = room.publicPlays || [];
  room.publicPlays.push({
    playerId: player.id,
    type: pattern.type,
    bombType: pattern.bombType || null,
    rank: pattern.rank || (selectedCards[0] && selectedCards[0].rank) || null,
    count: selectedCards.length,
  });
  if (room.publicPlays.length > 12) room.publicPlays.splice(0, room.publicPlays.length - 12);
  room.lastPlay = pattern;`,
  },
  {
    name: '统一玩家错误文案',
    oldCode: `function sendError(ws, msg) { send(ws, { type: 'error', msg }); }`,
    newCode: `function sendError(ws, codeOrMessage) {
  const { getErrorMessage, isKnownErrorCode } = require('./error-messages');
  const msg = isKnownErrorCode(codeOrMessage) ? getErrorMessage(codeOrMessage) : codeOrMessage;
  send(ws, { type: 'error', msg });
}`,
  },
  {
    name: '加入房间错误反馈',
    oldCode: `      if (!room) { sendError(ws, '房间不存在'); return; }
      const token = msg.playerToken || msg.token;`,
    newCode: `      if (!room) { sendError(ws, 'ROOM_NOT_FOUND'); return; }
      const token = msg.playerToken || msg.token;`,
  },
  {
    name: '加入房间校验反馈',
    oldCode: `      if (room.status !== 'waiting') { sendError(ws, '游戏已开始，无法加入；断线重连请用原设备进入'); return; }
      if (!cleanName) { sendError(ws, '请输入昵称'); return; }
      if (room.players.some(p => !p.left && p.name === cleanName)) { sendError(ws, '昵称已被使用，请换一个'); return; }
      if (room.players.filter(p => !p.left).length >= room.maxPlayers) { sendError(ws, '房间已满'); return; }`,
    newCode: `      if (room.status !== 'waiting') { sendError(ws, 'ROOM_ALREADY_STARTED'); return; }
      if (!cleanName) { sendError(ws, 'NICKNAME_REQUIRED'); return; }
      if (room.players.some(p => !p.left && p.name === cleanName)) { sendError(ws, 'NICKNAME_IN_USE'); return; }
      if (room.players.filter(p => !p.left).length >= room.maxPlayers) { sendError(ws, 'ROOM_FULL'); return; }`,
  },
  {
    name: '开始游戏错误反馈',
    oldCode: `      const room = rooms.get(clientInfo.roomId);
      if (!room) return;
      if (room.players[0].id !== clientInfo.playerId) { sendError(ws, '只有房主可以开始'); return; }
      if (room.status !== 'waiting') { sendError(ws, '当前状态不能开始游戏'); return; }
      if (room.players.filter(p => !p.left).length < 3) { sendError(ws, '至少需要3名玩家'); return; }`,
    newCode: `      const room = rooms.get(clientInfo.roomId);
      if (!room) { sendError(ws, 'ROOM_NOT_FOUND'); return; }
      if (room.players[0].id !== clientInfo.playerId) { sendError(ws, 'HOST_ONLY_START'); return; }
      if (room.status !== 'waiting') { sendError(ws, 'CANNOT_START_NOW'); return; }
      if (room.players.filter(p => !p.left).length < 3) { sendError(ws, 'NEED_MORE_PLAYERS'); return; }`,
  },
  {
    name: '出牌错误反馈',
    oldCode: `      const room = rooms.get(clientInfo.roomId);
      if (!room || room.status !== 'playing') return;
      const playerIdx = room.players.findIndex(p => p.id === clientInfo.playerId);
      if (playerIdx !== room.currentPlayer) { sendError(ws, '还没轮到你'); return; }

      const player = room.players[playerIdx];
      const cardIds = Array.isArray(msg.cardIds) ? msg.cardIds : [];
      const selectedCards = cardIds.map(id => player.hand.find(c => c.id === id)).filter(Boolean);
      if (selectedCards.length !== cardIds.length) { sendError(ws, '牌不在手中'); sendHand(room, player.id); return; }
      const pattern = detectPattern(selectedCards);
      if (!pattern) { sendError(ws, '非法牌型'); sendHand(room, player.id); return; }
      if (!comparePatterns(pattern, room.lastPlay)) { sendError(ws, '不够大'); sendHand(room, player.id); return; }`,
    newCode: `      const room = rooms.get(clientInfo.roomId);
      if (!room || room.status !== 'playing') { sendError(ws, 'GAME_NOT_ACTIVE'); return; }
      const playerIdx = room.players.findIndex(p => p.id === clientInfo.playerId);
      if (playerIdx !== room.currentPlayer) { sendError(ws, 'NOT_YOUR_TURN'); return; }

      const player = room.players[playerIdx];
      const cardIds = Array.isArray(msg.cardIds) ? msg.cardIds : [];
      const selectedCards = cardIds.map(id => player.hand.find(c => c.id === id)).filter(Boolean);
      if (selectedCards.length !== cardIds.length) { sendError(ws, 'CARD_STATE_CHANGED'); sendHand(room, player.id); return; }
      const pattern = detectPattern(selectedCards);
      if (!pattern) { sendError(ws, 'INVALID_PATTERN'); sendHand(room, player.id); return; }
      if (!comparePatterns(pattern, room.lastPlay)) { sendError(ws, 'CANNOT_BEAT'); sendHand(room, player.id); return; }`,
  },
  {
    name: '过牌错误反馈',
    oldCode: `      const room = rooms.get(clientInfo.roomId);
      if (!room || room.status !== 'playing') return;
      const playerIdx = room.players.findIndex(p => p.id === clientInfo.playerId);
      if (playerIdx !== room.currentPlayer) return;
      if (!room.lastPlay) { sendError(ws, '先手不能过牌'); return; }
      const player = room.players[playerIdx];
      if (canBeat(player.hand, room.lastPlay)) { sendError(ws, '你有能压的牌，必须出！'); return; }`,
    newCode: `      const room = rooms.get(clientInfo.roomId);
      if (!room || room.status !== 'playing') { sendError(ws, 'GAME_NOT_ACTIVE'); return; }
      const playerIdx = room.players.findIndex(p => p.id === clientInfo.playerId);
      if (playerIdx !== room.currentPlayer) { sendError(ws, 'NOT_YOUR_TURN'); return; }
      if (!room.lastPlay) { sendError(ws, 'LEAD_CANNOT_PASS'); return; }
      const player = room.players[playerIdx];
      if (canBeat(player.hand, room.lastPlay)) { sendError(ws, 'MUST_BEAT'); return; }`,
  },
  {
    name: '下一局错误反馈',
    oldCode: `      const room = rooms.get(clientInfo.roomId);
      if (!room || room.status !== 'settlement') return;
      if (room.players[0].id !== clientInfo.playerId) return;`,
    newCode: `      const room = rooms.get(clientInfo.roomId);
      if (!room) { sendError(ws, 'ROOM_NOT_FOUND'); return; }
      if (room.status !== 'settlement') { sendError(ws, 'SETTLEMENT_NOT_READY'); return; }
      if (room.players[0].id !== clientInfo.playerId) { sendError(ws, 'HOST_ONLY_NEXT_ROUND'); return; }`,
  },
];

function transformServerSource(source) {
  if (typeof source !== 'string') throw new TypeError('服务器源码必须是字符串');

  let transformed = source;
  const missing = [];

  for (const replacement of replacements) {
    const occurrences = transformed.split(replacement.oldCode).length - 1;
    if (occurrences !== 1) {
      missing.push(`${replacement.name}（匹配${occurrences}处）`);
      continue;
    }
    transformed = transformed.replace(replacement.oldCode, replacement.newCode);
  }

  if (missing.length) {
    throw new Error(`服务器运行时接入点失效：${missing.join('、')}`);
  }

  return transformed;
}

module.exports = { replacements, transformServerSource };
