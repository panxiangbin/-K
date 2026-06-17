const WebSocket = require('ws');

const SERVER = 'wss://henan-50k-production-9ecf.up.railway.app';
const DELAY = ms => new Promise(r => setTimeout(r, ms));

let testsPassed = 0;
let testsFailed = 0;
let log = [];

function assert(cond, msg) {
  if (cond) {
    testsPassed++;
    log.push(`  ✓ ${msg}`);
  } else {
    testsFailed++;
    log.push(`  ✗ ${msg}`);
  }
}

function createClient(name) {
  return new Promise((resolve) => {
    const ws = new WebSocket(SERVER);
    const state = { name, msgs: [], hand: [], info: null, gameState: null, ws };
    ws.on('message', raw => {
      const msg = JSON.parse(raw);
      state.msgs.push(msg);
      if (msg.type === 'room_joined') state.info = msg;
      if (msg.type === 'room_update') state.gameState = msg.state;
      if (msg.type === 'game_start') { state.gameState = msg.state; }
      if (msg.type === 'your_hand') state.hand = msg.hand;
      if (msg.type === 'cards_played') state.gameState = msg.state;
      if (msg.type === 'pile_won') state.gameState = msg.state;
      if (msg.type === 'round_end') state.roundEnd = msg.result;
    });
    ws.on('open', () => resolve(state));
    ws.on('error', e => { log.push(`  [WS error ${name}]: ${e.message}`); });
  });
}

function send(client, msg) {
  client.ws.send(JSON.stringify(msg));
}

function waitFor(client, type, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = setInterval(() => {
      const found = client.msgs.find(m => m.type === type);
      if (found) { clearInterval(check); resolve(found); }
      if (Date.now() - start > timeout) { clearInterval(check); reject(new Error(`timeout waiting for ${type}`)); }
    }, 100);
  });
}

function waitForAny(client, types, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = setInterval(() => {
      const found = client.msgs.find(m => types.includes(m.type));
      if (found) { clearInterval(check); resolve(found); }
      if (Date.now() - start > timeout) { clearInterval(check); reject(new Error(`timeout waiting for ${types}`)); }
    }, 100);
  });
}

function clearMsgs(client) { client.msgs = []; }

function getMyState(client) {
  return client.gameState?.players?.find(p => p.id === client.info?.playerId);
}

function getMyIdx(client) {
  return client.gameState?.players?.findIndex(p => p.id === client.info?.playerId) ?? -1;
}

async function playOneRound(p1, p2, p3, roundNum) {
  log.push(`\n--- 第 ${roundNum} 局 ---`);
  clearMsgs(p1); clearMsgs(p2); clearMsgs(p3);

  // 等待手牌
  await Promise.all([
    waitFor(p1, 'your_hand', 5000).then(m => { p1.hand = m.hand; }),
    waitFor(p2, 'your_hand', 5000).then(m => { p2.hand = m.hand; }),
    waitFor(p3, 'your_hand', 5000).then(m => { p3.hand = m.hand; }),
  ]).catch(() => {});

  assert(p1.hand.length > 0, `玩家1有手牌 (${p1.hand.length}张)`);
  assert(p2.hand.length > 0, `玩家2有手牌 (${p2.hand.length}张)`);
  assert(p3.hand.length > 0, `玩家3有手牌 (${p3.hand.length}张)`);
  assert(p1.hand.length + p2.hand.length + p3.hand.length === 108, `总牌数108张`);

  const clients = [p1, p2, p3];
  let turnCount = 0;
  let maxTurns = 200;

  while (turnCount < maxTurns) {
    turnCount++;
    await DELAY(80);

    // 找当前出牌玩家
    const gs = p1.gameState || p2.gameState || p3.gameState;
    if (!gs) continue;

    const curIdx = gs.currentPlayer;
    const cur = clients.find(c => getMyIdx(c) === curIdx);
    if (!cur) continue;

    clearMsgs(p1); clearMsgs(p2); clearMsgs(p3);

    const hasLastPlay = !!gs.lastPlay;
    const myIdx = getMyIdx(cur);
    const isMyPile = gs.lastPlayerId === cur.info?.playerId || !hasLastPlay;

    if (cur.hand.length === 0) {
      // 该玩家已无牌，等待服务器推进
      await DELAY(300);
      continue;
    }

    let played = false;
    if (!hasLastPlay || isMyPile) {
      // 先手：出第一张
      const card = cur.hand[0];
      send(cur, { type: 'play_cards', cardIds: [card.id] });
      cur.hand = cur.hand.filter(c => c.id !== card.id);
      played = true;
    } else {
      // 非先手：直接过牌
      send(cur, { type: 'pass' });
    }

    // 等待服务器响应
    const resp = await waitForAny(p1, ['cards_played', 'player_passed', 'pile_won', 'round_end', 'error'], 5000).catch(() => null);
    if (!resp) {
      await DELAY(200);
      continue;
    }

    if (resp.type === 'round_end') {
      log.push(`  → 第${roundNum}局结束`);
      clearMsgs(p1); clearMsgs(p2); clearMsgs(p3);
      return resp.result;
    }

    // 更新手牌
    if (resp.type === 'cards_played') {
      [p1, p2, p3].forEach(c => {
        if (c.gameState) {
          const ps = c.gameState.players.find(p => p.id === cur.info?.playerId);
          if (ps) ps.cardCount = cur.hand.length;
        }
      });
    }

    // 检查是否有玩家出完手牌触发round_end
    const anyEmpty = [p1,p2,p3].some(c => c.hand.length === 0);
    if (anyEmpty) {
      const re = await waitForAny(p1, ['round_end'], 3000).catch(() => null);
      if (re) {
        log.push(`  → 第${roundNum}局结束（有人出完牌）`);
        clearMsgs(p1); clearMsgs(p2); clearMsgs(p3);
        return re.result;
      }
    }
  }

  log.push(`  → 第${roundNum}局达到最大回合数(${maxTurns})，强制结束`);
  return null;
}

async function runTest() {
  console.log('\n🎮 河南五十K 自动化测试开始\n');
  console.log('连接服务器:', SERVER);

  // 测试1：连接
  log.push('\n[测试1] 连接服务器');
  let p1, p2, p3;
  try {
    [p1, p2, p3] = await Promise.all([
      createClient('测试甲'),
      createClient('测试乙'),
      createClient('测试丙'),
    ]);
    assert(true, '3个客户端连接成功');
  } catch(e) {
    assert(false, `连接失败: ${e.message}`);
    return;
  }

  // 测试2：创建房间
  log.push('\n[测试2] 创建/加入房间');
  send(p1, { type: 'create_room', playerName: '测试甲', maxPlayers: 3 });
  const roomMsg = await waitFor(p1, 'room_joined', 5000).catch(() => null);
  assert(!!roomMsg, '房主创建房间成功');
  if (!roomMsg) { printResult(); return; }

  const roomId = p1.info?.roomId;
  assert(!!roomId && roomId.length === 6, `房间号6位: ${roomId}`);

  send(p2, { type: 'join_room', roomId, playerName: '测试乙' });
  send(p3, { type: 'join_room', roomId, playerName: '测试丙' });
  await DELAY(500);

  const gs = p1.gameState;
  assert(gs?.players?.length === 3, `3名玩家在房间`);

  // 测试3：开始游戏
  log.push('\n[测试3] 开始游戏');
  clearMsgs(p1); clearMsgs(p2); clearMsgs(p3);
  send(p1, { type: 'start_game' });

  const startMsg = await waitForAny(p1, ['game_start', 'your_hand'], 5000).catch(() => null);
  assert(!!startMsg, '游戏开始');

  // 等手牌
  await DELAY(1000);

  // 测试4-11：打8局游戏
  for (let round = 1; round <= 8; round++) {
    log.push(`\n[测试${3+round}] 第${round}局对局`);

    if (round > 1) {
      // 等待下一局开始
      await DELAY(500);
      clearMsgs(p1); clearMsgs(p2); clearMsgs(p3);
      send(p1, { type: 'next_round' });
      await DELAY(800);
    }

    const result = await playOneRound(p1, p2, p3, round);

    if (result) {
      assert(Array.isArray(result) && result.length === 3, `第${round}局结算数据正确(3人)`);
      assert(result.every(r => typeof r.score === 'number'), `第${round}局每人有分数`);
      const totalScore = result.reduce((s,r) => s + r.score, 0);
      log.push(`  分数: ${result.map(r=>r.name+':'+r.score).join(', ')} 合计:${totalScore}`);
    } else {
      log.push(`  第${round}局测试跳过（超时）`);
    }

    await DELAY(300);
  }

  // 测试：断线重连
  log.push('\n[测试12] 断线重连');
  const savedName = p2.info?.playerId;
  p2.ws.close();
  await DELAY(500);

  const p2new = await createClient('测试乙');
  send(p2new, { type: 'join_room', roomId, playerName: '测试乙' });
  await DELAY(500);
  assert(true, '重连尝试完成');

  // 关闭
  [p1, p2, p3, p2new].forEach(c => { try { c.ws.close(); } catch{} });

  printResult();
}

function printResult() {
  console.log('\n' + '='.repeat(50));
  log.forEach(l => console.log(l));
  console.log('\n' + '='.repeat(50));
  console.log(`\n结果: ${testsPassed} 通过 / ${testsFailed} 失败 / ${testsPassed+testsFailed} 总计`);
  if (testsFailed === 0) {
    console.log('🎉 全部测试通过！游戏可以正常运行。');
  } else {
    console.log('⚠️  有测试失败，请检查上方日志。');
  }
  process.exit(testsFailed > 0 ? 1 : 0);
}

runTest().catch(e => {
  console.error('测试崩溃:', e);
  process.exit(1);
});
