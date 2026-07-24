const assert = require('assert');
const net = require('net');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const START_TIMEOUT_MS = 12_000;
const MESSAGE_TIMEOUT_MS = 10_000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = address && typeof address === 'object' ? address.port : null;
      probe.close(error => {
        if (error) reject(error);
        else if (!port) reject(new Error('无法分配重连冒烟测试端口'));
        else resolve(port);
      });
    });
  });
}

async function waitForServerPort(port, child, getLogs) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`服务器提前退出\n${getLogs()}`);
    try {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: '127.0.0.1', port });
        socket.setTimeout(800);
        socket.once('connect', () => { socket.destroy(); resolve(); });
        socket.once('timeout', () => socket.destroy(new Error('端口探测超时')));
        socket.once('error', reject);
      });
      return;
    } catch {
      await delay(120);
    }
  }
  throw new Error(`服务器未在${START_TIMEOUT_MS}ms内开放端口\n${getLogs()}`);
}

function openSocket(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('WebSocket连接超时')), MESSAGE_TIMEOUT_MS);
    ws.once('open', () => { clearTimeout(timer); resolve(ws); });
    ws.once('error', error => { clearTimeout(timer); reject(error); });
  });
}

function waitForMessages(ws, predicate, label) {
  return new Promise((resolve, reject) => {
    const messages = [];
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`等待${label}超时，已收到：${JSON.stringify(messages.map(message => message.type))}`));
    }, MESSAGE_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timer);
      ws.off('message', onMessage);
      ws.off('close', onClose);
      ws.off('error', onError);
    }

    function onMessage(raw) {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch (error) {
        cleanup();
        reject(new Error(`服务器返回非JSON消息：${error.message}`));
        return;
      }
      messages.push(message);
      if (message.type === 'error') {
        cleanup();
        reject(new Error(`服务器返回错误：${message.msg || '未知错误'}`));
        return;
      }
      if (predicate(messages)) {
        cleanup();
        resolve(messages);
      }
    }

    function onClose(code) {
      cleanup();
      reject(new Error(`WebSocket在等待${label}时关闭（code=${code}）`));
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    ws.on('message', onMessage);
    ws.once('close', onClose);
    ws.once('error', onError);
  });
}

function closeSocket(ws) {
  return new Promise(resolve => {
    if (!ws || ws.readyState === WebSocket.CLOSED) { resolve(); return; }
    const timer = setTimeout(() => { ws.terminate(); resolve(); }, 1_000);
    ws.once('close', () => { clearTimeout(timer); resolve(); });
    ws.close();
  });
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    delay(1_500),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

(async () => {
  const port = await getFreePort();
  const child = spawn(process.execPath, ['-r', './bot-ai-hook.js', './index.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      SOLO_ROOM_RECONNECT_GRACE_MS: '5000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const getLogs = () => `stdout:\n${stdout}\nstderr:\n${stderr}`;
  let firstSocket;
  let secondSocket;

  try {
    await waitForServerPort(port, child, getLogs);
    const url = `ws://127.0.0.1:${port}`;
    firstSocket = await openSocket(url);
    const initialMessagesPromise = waitForMessages(
      firstSocket,
      messages => messages.some(message => message.type === 'room_joined') && messages.some(message => message.type === 'your_hand'),
      '首次单机开局消息',
    );
    firstSocket.send(JSON.stringify({ type: 'create_room', playerName: '重连测试玩家', maxPlayers: 4, solo: true }));
    const initialMessages = await initialMessagesPromise;
    const joined = initialMessages.find(message => message.type === 'room_joined');
    const initialHand = initialMessages.find(message => message.type === 'your_hand');

    assert.ok(joined.playerToken, '首次加入必须返回重连令牌');
    assert.ok(joined.playerId, '首次加入必须返回玩家ID');
    assert.match(joined.roomId || '', /^\d{6}$/, '首次加入必须返回6位房间号');
    assert.ok(Array.isArray(initialHand.hand) && initialHand.hand.length > 0, '首次开局必须收到手牌');

    const initialCardIds = initialHand.hand.map(card => card.id).sort();
    await closeSocket(firstSocket);
    firstSocket = null;
    await delay(250);

    secondSocket = await openSocket(url);
    const reconnectMessagesPromise = waitForMessages(
      secondSocket,
      messages => messages.some(message => message.type === 'room_joined' && message.reconnect === true)
        && messages.some(message => message.type === 'your_hand'),
      '断线重连恢复消息',
    );
    secondSocket.send(JSON.stringify({
      type: 'join_room',
      roomId: joined.roomId,
      playerId: joined.playerId,
      playerToken: joined.playerToken,
      playerName: '重连测试玩家',
    }));
    const reconnectMessages = await reconnectMessagesPromise;
    const rejoined = reconnectMessages.find(message => message.type === 'room_joined');
    const restoredHand = reconnectMessages.find(message => message.type === 'your_hand');

    assert.strictEqual(rejoined.reconnect, true, '重连消息必须明确标记reconnect');
    assert.strictEqual(rejoined.roomId, joined.roomId, '重连后必须恢复原房间');
    assert.strictEqual(rejoined.playerId, joined.playerId, '重连后必须恢复原玩家身份');
    assert.strictEqual(rejoined.playerToken, joined.playerToken, '重连后必须沿用原令牌');
    assert.deepStrictEqual(restoredHand.hand.map(card => card.id).sort(), initialCardIds, '重连后必须恢复原手牌');
    assert.strictEqual(child.exitCode, null, '完成重连后服务器应继续运行');

    console.log('server-reconnect-smoke tests passed');
  } catch (error) {
    error.message += `\n${getLogs()}`;
    throw error;
  } finally {
    await closeSocket(firstSocket);
    await closeSocket(secondSocket);
    await stopChild(child);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
