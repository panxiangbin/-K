const assert = require('assert');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const START_TIMEOUT_MS = 12_000;
const POLL_INTERVAL_MS = 150;

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
        else if (!port) reject(new Error('无法分配服务器冒烟测试端口'));
        else resolve(port);
      });
    });
  });
}

function requestHealth(port) {
  return new Promise((resolve, reject) => {
    const request = http.get({
      host: '127.0.0.1',
      port,
      path: '/healthz',
      timeout: 1_500,
      headers: { Connection: 'close' },
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        body,
      }));
    });
    request.once('timeout', () => request.destroy(new Error('健康检查请求超时')));
    request.once('error', reject);
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForHealth(port, child, getLogs) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let lastError = null;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`服务器在健康检查前退出（code=${child.exitCode}）\n${getLogs()}`);
    }

    try {
      return await requestHealth(port);
    } catch (error) {
      lastError = error;
      await delay(POLL_INTERVAL_MS);
    }
  }

  throw new Error(`服务器未在${START_TIMEOUT_MS}ms内通过健康检查：${lastError?.message || '未知错误'}\n${getLogs()}`);
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
  const serverDir = __dirname;
  const child = spawn(process.execPath, ['-r', './bot-ai-hook.js', './index.js'], {
    cwd: serverDir,
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const getLogs = () => `stdout:\n${stdout}\nstderr:\n${stderr}`;

  try {
    const response = await waitForHealth(port, child, getLogs);
    assert.strictEqual(response.statusCode, 200, '健康检查必须返回200');
    assert.strictEqual(response.body, 'ok', '健康检查响应正文必须保持为ok');
    assert.match(response.headers['content-type'] || '', /^text\/plain/, '健康检查应返回纯文本');
    assert.strictEqual(response.headers['cache-control'], 'no-store', '健康检查不得被缓存');
    assert.strictEqual(child.exitCode, null, '健康检查成功后服务器应继续运行');
    assert.match(stdout, new RegExp(`端口 ${port}`), '启动日志应包含实际监听端口');
    console.log('server-startup-smoke tests passed');
  } finally {
    await stopChild(child);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
