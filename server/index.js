const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { dealCards, sortCards, detectPattern, comparePatterns, canBeat, calcPileScore, getTargetScores, CARD_ORDER } = require('./game-logic');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const rooms = new Map();
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

function cardValue(rank) { return CARD_ORDER.indexOf(rank); }
function isBlack(suit) { return suit === '♠' || suit === '♣'; }
function isRed(suit) { return suit === '♥' || suit === '♦'; }

function createBotPlayer(index) {
  return {
    id: `bot-${genPlayerId()}`,
    token: null,
    name: ['小河', '阿豫', '老K'][index - 1] || `机器人${index}`,
    hand: [],
    score: 0,
    totalScore: 0,
    isOnline: true,
    isBot: true,
    left: false,
  };
}

function broadcast(room, msg) {
  for (const [ws, info] of clients.entries()) {
    if (info.roomId === room.id && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }
}

function send(ws, msg) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }
function sendError(ws, msg) { send(ws, { type: 'error', msg }); }

function hasOpenConnection(roomId, playerId, exceptWs = null) {
  for (const [ws, info] of clients.entries()) {
    if (ws !== exceptWs && info.roomId === roomId && info.playerId === playerId && ws.readyState === WebSocket.OPEN) return true;
  }
  return false;
}

function sendHand(room, playerId) {
  const player = room.players.find(p => p.id === playerId);
  if (!player || player.isBot || player.left) return;
  for (const [ws, info] of clients.entries()) {
    if (info.roomId === room.id && info.playerId === playerId) send(ws, { type: 'your_hand', hand: player.hand || [] });
  }
}

function getRoomPublicState(room) {
  return {
    id: room.id,
    maxPlayers: room.maxPlayers,
    mode: room.mode || 'online',
    status: room.status,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand ? p.hand.length : 0,
      score: p.score,
      totalScore: p.totalScore,
      isOnline: p.isOnline,
      isBot: Boolean(p.isBot),
      left: Boolean(p.left),
    })),
    currentPlayer: room.currentPlayer,
    lastPlay: room.lastPlay,
    lastPlayCards: room.lastPlayCards || [],
    lastPlayerId: room.lastPlayerId,
    trickPlays: room.trickPlays || [],
    pile: room.pile,
    roundScores: room.roundScores || [],
    roundHistory: room.roundHistory || [],
    finishOrder: room.finishOrder || [],
    flipCard: room.flipCard,
    roundNum: room.roundNum,
  };
}

function canAct(player) { return Boolean(player && !player.left && player.isOnline && player.hand && player.hand.length > 0); }
function hasCards(player) { return Boolean(player && !player.left && player.hand && player.hand.length > 0); }
function activeCardPlayers(room) { return room.players.filter(hasCards); }
function pendingOpponentCount(room) {
  if (!room.lastPlay) return 0;
  return room.players.filter(p => p.id !== room.lastPlayerId && hasCards(p)).length;
}

function upsertTrickAction(room, entry) {
  room.trickPlays = room.trickPlays || [];
  const idx = room.trickPlays.findIndex(x => x.playerId === entry.playerId);
  if (idx >= 0) room.trickPlays[idx] = entry;
  else room.trickPlays.push(entry);
}

function recordTrickPlay(room, player, cards, pattern) {
  upsertTrickAction(room, {
    playerId: player.id,
    playerName: player.name,
    action: 'play',
    cards,
    pattern,
    isBot: Boolean(player.isBot),
    createdAt: Date.now(),
  });
}

function recordTrickPass(room, player, auto = false) {
  if (!room || !player) return;
  upsertTrickAction(room, {
    playerId: player.id,
    playerName: player.name,
    action: 'pass',
    cards: [],
    pattern: null,
    auto,
    isBot: Boolean(player.isBot),
    createdAt: Date.now(),
  });
}

function recordFinish(room, player) {
  if (!room.finishOrder) room.finishOrder = [];
  if (player && !room.finishOrder.includes(player.id)) {
    room.finishOrder.push(player.id);
    broadcast(room, { type: 'player_finished', playerId: player.id, playerName: player.name, finishRank: room.finishOrder.length });
  }
}

function setTurn(room, idx) {
  room.currentPlayer = idx;
  broadcast(room, { type: 'turn_change', currentPlayer: idx, playerId: room.players[idx]?.id });
  scheduleBotTurn(room);
}

function awardPile(room) {
  const winner = room.players.find(p => p.id === room.lastPlayerId);
  if (!winner) return -1;

  const pileScore = calcPileScore(room.pile);
  winner.score += pileScore;
  const pileCards = [...room.pile];
  const trickPlays = [...(room.trickPlays || [])];
  room.pile = [];
  room.lastPlay = null;
  room.lastPlayCards = [];
  room.lastPlayerId = null;
  room.trickPlays = [];
  room.passCount = 0;

  broadcast(room, {
    type: 'pile_won',
    winnerId: winner.id,
    winnerName: winner.name,
    score: pileScore,
    cards: pileCards,
    trickPlays,
    state: getRoomPublicState(room),
  });

  return room.players.indexOf(winner);
}

function getSettlementRanking(room) {
  const finishIds = new Set(room.finishOrder || []);
  const finished = (room.finishOrder || []).map(id => room.players.find(p => p.id === id)).filter(Boolean);
  const remaining = room.players.filter(p => !finishIds.has(p.id) && !p.left).sort((a, b) => (b.score - a.score) || ((a.hand?.length || 0) - (b.hand?.length || 0)));
  return [...finished, ...remaining];
}

function endRound(room) {
  if (room.status === 'settlement') return;
  const ranked = getSettlementRanking(room);
  const targets = getTargetScores(room.players.length);
  ranked.forEach(p => { p.totalScore = (p.totalScore || 0) + p.score; });

  const result = ranked.map((p, i) => {
    const target = targets[i] || 0;
    const qualified = p.score >= target;
    return { id: p.id, name: p.name, score: p.score, rank: i + 1, target, qualified, isWin: qualified, totalScore: p.totalScore, isBot: Boolean(p.isBot) };
  });

  room.roundScores = result;
  room.roundHistory = room.roundHistory || [];
  room.roundHistory.push({ roundNum: room.roundNum || 1, playerCount: room.players.length, targets, result, createdAt: Date.now() });
  room.roundHistory = room.roundHistory.slice(-20);
  room.status = 'settlement';
  broadcast(room, { type: 'round_end', result, state: getRoomPublicState(room) });
}

function finishRoundIfAllCardsGone(room) {
  if (!room || room.status !== 'playing') return false;
  if (activeCardPlayers(room).length > 0) return false;
  if (room.pile.length > 0 && room.lastPlayerId) awardPile(room);
  endRound(room);
  return true;
}

function advanceTurn(room, startIdx) {
  if (!room || room.status !== 'playing' || room.players.length === 0) return;
  if (finishRoundIfAllCardsGone(room)) return;

  const len = room.players.length;
  let idx = ((startIdx % len) + len) % len;
  let safety = 0;

  while (safety < len * 3) {
    if (finishRoundIfAllCardsGone(room)) return;

    if (room.lastPlay && room.passCount >= pendingOpponentCount(room)) {
      const winnerIdx = awardPile(room);
      if (finishRoundIfAllCardsGone(room)) return;
      idx = winnerIdx >= 0 ? winnerIdx : idx;
      safety = 0;
      continue;
    }

    const player = room.players[idx];
    if (canAct(player)) { setTurn(room, idx); return; }

    if (room.lastPlay && player && player.id !== room.lastPlayerId && hasCards(player)) {
      room.passCount++;
      recordTrickPass(room, player, true);
      broadcast(room, { type: 'player_passed', playerId: player.id, playerName: player.name + '（离线自动）', auto: true, state: getRoomPublicState(room) });
    }

    idx = (idx + 1) % len;
    safety++;
  }
}

function groupByRank(hand) {
  const groups = {};
  for (const c of hand) { if (!groups[c.rank]) groups[c.rank] = []; groups[c.rank].push(c); }
  return groups;
}

function find50KBombs(hand) {
  const results = [];
  for (const suit of ['♠', '♥', '♣', '♦']) {
    const five = hand.find(c => c.rank === '5' && c.suit === suit);
    const ten = hand.find(c => c.rank === '10' && c.suit === suit);
    const king = hand.find(c => c.rank === 'K' && c.suit === suit);
    if (five && ten && king) results.push([five, ten, king]);
  }
  return results;
}

function getBotCandidateCombos(hand) {
  const sorted = sortCards(hand);
  const groups = groupByRank(sorted);
  const combos = [];
  for (const card of sorted) combos.push([card]);
  for (const group of Object.values(groups)) {
    if (group.length >= 2) combos.push(group.slice(0, 2));
    if (group.length >= 3) combos.push(group.slice(0, 3));
    if (group.length >= 4) combos.push(group.slice(0, 4));
    if (group.length >= 5) combos.push(group.slice(0, 5));
    if (group.length >= 6) combos.push(group.slice(0, 6));
    if (group.length >= 7) combos.push(group.slice(0, 7));
    if (group.length >= 8) combos.push(group.slice(0, 8));
    const blacks = group.filter(c => isBlack(c.suit));
    const reds = group.filter(c => isRed(c.suit));
    if (blacks.length >= 4) combos.push(blacks.slice(0, 4));
    if (reds.length >= 4) combos.push(reds.slice(0, 4));
  }
  combos.push(...find50KBombs(sorted));
  const big = sorted.filter(c => c.rank === '大王');
  const small = sorted.filter(c => c.rank === '小王');
  if (big.length >= 2 && small.length >= 2) combos.push([big[0], big[1], small[0], small[1]]);
  return combos;
}

function patternWeight(pattern) {
  if (!pattern) return 999999;
  if (pattern.type !== 'bomb') {
    const order = { single: 1, pair: 2, triple: 3, four: 4, five: 5, six: 6, seven: 7 };
    return (order[pattern.type] || 9) * 100 + cardValue(pattern.rank);
  }
  const bombOrder = { '50K': 20, color4: 30, same8: 40, joker4: 50 };
  if (pattern.bombType === 'color4') {
    const colorOrder = { red: 1, black: 2 };
    return bombOrder.color4 * 1000 + cardValue(pattern.rank) * 2 + (colorOrder[pattern.color] || 0);
  }
  if (pattern.bombType === '50K') return bombOrder['50K'] * 1000 + (['♦','♣','♥','♠'].indexOf(pattern.suit) + 1);
  return (bombOrder[pattern.bombType] || 90) * 1000 + cardValue(pattern.rank || '3');
}

function chooseBotMove(hand, lastPlay) {
  const candidates = getBotCandidateCombos(hand).map(cards => ({ cards, pattern: detectPattern(cards) })).filter(x => x.pattern && comparePatterns(x.pattern, lastPlay));
  if (!candidates.length) return null;
  if (lastPlay && lastPlay.type !== 'bomb') {
    const sameType = candidates.filter(x => x.pattern.type === lastPlay.type);
    if (sameType.length) return sameType.sort((a, b) => patternWeight(a.pattern) - patternWeight(b.pattern))[0].cards;
  }
  return candidates.sort((a, b) => patternWeight(a.pattern) - patternWeight(b.pattern))[0].cards;
}

function applyPlay(room, playerIdx, selectedCards) {
  const player = room.players[playerIdx];
  const cardIds = selectedCards.map(c => c.id);
  const pattern = detectPattern(selectedCards);
  if (!pattern || !comparePatterns(pattern, room.lastPlay)) return false;

  const newTrick = !room.lastPlay;
  if (newTrick) room.trickPlays = [];
  player.hand = player.hand.filter(c => !cardIds.includes(c.id));
  player.hand = sortCards(player.hand);
  room.pile.push(...selectedCards);
  room.lastPlay = pattern;
  room.lastPlayCards = selectedCards;
  room.lastPlayerId = player.id;
  room.passCount = 0;
  recordTrickPlay(room, player, selectedCards, pattern);

  sendHand(room, player.id);
  broadcast(room, { type: 'cards_played', playerId: player.id, playerName: player.name, cards: selectedCards, pattern, state: getRoomPublicState(room) });

  if (player.hand.length === 0) {
    recordFinish(room, player);
    if (finishRoundIfAllCardsGone(room)) return true;
  }
  advanceTurn(room, playerIdx + 1);
  return true;
}

function scheduleBotTurn(room) {
  if (!room || room.status !== 'playing') return;
  const bot = room.players[room.currentPlayer];
  if (!bot || !bot.isBot || !hasCards(bot)) return;

  setTimeout(() => {
    if (!rooms.has(room.id) || room.status !== 'playing') return;
    const idx = room.currentPlayer;
    const player = room.players[idx];
    if (!player || !player.isBot || !hasCards(player)) return;

    const move = chooseBotMove(player.hand, room.lastPlay);
    if (move && move.length) { applyPlay(room, idx, move); return; }

    if (!room.lastPlay) { applyPlay(room, idx, [sortCards(player.hand)[0]]); return; }

    room.passCount++;
    recordTrickPass(room, player, false);
    broadcast(room, { type: 'player_passed', playerId: player.id, playerName: player.name, state: getRoomPublicState(room) });
    advanceTurn(room, idx + 1);
  }, 650 + Math.floor(Math.random() * 500));
}

function startGame(room) {
  const pc = room.players.length;
  const { hands, flipCard } = dealCards(pc);
  room.players.forEach((p, i) => { p.hand = sortCards(hands[i]); p.score = 0; p.left = false; });

  let firstPlayer = 0;
  for (let i = 0; i < room.players.length; i++) {
    if (room.players[i].hand.some(c => c.id === flipCard.id)) { firstPlayer = i; break; }
  }

  room.flipCard = flipCard;
  room.currentPlayer = firstPlayer;
  room.lastPlay = null;
  room.lastPlayCards = [];
  room.lastPlayerId = null;
  room.trickPlays = [];
  room.pile = [];
  room.passCount = 0;
  room.finishOrder = [];
  room.roundScores = [];
  room.status = 'playing';
  room.roundNum = (room.roundNum || 0) + 1;

  broadcast(room, { type: 'game_start', state: getRoomPublicState(room), flipCard });
  for (const p of room.players) sendHand(room, p.id);
  setTurn(room, firstPlayer);
}

function handlePlayerLeave(ws, manual = false) {
  const info = clients.get(ws);
  if (!info || !info.roomId) return;
  const room = rooms.get(info.roomId);
  if (!room) { clients.set(ws, { playerId: null, roomId: null, playerName: null }); return; }
  const playerIdx = room.players.findIndex(p => p.id === info.playerId);
  const player = room.players[playerIdx];

  if (manual) send(ws, { type: 'room_left', roomId: info.roomId });

  if (room.mode === 'solo') {
    rooms.delete(room.id);
    clients.set(ws, { playerId: null, roomId: null, playerName: null });
    return;
  }

  if (player && !player.isBot && !hasOpenConnection(info.roomId, info.playerId, ws)) {
    player.isOnline = false;
    if (manual) player.left = true;
    broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });

    if (room.status === 'playing' && room.currentPlayer === playerIdx) {
      if (room.lastPlay && player.id !== room.lastPlayerId && hasCards(player)) {
        room.passCount++;
        recordTrickPass(room, player, true);
        broadcast(room, { type: 'player_passed', playerId: player.id, playerName: player.name + (manual ? '（已退出）' : '（离线自动）'), auto: true, state: getRoomPublicState(room) });
      }
      advanceTurn(room, playerIdx + 1);
    }
  }
  clients.set(ws, { playerId: null, roomId: null, playerName: null });
}

wss.on('connection', (ws) => {
  clients.set(ws, { playerId: null, roomId: null, playerName: null });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const clientInfo = clients.get(ws);

    if (msg.type === 'create_room') {
      const { playerName, maxPlayers, solo } = msg;
      const cleanName = String(playerName || '').trim() || '我';
      const playerId = genPlayerId();
      const playerToken = genPlayerToken();
      const roomId = genRoomId();
      const roomMaxPlayers = maxPlayers || 4;
      const room = {
        id: roomId,
        maxPlayers: roomMaxPlayers,
        mode: solo ? 'solo' : 'online',
        status: 'waiting',
        players: [{ id: playerId, token: playerToken, name: cleanName, hand: [], score: 0, totalScore: 0, isOnline: true, isBot: false, left: false }],
        currentPlayer: 0,
        lastPlay: null,
        lastPlayCards: [],
        lastPlayerId: null,
        trickPlays: [],
        pile: [],
        passCount: 0,
        extra: [],
        roundNum: 0,
        roundScores: [],
        roundHistory: [],
        finishOrder: [],
      };

      if (solo) while (room.players.length < roomMaxPlayers) room.players.push(createBotPlayer(room.players.length));

      rooms.set(roomId, room);
      clients.set(ws, { playerId, roomId, playerName: cleanName });
      send(ws, { type: 'room_joined', playerId, playerToken, roomId, playerIndex: 0 });
      broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });
      if (solo) setTimeout(() => startGame(room), 350);
    }

    else if (msg.type === 'join_room') {
      const roomId = String(msg.roomId || '').trim();
      const cleanName = String(msg.playerName || '').trim();
      const room = rooms.get(roomId);
      if (!room) { sendError(ws, '房间不存在'); return; }
      const token = msg.playerToken || msg.token;
      const requestedPlayerId = msg.playerId;
      const reconnecting = token ? room.players.find(p => p.token === token && !p.left && (!requestedPlayerId || p.id === requestedPlayerId)) : null;

      if (reconnecting) {
        reconnecting.isOnline = true;
        clients.set(ws, { playerId: reconnecting.id, roomId, playerName: reconnecting.name });
        send(ws, { type: 'room_joined', playerId: reconnecting.id, playerToken: reconnecting.token, roomId, playerIndex: room.players.indexOf(reconnecting), reconnect: true });
        sendHand(room, reconnecting.id);
        broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });
        if (room.status === 'playing') setTurn(room, room.currentPlayer);
        return;
      }

      if (room.status !== 'waiting') { sendError(ws, '游戏已开始，无法加入；断线重连请用原设备进入'); return; }
      if (!cleanName) { sendError(ws, '请输入昵称'); return; }
      if (room.players.some(p => !p.left && p.name === cleanName)) { sendError(ws, '昵称已被使用，请换一个'); return; }
      if (room.players.filter(p => !p.left).length >= room.maxPlayers) { sendError(ws, '房间已满'); return; }

      const playerId = genPlayerId();
      const playerToken = genPlayerToken();
      const player = { id: playerId, token: playerToken, name: cleanName || `玩家${room.players.length + 1}`, hand: [], score: 0, totalScore: 0, isOnline: true, isBot: false, left: false };
      room.players.push(player);
      clients.set(ws, { playerId, roomId, playerName: player.name });
      send(ws, { type: 'room_joined', playerId, playerToken, roomId, playerIndex: room.players.length - 1 });
      broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });
    }

    else if (msg.type === 'leave_room') {
      handlePlayerLeave(ws, true);
    }

    else if (msg.type === 'start_game') {
      const room = rooms.get(clientInfo.roomId);
      if (!room) return;
      if (room.players[0].id !== clientInfo.playerId) { sendError(ws, '只有房主可以开始'); return; }
      if (room.status !== 'waiting') { sendError(ws, '当前状态不能开始游戏'); return; }
      if (room.players.filter(p => !p.left).length < 3) { sendError(ws, '至少需要3名玩家'); return; }
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
      applyPlay(room, playerIdx, selectedCards);
    }

    else if (msg.type === 'pass') {
      const room = rooms.get(clientInfo.roomId);
      if (!room || room.status !== 'playing') return;
      const playerIdx = room.players.findIndex(p => p.id === clientInfo.playerId);
      if (playerIdx !== room.currentPlayer) return;
      if (!room.lastPlay) { sendError(ws, '先手不能过牌'); return; }
      const player = room.players[playerIdx];
      if (canBeat(player.hand, room.lastPlay)) { sendError(ws, '你有能压的牌，必须出！'); return; }
      room.passCount++;
      recordTrickPass(room, player, false);
      broadcast(room, { type: 'player_passed', playerId: clientInfo.playerId, playerName: room.players[playerIdx].name, state: getRoomPublicState(room) });
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
      room.trickPlays = [];
      room.pile = [];
      room.passCount = 0;
      room.finishOrder = [];
      room.roundScores = [];
      if (room.mode === 'solo') startGame(room);
      else broadcast(room, { type: 'room_update', state: getRoomPublicState(room) });
    }
  });

  ws.on('close', () => {
    handlePlayerLeave(ws, false);
    clients.delete(ws);
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => console.log(`河南五十K 服务器运行在端口 ${PORT}`));
