import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const target = process.env.PUBLIC_GAME_URL || 'https://panxiangbin.github.io/pan/50k';
const expectedRelease = process.env.EXPECTED_UI_RELEASE || 'ink-06-mobile-r4';
const outputDir = path.resolve('public-websocket-stability-artifacts');
const stableWindowMs = Number(process.env.WEBSOCKET_STABLE_WINDOW_MS || 8000);

const profiles = [
  { name: 'iphone-390x844', width: 390, height: 844 },
  { name: 'android-430x932', width: 430, height: 932 },
  { name: 'short-phone-390x700', width: 390, height: 700 },
  { name: 'phone-landscape-844x390', width: 844, height: 390 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function visibleConnectionSnapshot() {
  const visibleText = selector => [...document.querySelectorAll(selector)]
    .filter(node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    })
    .map(node => (node.textContent || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return {
    connected: globalThis.__henan50kConnected === true,
    connectionStatus: visibleText('#henan50k-connection-status'),
    actionStatus: visibleText('#henan50k-game-action-status'),
    recoveryText: visibleText('[data-status-channel="recovery"]'),
  };
}

function hasConnectionWarning(snapshot) {
  const text = [
    ...(snapshot.connectionStatus || []),
    ...(snapshot.actionStatus || []),
    ...(snapshot.recoveryText || []),
  ].join(' ');
  return /网络连接已中断|正在重新连接|正在恢复连接|服务器正在启动|连接没有成功|当前网络已断开/.test(text);
}

async function enterSoloGame(page) {
  await page.goto(`${target}/?ws-stability=${Date.now()}-${Math.random().toString(16).slice(2)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForSelector('.lobby-shell', { timeout: 30_000 });
  await page.waitForFunction(release => document.documentElement.dataset.uiRelease === release, expectedRelease, { timeout: 120_000 });
  await page.getByRole('button', { name: /单机练习/ }).click();
  await page.getByRole('button', { name: /三人单机/ }).click();
  await page.waitForSelector('.game-table-shell', { timeout: 90_000 });
  await page.waitForSelector('[data-card-id]', { timeout: 30_000 });
}

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];
let failure = null;

try {
  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36',
    });
    const page = await context.newPage();
    const sockets = [];
    const pageErrors = [];
    const requestFailures = [];

    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('requestfailed', request => requestFailures.push({
      url: request.url(),
      failure: request.failure()?.errorText || 'unknown',
    }));
    page.on('websocket', socket => {
      const entry = {
        url: socket.url(),
        createdAt: Date.now(),
        closedAt: null,
        socketErrors: [],
        sentFrames: 0,
        receivedFrames: 0,
      };
      sockets.push(entry);
      socket.on('framesent', () => { entry.sentFrames += 1; });
      socket.on('framereceived', () => { entry.receivedFrames += 1; });
      socket.on('socketerror', error => { entry.socketErrors.push(String(error || 'unknown')); });
      socket.on('close', () => { entry.closedAt = Date.now(); });
    });

    try {
      await enterSoloGame(page);
      const gameStartedAt = Date.now();
      await page.waitForFunction(() => {
        const snapshot = (() => {
          const visibleText = selector => [...document.querySelectorAll(selector)]
            .filter(node => {
              const style = getComputedStyle(node);
              const rect = node.getBoundingClientRect();
              return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
            })
            .map(node => (node.textContent || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
          return {
            connected: globalThis.__henan50kConnected === true,
            text: [
              ...visibleText('#henan50k-connection-status'),
              ...visibleText('#henan50k-game-action-status'),
              ...visibleText('[data-status-channel="recovery"]'),
            ].join(' '),
          };
        })();
        return snapshot.connected && !/网络连接已中断|正在重新连接|正在恢复连接|服务器正在启动|连接没有成功|当前网络已断开/.test(snapshot.text);
      }, null, { timeout: 30_000 });

      const samples = [];
      const deadline = Date.now() + stableWindowMs;
      while (Date.now() < deadline) {
        const snapshot = await page.evaluate(visibleConnectionSnapshot);
        samples.push({ at: Date.now(), ...snapshot });
        assert(snapshot.connected, `${profile.name}: 稳定性观察期间连接状态变为断开`);
        assert(!hasConnectionWarning(snapshot), `${profile.name}: 稳定性观察期间出现连接警告：${JSON.stringify(snapshot)}`);
        await page.waitForTimeout(250);
      }

      const remoteSockets = sockets.filter(socket => socket.url.includes('henan-50k.onrender.com'));
      const closedAfterGameStart = remoteSockets.filter(socket => socket.closedAt && socket.closedAt >= gameStartedAt);
      const openRemoteSockets = remoteSockets.filter(socket => !socket.closedAt);
      const totalReceivedFrames = remoteSockets.reduce((sum, socket) => sum + socket.receivedFrames, 0);
      const socketErrors = remoteSockets.flatMap(socket => socket.socketErrors);

      assert(remoteSockets.length >= 1, `${profile.name}: 没有建立 Render WebSocket`);
      assert(closedAfterGameStart.length === 0, `${profile.name}: 进入牌桌后 WebSocket 被关闭：${JSON.stringify(closedAfterGameStart)}`);
      assert(openRemoteSockets.length >= 1, `${profile.name}: 稳定性观察结束时没有打开的 Render WebSocket`);
      assert(totalReceivedFrames >= 4, `${profile.name}: 真实服务器帧不足，只有 ${totalReceivedFrames} 条`);
      assert(socketErrors.length === 0, `${profile.name}: WebSocket 报错：${socketErrors.join('；')}`);
      assert(pageErrors.length === 0, `${profile.name}: 页面错误：${pageErrors.join('；')}`);
      assert(requestFailures.length === 0, `${profile.name}: 请求失败：${JSON.stringify(requestFailures)}`);

      await page.screenshot({
        path: path.join(outputDir, `${profile.name}-stable.png`),
        fullPage: true,
      });
      report.push({
        ...profile,
        gameStartedAt,
        stableWindowMs,
        sockets,
        pageErrors,
        requestFailures,
        samples,
        finalSnapshot: samples.at(-1),
      });
    } finally {
      await context.close();
    }
  }
} catch (error) {
  failure = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : '',
    at: new Date().toISOString(),
  };
  throw error;
} finally {
  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  if (failure) await fs.writeFile(path.join(outputDir, 'failure.json'), JSON.stringify(failure, null, 2));
  await browser.close();
}

console.log(`public WebSocket stability passed for ${profiles.length} profiles over ${stableWindowMs}ms each`);
