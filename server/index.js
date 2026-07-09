const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { dealCards, sortCards, detectPattern, comparePatterns, canBeat, calcPileScore, getTargetScores } = require('./game-logic');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// rooms: Map<roomId, RoomState>
const rooms = new Map();
// clients: Map<ws, { playerId, roomId, playerName }>
const clients = new Map();

function genRoomId() {
  let id;
  do { id = String(Math.floor(100000 + Math.random() * 900000)); } while (rooms.has(id));
  return id;
}

function genPlayerId() {
  return Math.random().toString(36).slice(2, 10);
}

function genPlayerToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function broadcast(room, msg) {
  for (const [ws, info] of clients.entries()) {
    if (info.roomId === room.id && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}

function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function sendError(ws, msg) {
  send(ws, { type: 'error', msg });
}

function hasOpenConnection(roomId, playerId, exceptWs = null) {
  for (const [ws, info] of clients.entries()) {
    if (ws !== exceptWs && info.roomId === roomId && info.playerId === playerId && ws.readyState === WebSocket.OPEN) {
      return true;
    }
  }
  return false;
}

function sendHand(room, playerId) {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;
  for (const [ws, info] of clients.entries()) {
    if (info.roomId === room.id && info.playerId === playerId) {
      send(ws, { type: 'your_hand', hand: player.hand || [] });
    }
  }
}

function getRoomPublicState(room) {
  return {
    id: room.id,
    maxPlayers: room.maxPlayers,
    status: room.status,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand ? p.hand.length : 0,
      score: p.score,
      totalScore: p.totalScore,
      isOnline: p.isOnline,
    })),
    currentPlayer: room.currentPlayer,
    lastPlay: room.lastPlay,
    lastPlayCards: room.lastPlayCards || [],
    lastPlayerId: room.lastPlayerId,
    pile: room.pile,
    roundScores: room.roundScores,
    flipCard: room.flipCard,
    roundNum: room.roundNum,
  };
}

function canAct(player) {
  return Boolean(player && player.isOnline && player.hand && player.hand.length > 0);
}

function setTurn(room, idx) {
  room.currentPlayer = idx;
  broadcast(room, {
    type: 'turn_change',
    currentPlayer: idx,
    playerId: room.players[idx]?.id,
  });
}

function awardPile(room) {
  const winner = room.players.find(p => p.id === room.lastPlayerId);
  if (!winner) return -1;

  const pileScore = calcPileScore(room.pile);
  winner.score += pileScore;
  const pileCards = [...room.pile];
  room.pile = [];
  room.lastPlay = null;
  room.lastPlayCards = [];
  room.lastPlayerId = null;
  room.passCount = 0;

  broadcast(room, {
    type: 'pile_won',
    winnerId: winner.id,
    winnerName: winner.name,
    score: pileScore,
    cards: pileCards,
    state: getRoomPublicState(room),
  });

  return room.players.indexOf(winner);
}

function advanceTurn(room, startIdx) {
  if (!room || room.status !== 'playing' || room.players.length === 0) return;

  const len = room.players.length;
  let idx = ((startIdx % len) + len) % len;
  let safety = 0;

  while (safety < len * 2) {
    if (room.lastPlay && room.passCount >= len - 1) {
      const winnerIdx = awardPile(room);
      idx = winnerIdx >= 0 ? winnerIdx : idx;
      safety = 0;
      continue;
    }

    const player = room.players[idx];
    if (canAct(player)) {
      setTurn(room, idx);
      return;
    }

    // 离线玩家不会卡住整局：有上家牌时自动过牌；先手时直接跳到下一位在线玩家。
    if (room.lastPlay && player && player.id !== room.lastPlayerId && player.hand?.length > 0) {
      room.passCount++;
      broadcast(room, {
        type: 'player_passed',
        playerId: player.id,
        playerName: player.name + '（离线自动）',
        auto: true,
      });
    }

    idx = (idx + 1) % len;
    safety++;
  }
}

function startGame(room) {
  const pc = room.players.length;
  const { hands, flipCard } = dealCards(pc);

  room.players.forEach((p, i) => {
    p.hand = sortCards(hands[i]);
    p.score = 0;
  });

  // 翻明牌：找持有该牌的玩家，他先出
  let firstPlayer = 0;
  for (let i = 0; i < room.players.length; i++) {
    if (room.players[i].hand.some(c => c.id === flipCard.id)) {
      firstPlayer = i;
      break;
    }
  }

  room.flipCard = flipCard;
  room.currentPlayer = firstPlayer;
  room.lastPlay = null;
  room.lastPlayCards = [];
  room.lastPlayerId = null;
  room.pile = [];
  room.passCount = 0;
  room.status = 'playing';
  room.roundNum = (room.roundNum || 0) + 1;

  broadcast(room, { type: 'game_start', state: getRoomPublicState(room), flipCard });

  // 各自发手牌
  for (const p of room.players) sendHand(room, p.id);

  setTurn(room, firstPlayer);
}

function endRound(room) {
  // 计算排名
  const ranked = [...room.players].sort((a, b) => b.score - a.score);
  const targets = getTargetScores(room.players.length);
  ranked.forEach((p) => { p.totalScore = (p.totalScore || 0) + p.score; });

  const result = ranked.map((p, i) => ({
    id: p.id, name: p.name, score: p.score, rank: i + 1,
    target: targets[i], totalScore: p.totalScore,
  }));

  room.status = 'settlement';
  broadcast(room, { type: 'round_end', result, state: getRoomPublicState(room) });
}

wss.on('connection', (ws) => {
  clients.set(ws, { playerId: null, roomId: null, playerName: null });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const clientInfo = clients.get(ws);

    if (msg.type === 'create_room') {
      const { playerName, maxPlayers } = msg;
      const cleanName = String(playerName || '').trim() || '玩家1';
      const playerId = genPlayerId();
      const playerToken = genPlayerToken();
      const roomId = genRoomId();
      const room = {
        id: roomId, maxPlayers: maxPlayers || 4, status: 'waiting',
        players: [{ id: playerId, token: playerToken, name: cleanName, hand: [], score: 0, totalScore: 0, isOnline: true }],
        currentPlayer: 0, lastPlay: null, lastPlayCards: [], lastPlayerId: null,
        pile: [], passCount: 0, extra: [], roundNum: 0, roundScores: [],
      };
      rooms.set(roomId, room);
      clients.set(ws, { playerId, roomId, playerName: cleanName });
      send(ws, { type: 'room_joined', playerId, playerToken, roomId, playerIndex: 0 });
      broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });
    }

    else if (msg.type === 'join_room') {
      const roomId = String(msg.roomId || '').trim();
      const cleanName = String(msg.playerName || '').trim();
      const room = rooms.get(roomId);
      if (!room) { sendError(ws, '房间不存在'); return; }

      const token = msg.playerToken || msg.token;
      const requestedPlayerId = msg.playerId;
      const reconnecting = token
        ? room.players.find(p => p.token === token && (!requestedPlayerId || p.id === requestedPlayerId))
        : null;

      if (reconnecting) {
        reconnecting.isOnline = true;
        clients.set(ws, { playerId: reconnecting.id, roomId, playerName: reconnecting.name });
        send(ws, {
          type: 'room_joined',
          playerId: reconnecting.id,
          playerToken: reconnecting.token,
          roomId,
          playerIndex: room.players.indexOf(reconnecting),
          reconnect: true,
        });
        sendHand(room, reconnecting.id);
        broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });
        if (room.status === 'playing') {
          setTurn(room, room.currentPlayer);
        }
        return;
      }

      if (room.status !== 'waiting') {
        sendError(ws, '游戏已开始，无法加入；断线重连请用原设备进入');
        return;
      }
      if (!cleanName) { sendError(ws, '请输入昵称'); return; }
      if (room.players.some(p => p.name === cleanName)) { sendError(ws, '昵称已被使用，请换一个'); return; }
      if (room.players.length >= room.maxPlayers) { sendError(ws, '房间已满'); return; }

      const playerId = genPlayerId();
      const playerToken = genPlayerToken();
      const player = { id: playerId, token: playerToken, name: cleanName || `玩家${room.players.length + 1}`, hand: [], score: 0, totalScore: 0, isOnline: true };
      room.players.push(player);
      clients.set(ws, { playerId, roomId, playerName: player.name });
      send(ws, { type: 'room_joined', playerId, playerToken, roomId, playerIndex: room.players.length - 1 });
      broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });
    }

    else if (msg.type === 'start_game') {
      const room = rooms.get(clientInfo.roomId);
      if (!room) return;
      if (room.players[0].id !== clientInfo.playerId) { sendError(ws, '只有房主可以开始'); return; }
      if (room.status !== 'waiting') { sendError(ws, '当前状态不能开始游戏'); return; }
      if (room.players.length < 3) { sendError(ws, '至少需要3名玩家'); return; }
      startGame(room);
    }

    else if (msg.type === 'play_cards') {
      const room = rooms.get(clientInfo.roomId);
      if (!room || room.status !== 'playing') return;
      const playerIdx = room.players.findIndex(p => p.id === clientInfo.playerId);
      if (playerIdx !== room.currentPlayer) { sendError(ws, '还没轮到你'); return; }

      const player = room.players[playerIdx];
      const cardIds = Array.isArray(msg.cardIds) ? msg.cardIds : [];
      const selectedCards = cardIds.map(id => player.hand.find(c => c.id === id)).filter(Boolean);
      if (selectedCards.length !== cardIds.length) { sendError(ws, '牌不在手中'); sendHand(room, player.id); return; }

      const pattern = detectPattern(selectedCards);
      if (!pattern) { sendError(ws, '非法牌型'); sendHand(room, player.id); return; }
      if (!comparePatterns(pattern, room.lastPlay)) { sendError(ws, '不够大'); sendHand(room, player.id); return; }

      // 移除手牌
      player.hand = player.hand.filter(c => !cardIds.includes(c.id));
      player.hand = sortCards(player.hand);
      room.pile.push(...selectedCards);
      room.lastPlay = pattern;
      room.lastPlayCards = selectedCards;
      room.lastPlayerId = clientInfo.playerId;
      room.passCount = 0;

      // 服务器确认成功后再同步手牌，避免前端非法出牌时丢牌
      sendHand(room, player.id);

      broadcast(room, {
        type: 'cards_played',
        playerId: clientInfo.playerId,
        playerName: player.name,
        cards: selectedCards,
        pattern,
        state: getRoomPublicState(room),
      });

      // 出完牌了？
      if (player.hand.length === 0) {
        // 该玩家赢得最后一墩
        awardPile(room);
        endRound(room);
        return;
      }

      advanceTurn(room, playerIdx + 1);
    }

    else if (msg.type === 'pass') {
      const room = rooms.get(clientInfo.roomId);
      if (!room || room.status !== 'playing') return;
      const playerIdx = room.players.findIndex(p => p.id === clientInfo.playerId);
      if (playerIdx !== room.currentPlayer) return;
      if (!room.lastPlay) { sendError(ws, '先手不能过牌'); return; }
      // 必须压：有能压的牌不允许过
      const player = room.players[playerIdx];
      if (canBeat(player.hand, room.lastPlay)) {
        sendError(ws, '你有能压的牌，必须出！'); return;
      }

      room.passCount++;
      broadcast(room, { type: 'player_passed', playerId: clientInfo.playerId, playerName: room.players[playerIdx].name });
      advanceTurn(room, playerIdx + 1);
    }

    else if (msg.type === 'next_round') {
      const room = rooms.get(clientInfo.roomId);
      if (!room || room.status !== 'settlement') return;
      if (room.players[0].id !== clientInfo.playerId) return;
      room.status = 'waiting';
      room.lastPlay = null;
      room.lastPlayCards = [];
      room.lastPlayerId = null;
      room.pile = [];
      room.passCount = 0;
      broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });
    }
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    if (info && info.roomId) {
      const room = rooms.get(info.roomId);
      if (room) {
        const playerIdx = room.players.findIndex(p => p.id === info.playerId);
        const player = room.players[playerIdx];
        if (player && !hasOpenConnection(info.roomId, info.playerId, ws)) {
          player.isOnline = false;
          broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });

          // 如果正好轮到离线玩家，立即跳过，避免整局卡死。
          if (room.status === 'playing' && room.currentPlayer === playerIdx) {
            advanceTurn(room, playerIdx + 1);
          }
        }
      }
    }
    clients.delete(ws);
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => console.log(`河南五十K 服务器运行在端口 ${PORT}`));
