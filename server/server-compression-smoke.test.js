const assert = require('assert');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');

const START_TIMEOUT_MS = 12_000;
const POLL_INTERVAL_MS = 150;

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

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
        else if (!port) reject(new Error('无法分配压缩冒烟测试端口'));
        else resolve(port);
      });
    });
  });
}

function request(port, requestPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      host: '127.0.0.1', port, path: requestPath, timeout: 2_000,
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
    if (child.exitCode !== null) throw new Error(`服务器提前退出（code=${child.exitCode}）\n${getLogs()}`);
    try {
      const response = await request(port, '/healthz');
      if (response.statusCode === 200) return;
      lastError = new Error(`健康检查返回${response.statusCode}`);
    } catch (error) { lastError = error; }
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error(`服务器未在${START_TIMEOUT_MS}ms内启动：${lastError?.message || '未知错误'}\n${getLogs()}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(1_500)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

function findEntryAsset(distDir) {
  const manifestPath = path.join(distDir, '.vite/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const entry = Object.values(manifest).find(item => item && item.isEntry && typeof item.file === 'string');
  if (!entry) throw new Error('Vite manifest中没有入口资源');
  return entry.file;
}

(async () => {
  const distDir = path.join(__dirname, '../client/dist');
  const entryFile = findEntryAsset(distDir);
  const builtAsset = path.join(distDir, entryFile);
  const original = fs.readFileSync(builtAsset);
  assert.ok(fs.existsSync(`${builtAsset}.br`), '入口JS必须生成Brotli版本');
  assert.ok(fs.existsSync(`${builtAsset}.gz`), '入口JS必须生成Gzip版本');

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
    const assetPath = `/${entryFile.replace(/\\/g, '/')}`;

    const br = await request(port, assetPath, { 'Accept-Encoding': 'gzip, br' });
    assert.strictEqual(br.statusCode, 200);
    assert.strictEqual(br.headers['content-encoding'], 'br');
    assert.match(br.headers.vary || '', /Accept-Encoding/i);
    assert.strictEqual(br.headers['cache-control'], 'public, max-age=31536000, immutable');
    assert.deepStrictEqual(zlib.brotliDecompressSync(br.body), original);

    const gzip = await request(port, assetPath, { 'Accept-Encoding': 'gzip' });
    assert.strictEqual(gzip.statusCode, 200);
    assert.strictEqual(gzip.headers['content-encoding'], 'gzip');
    assert.deepStrictEqual(zlib.gunzipSync(gzip.body), original);

    const identity = await request(port, assetPath, { 'Accept-Encoding': 'identity' });
    assert.strictEqual(identity.statusCode, 200);
    assert.strictEqual(identity.headers['content-encoding'], undefined);
    assert.deepStrictEqual(identity.body, original);

    const audio = await request(port, '/audio/langaishou-v2.mp3', { 'Accept-Encoding': 'br, gzip' });
    assert.strictEqual(audio.statusCode, 200);
    assert.strictEqual(audio.headers['content-encoding'], undefined, 'MP3不应重复压缩');
    assert.strictEqual(child.exitCode, null);
    console.log('server-compression-smoke tests passed');
  } finally {
    await stopChild(child);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
