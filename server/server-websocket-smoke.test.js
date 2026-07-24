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
        else if (!port) reject(new Error('无法分配WebSocket冒烟测试端口'));
        else resolve(port);
      });
    });
  });
}

async function waitForServerPort(port, child, getLogs) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let lastError = null;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`服务器在WebSocket连接前退出（code=${child.exitCode}）\n${getLogs()}`);
    }

    try {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: '127.0.0.1', port });
        socket.setTimeout(800);
        socket.once('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.once('timeout', () => socket.destroy(new Error('端口探测超时')));
        socket.once('error', reject);
      });
      return;
    } catch (error) {
      lastError = error;
      await delay(120);
    }
  }

  throw new Error(`服务器未在${START_TIMEOUT_MS}ms内开放端口：${lastError?.message || '未知错误'}\n${getLogs()}`);
}

function collectSoloGameMessages(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const messages = [];
    let settled = false;

    const timer = setTimeout(() => {
      finish(new Error(`等待单机开局消息超时，已收到：${JSON.stringify(messages.map(message => message.type))}`));
    }, MESSAGE_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timer);
      ws.removeAllListeners();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.terminate();
    }

    function finish(error) {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(messages);
    }

    function hasRequiredMessages() {
      const joined = messages.find(message => message.type === 'room_joined');
      const started = messages.find(message => message.type === 'game_start');
      const hand = messages.find(message => message.type === 'your_hand');
      return joined && started && hand;
    }

    ws.once('open', () => {
      ws.send(JSON.stringify({
        type: 'create_room',
        playerName: '冒烟测试玩家',
        maxPlayers: 4,
        solo: true,
      }));
    });

    ws.on('message', raw => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch (error) {
        finish(new Error(`服务器返回了非JSON WebSocket消息：${error.message}`));
        return;
      }

      messages.push(message);
      if (message.type === 'error') {
        finish(new Error(`服务器返回错误消息：${message.msg || '未知错误'}`));
        return;
      }

      if (hasRequiredMessages()) finish();
    });

    ws.once('error', finish);
    ws.once('close', code => {
      if (!settled) finish(new Error(`WebSocket在完成单机开局前关闭（code=${code}）`));
    });
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
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const getLogs = () => `stdout:\n${stdout}\nstderr:\n${stderr}`;

  try {
    await waitForServerPort(port, child, getLogs);
    const messages = await collectSoloGameMessages(`ws://127.0.0.1:${port}`);

    const joined = messages.find(message => message.type === 'room_joined');
    const started = messages.find(message => message.type === 'game_start');
    const hand = messages.find(message => message.type === 'your_hand');

    assert.match(joined.roomId || '', /^\d{6}$/, '单机房间号应为6位数字');
    assert.ok(joined.playerId, '加入房间消息必须包含玩家ID');
    assert.ok(joined.playerToken, '加入房间消息必须包含重连令牌');
    assert.strictEqual(started.state?.mode, 'solo', '单机开局状态必须标记为solo');
    assert.strictEqual(started.state?.status, 'playing', '单机房间应进入playing状态');
    assert.strictEqual(started.state?.players?.length, 4, '单机房间应包含真人和3名电脑玩家');
    assert.ok(Array.isArray(hand.hand) && hand.hand.length > 0, '真人玩家必须收到非空手牌');
    assert.strictEqual(child.exitCode, null, '完成WebSocket单机开局后服务器应继续运行');

    console.log('server-websocket-smoke tests passed');
  } catch (error) {
    error.message += `\n${getLogs()}`;
    throw error;
  } finally {
    await stopChild(child);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
