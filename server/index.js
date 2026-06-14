const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { dealCards, sortCards, detectPattern, comparePatterns, calcPileScore, getTargetScores } = require('./game-logic');

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
    extra: room.extra,
    roundNum: room.roundNum,
  };
}

function startGame(room) {
  const pc = room.players.length;
  const { hands, extra } = dealCards(pc);
  room.extra = extra;
  room.players.forEach((p, i) => {
    p.hand = sortCards(hands[i]);
    p.score = 0;
  });
  // 第一个玩家拿明牌
  room.players[0].hand = sortCards([...room.players[0].hand, ...extra]);
  room.currentPlayer = 0;
  room.lastPlay = null;
  room.lastPlayerId = null;
  room.pile = [];
  room.passCount = 0;
  room.status = 'playing';
  room.roundNum = (room.roundNum || 0) + 1;

  broadcast(room, { type: 'game_start', state: getRoomPublicState(room), extra });

  // 各自发手牌
  for (const [ws, info] of clients.entries()) {
    const player = room.players.find(p => p.id === info.playerId);
    if (player && info.roomId === room.id) {
      send(ws, { type: 'your_hand', hand: player.hand });
    }
  }

  broadcast(room, { type: 'turn_change', currentPlayer: 0, playerId: room.players[0].id });
}

function endRound(room) {
  // 计算排名
  const ranked = [...room.players].sort((a, b) => b.score - a.score);
  const targets = getTargetScores(room.players.length);
  ranked.forEach((p, i) => { p.totalScore = (p.totalScore || 0) + p.score; });

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
      const playerId = genPlayerId();
      const roomId = genRoomId();
      const room = {
        id: roomId, maxPlayers: maxPlayers || 4, status: 'waiting',
        players: [{ id: playerId, name: playerName || '玩家1', hand: [], score: 0, totalScore: 0, isOnline: true }],
        currentPlayer: 0, lastPlay: null, lastPlayerId: null,
        pile: [], passCount: 0, extra: [], roundNum: 0, roundScores: [],
      };
      rooms.set(roomId, room);
      clients.set(ws, { playerId, roomId, playerName });
      send(ws, { type: 'room_joined', playerId, roomId, playerIndex: 0 });
      broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });
    }

    else if (msg.type === 'join_room') {
      const { roomId, playerName } = msg;
      const room = rooms.get(roomId);
      if (!room) { send(ws, { type: 'error', msg: '房间不存在' }); return; }
      if (room.status !== 'waiting') {
        // 断线重连
        const existing = room.players.find(p => p.name === playerName);
        if (existing) {
          existing.isOnline = true;
          clients.set(ws, { playerId: existing.id, roomId, playerName });
          send(ws, { type: 'room_joined', playerId: existing.id, roomId, playerIndex: room.players.indexOf(existing), reconnect: true });
          send(ws, { type: 'your_hand', hand: existing.hand });
          broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });
          if (room.status === 'playing') {
            send(ws, { type: 'turn_change', currentPlayer: room.currentPlayer, playerId: room.players[room.currentPlayer].id });
          }
          return;
        }
        send(ws, { type: 'error', msg: '游戏已开始' }); return;
      }
      if (room.players.length >= room.maxPlayers) { send(ws, { type: 'error', msg: '房间已满' }); return; }
      const playerId = genPlayerId();
      const player = { id: playerId, name: playerName || `玩家${room.players.length + 1}`, hand: [], score: 0, totalScore: 0, isOnline: true };
      room.players.push(player);
      clients.set(ws, { playerId, roomId, playerName });
      send(ws, { type: 'room_joined', playerId, roomId, playerIndex: room.players.length - 1 });
      broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });
    }

    else if (msg.type === 'start_game') {
      const room = rooms.get(clientInfo.roomId);
      if (!room) return;
      if (room.players[0].id !== clientInfo.playerId) { send(ws, { type: 'error', msg: '只有房主可以开始' }); return; }
      if (room.players.length < 3) { send(ws, { type: 'error', msg: '至少需要3名玩家' }); return; }
      startGame(room);
    }

    else if (msg.type === 'play_cards') {
      const room = rooms.get(clientInfo.roomId);
      if (!room || room.status !== 'playing') return;
      const playerIdx = room.players.findIndex(p => p.id === clientInfo.playerId);
      if (playerIdx !== room.currentPlayer) { send(ws, { type: 'error', msg: '还没轮到你' }); return; }

      const player = room.players[playerIdx];
      const { cardIds } = msg;
      const selectedCards = cardIds.map(id => player.hand.find(c => c.id === id)).filter(Boolean);
      if (selectedCards.length !== cardIds.length) { send(ws, { type: 'error', msg: '牌不在手中' }); return; }

      const pattern = detectPattern(selectedCards);
      if (!pattern) { send(ws, { type: 'error', msg: '非法牌型' }); return; }
      if (!comparePatterns(pattern, room.lastPlay)) { send(ws, { type: 'error', msg: '不够大' }); return; }

      // 移除手牌
      player.hand = player.hand.filter(c => !cardIds.includes(c.id));
      room.pile.push(...selectedCards);
      room.lastPlay = pattern;
      room.lastPlayCards = selectedCards;
      room.lastPlayerId = clientInfo.playerId;
      room.passCount = 0;

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
        const pileScore = calcPileScore(room.pile);
        player.score += pileScore;
        const pileCards = [...room.pile];
        room.pile = [];
        broadcast(room, { type: 'pile_won', winnerId: clientInfo.playerId, winnerName: player.name, score: pileScore, cards: pileCards, state: getRoomPublicState(room) });
        endRound(room);
        return;
      }

      // 下一玩家
      room.currentPlayer = (playerIdx + 1) % room.players.length;
      broadcast(room, { type: 'turn_change', currentPlayer: room.currentPlayer, playerId: room.players[room.currentPlayer].id });
    }

    else if (msg.type === 'pass') {
      const room = rooms.get(clientInfo.roomId);
      if (!room || room.status !== 'playing') return;
      const playerIdx = room.players.findIndex(p => p.id === clientInfo.playerId);
      if (playerIdx !== room.currentPlayer) return;
      if (!room.lastPlay) { send(ws, { type: 'error', msg: '先手不能过牌' }); return; }

      room.passCount++;
      broadcast(room, { type: 'player_passed', playerId: clientInfo.playerId, playerName: room.players[playerIdx].name });

      // 所有其他人都过牌了，当前lastPlayerId赢得墩
      if (room.passCount >= room.players.length - 1) {
        const winner = room.players.find(p => p.id === room.lastPlayerId);
        if (winner) {
          const pileScore = calcPileScore(room.pile);
          winner.score += pileScore;
          const pileCards = [...room.pile];
          room.pile = [];
          room.lastPlay = null;
          room.lastPlayCards = [];
          room.lastPlayerId = null;
          room.passCount = 0;
          broadcast(room, { type: 'pile_won', winnerId: winner.id, winnerName: winner.name, score: pileScore, cards: pileCards, state: getRoomPublicState(room) });
          // 赢墩者继续先手
          const winnerIdx = room.players.indexOf(winner);
          room.currentPlayer = winnerIdx;
          broadcast(room, { type: 'turn_change', currentPlayer: winnerIdx, playerId: winner.id });
        }
      } else {
        room.currentPlayer = (playerIdx + 1) % room.players.length;
        broadcast(room, { type: 'turn_change', currentPlayer: room.currentPlayer, playerId: room.players[room.currentPlayer].id });
      }
    }

    else if (msg.type === 'next_round') {
      const room = rooms.get(clientInfo.roomId);
      if (!room || room.status !== 'settlement') return;
      if (room.players[0].id !== clientInfo.playerId) return;
      room.status = 'waiting';
      broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });
    }
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    if (info && info.roomId) {
      const room = rooms.get(info.roomId);
      if (room) {
        const player = room.players.find(p => p.id === info.playerId);
        if (player) player.isOnline = false;
        broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });
      }
    }
    clients.delete(ws);
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => console.log(`河南五十K 服务器运行在端口 ${PORT}`));
