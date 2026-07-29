import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const target = process.env.PUBLIC_GAME_URL || 'https://panxiangbin.github.io/pan/50k';
const outputDir = path.resolve('public-landscape-r2-stability-artifacts');
const stableWindowMs = Number(process.env.WEBSOCKET_STABLE_WINDOW_MS || 8000);
const profiles = [
  { name: 'phone-landscape-844x390', width: 844, height: 390 },
  { name: 'large-phone-landscape-932x430', width: 932, height: 430 },
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
    presentation: document.documentElement.dataset.landscapePresentation || '',
    layoutMode: document.documentElement.dataset.layoutMode || '',
    connectionStatus: visibleText('#henan50k-connection-status'),
    actionStatus: visibleText('#henan50k-game-action-status'),
    recoveryText: visibleText('[data-status-channel="recovery"]'),
  };
}

function warningText(snapshot) {
  return [
    ...(snapshot.connectionStatus || []),
    ...(snapshot.actionStatus || []),
    ...(snapshot.recoveryText || []),
  ].join(' ');
}

function hasWarning(snapshot) {
  return /网络连接已中断|正在重新连接|正在恢复连接|服务器正在启动|连接没有成功|当前网络已断开/.test(warningText(snapshot));
}

async function enterSoloGame(page, profile) {
  await page.goto(`${target}/?public-landscape-r2=${Date.now()}-${profile.name}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForSelector('.lobby-shell', { state: 'visible', timeout: 60_000 });
  await page.waitForFunction(() => {
    return document.documentElement.dataset.layoutMode === 'landscape-r2'
      && document.documentElement.dataset.landscapePresentation === 'native';
  }, null, { timeout: 120_000 });
  await page.getByRole('button', { name: /单机练习/ }).click();
  await page.getByRole('button', { name: /三人单机/ }).click();
  await page.waitForSelector('.game-table-shell', { timeout: 120_000 });
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
    const consoleErrors = [];
    const pageErrors = [];
    const requestFailures = [];
    const httpErrors = [];

    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('requestfailed', request => requestFailures.push({
      url: request.url(),
      failure: request.failure()?.errorText || 'unknown',
    }));
    page.on('response', response => {
      if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
    });
    page.on('websocket', socket => {
      const entry = {
        url: socket.url(),
        createdAt: Date.now(),
        closedAt: null,
        errors: [],
        sentFrames: 0,
        receivedFrames: 0,
      };
      sockets.push(entry);
      socket.on('framesent', () => { entry.sentFrames += 1; });
      socket.on('framereceived', () => { entry.receivedFrames += 1; });
      socket.on('socketerror', error => { entry.errors.push(String(error || 'unknown')); });
      socket.on('close', () => { entry.closedAt = Date.now(); });
    });

    try {
      await enterSoloGame(page, profile);
      const gameStartedAt = Date.now();
      await page.waitForFunction(() => {
        const text = document.body?.textContent || '';
        return globalThis.__henan50kConnected === true
          && !/网络连接已中断|正在重新连接|正在恢复连接|服务器正在启动|连接没有成功|当前网络已断开/.test(text);
      }, null, { timeout: 45_000 });

      const samples = [];
      const deadline = Date.now() + stableWindowMs;
      while (Date.now() < deadline) {
        const snapshot = await page.evaluate(visibleConnectionSnapshot);
        samples.push({ at: Date.now(), ...snapshot });
        assert(snapshot.layoutMode === 'landscape-r2', `${profile.name}: 线上版本不是 landscape-r2`);
        assert(snapshot.presentation === 'native', `${profile.name}: 横屏时没有保持原生横屏`);
        assert(snapshot.connected, `${profile.name}: 稳定观察期间连接断开`);
        assert(!hasWarning(snapshot), `${profile.name}: 稳定观察期间出现连接警告：${warningText(snapshot)}`);
        await page.waitForTimeout(250);
      }

      const remoteSockets = sockets.filter(socket => socket.url.includes('henan-50k.onrender.com'));
      const closedAfterStart = remoteSockets.filter(socket => socket.closedAt && socket.closedAt >= gameStartedAt);
      const openSockets = remoteSockets.filter(socket => !socket.closedAt);
      const receivedFrames = remoteSockets.reduce((sum, socket) => sum + socket.receivedFrames, 0);
      const socketErrors = remoteSockets.flatMap(socket => socket.errors);

      assert(remoteSockets.length >= 1, `${profile.name}: 没有连接真实 Render WebSocket`);
      assert(closedAfterStart.length === 0, `${profile.name}: 进入牌桌后 WebSocket 被关闭`);
      assert(openSockets.length >= 1, `${profile.name}: 观察结束时没有打开的 Render WebSocket`);
      assert(receivedFrames >= 4, `${profile.name}: 真实服务器帧不足，只有 ${receivedFrames} 条`);
      assert(socketErrors.length === 0, `${profile.name}: WebSocket 错误：${socketErrors.join('；')}`);
      assert(consoleErrors.length === 0, `${profile.name}: 控制台错误：${consoleErrors.join('；')}`);
      assert(pageErrors.length === 0, `${profile.name}: 页面错误：${pageErrors.join('；')}`);
      assert(requestFailures.length === 0, `${profile.name}: 请求失败：${JSON.stringify(requestFailures)}`);
      assert(httpErrors.length === 0, `${profile.name}: HTTP错误：${JSON.stringify(httpErrors)}`);

      await page.screenshot({
        path: path.join(outputDir, `${profile.name}-stable.png`),
        fullPage: false,
      });
      report.push({
        ...profile,
        stableWindowMs,
        gameStartedAt,
        sockets,
        consoleErrors,
        pageErrors,
        requestFailures,
        httpErrors,
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

console.log(`public landscape-r2 WebSocket stability passed for ${profiles.length} profiles over ${stableWindowMs}ms each`);