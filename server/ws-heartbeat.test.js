const assert = require('assert');
const { EventEmitter } = require('events');
const { startWebSocketHeartbeat } = require('./ws-heartbeat');

function makeSocket({ readyState = 1, isAlive = true, pingError = null } = {}) {
  const socket = new EventEmitter();
  socket.readyState = readyState;
  socket.isAlive = isAlive;
  socket.pingCount = 0;
  socket.terminateCount = 0;
  socket.ping = () => {
    socket.pingCount += 1;
    if (pingError) throw pingError;
  };
  socket.terminate = () => { socket.terminateCount += 1; };
  return socket;
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const WebSocket = { OPEN: 1 };
  const healthy = makeSocket();
  const dead = makeSocket({ isAlive: false });
  const closing = makeSocket({ readyState: 2 });
  const brokenPing = makeSocket({ pingError: new Error('ping failed') });
  const wss = new EventEmitter();
  wss.clients = new Set([healthy, dead, closing, brokenPing]);
  const errors = [];

  const heartbeat = startWebSocketHeartbeat(wss, WebSocket, {
    intervalMs: 10,
    onSocketError: (error, socket, phase) => errors.push({ error, socket, phase }),
  });

  await wait(16);
  heartbeat.stop();

  assert.strictEqual(healthy.pingCount, 1, '健康连接应收到一次 ping');
  assert.strictEqual(healthy.isAlive, false, '发送 ping 后应等待 pong');
  healthy.emit('pong');
  assert.strictEqual(healthy.isAlive, true, '收到 pong 后应恢复存活标记');
  assert.strictEqual(dead.terminateCount, 1, '失活连接应被终止');
  assert.strictEqual(closing.pingCount, 0, '非 OPEN 连接不应发送 ping');
  assert.strictEqual(brokenPing.terminateCount, 1, 'ping 抛错时应终止异常连接');
  assert.strictEqual(errors[0]?.phase, 'ping', '应记录 ping 阶段错误');

  const connected = makeSocket({ isAlive: false });
  wss.emit('connection', connected);
  assert.strictEqual(connected.isAlive, true, '新连接应初始化为存活');
  connected.isAlive = false;
  connected.emit('pong');
  assert.strictEqual(connected.isAlive, true, '新连接 pong 应更新存活状态');

  wss.emit('close');
  console.log('ws-heartbeat tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
