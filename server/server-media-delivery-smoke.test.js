const assert = require('assert');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const START_TIMEOUT_MS = 12_000;
const POLL_INTERVAL_MS = 150;
const AUDIO_PATH = '/audio/langaishou-v2.mp3';

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
        else if (!port) reject(new Error('无法分配媒体冒烟测试端口'));
        else resolve(port);
      });
    });
  });
}

function request(port, requestPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      host: '127.0.0.1',
      port,
      path: requestPath,
      timeout: 2_000,
      headers: { Connection: 'close', ...headers },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
    });
    req.once('timeout', () => req.destroy(new Error(`请求超时：${requestPath}`)));
    req.once('error', reject);
  });
}

async function waitForHealth(port, child, getLogs) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let lastError = null;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`服务器在媒体检查前退出（code=${child.exitCode}）\n${getLogs()}`);
    }

    try {
      const response = await request(port, '/healthz');
      if (response.statusCode === 200) return;
      lastError = new Error(`健康检查返回${response.statusCode}`);
    } catch (error) {
      lastError = error;
    }
    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(`服务器未在${START_TIMEOUT_MS}ms内启动：${lastError?.message || '未知错误'}\n${getLogs()}`);
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
  const builtAudio = path.join(__dirname, '../client/dist/audio/langaishou-v2.mp3');
  const stat = fs.statSync(builtAudio);
  assert.ok(stat.isFile(), '生产构建必须生成独立音频文件');
  assert.ok(stat.size > 1_024, '音频文件不应为空或异常过小');

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
    await waitForHealth(port, child, getLogs);

    const partial = await request(port, AUDIO_PATH, { Range: 'bytes=0-15' });
    assert.strictEqual(partial.statusCode, 206, '音频范围请求必须返回206');
    assert.strictEqual(partial.body.length, 16, '范围请求必须只返回指定字节');
    assert.strictEqual(partial.headers['accept-ranges'], 'bytes', '音频必须声明支持字节范围');
    assert.match(partial.headers['content-range'] || '', /^bytes 0-15\/\d+$/, '范围响应必须返回正确Content-Range');
    assert.match(partial.headers['content-type'] || '', /^audio\/mpeg/, 'MP3必须返回audio/mpeg内容类型');
    assert.strictEqual(partial.headers['cache-control'], 'public, max-age=31536000, immutable');
    assert.strictEqual(partial.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(partial.headers['cross-origin-resource-policy'], 'same-origin');

    const full = await request(port, AUDIO_PATH);
    assert.strictEqual(full.statusCode, 200, '完整音频请求必须返回200');
    assert.strictEqual(full.body.length, stat.size, '完整响应字节数必须与构建文件一致');
    assert.strictEqual(child.exitCode, null, '媒体请求完成后服务器应继续运行');

    console.log('server-media-delivery-smoke tests passed');
  } finally {
    await stopChild(child);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});