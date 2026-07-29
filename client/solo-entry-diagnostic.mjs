import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const target = process.env.MOBILE_AUDIT_URL || 'http://127.0.0.1:4173/pan/50k';
const caseName = (process.env.DIAGNOSTIC_CASE || 'default').replace(/[^a-zA-Z0-9_-]/g, '-');
const disabledEnhancers = process.env.DISABLE_ENHANCERS || '';
const outputDir = path.resolve('mobile-audit-artifacts');
const outputPath = path.join(outputDir, `solo-entry-${caseName}.json`);
const result = { target, caseName, disabledEnhancers, startedAt: new Date().toISOString(), webSockets: [], console: [], pageErrors: [], checkpoints: [] };

function checkpoint(name, detail = {}) {
  result.checkpoints.push({ name, at: new Date().toISOString(), ...detail });
  console.log(`[solo-entry:${caseName}] ${name}`);
}
function frameText(payload) {
  const text = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload ?? '');
  return text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
}
function timeoutAfter(ms, label) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}超过${ms}毫秒，页面主线程可能已卡死`)), ms));
}
async function safeEvaluate(page, fn, label = '读取页面状态', timeoutMs = 2500) {
  return Promise.race([page.evaluate(fn), timeoutAfter(timeoutMs, label)]);
}
async function persist() {
  result.finishedAt = new Date().toISOString();
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
}

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const watchdog = setTimeout(async () => {
  result.failure = { message: '单机诊断总时长超过55秒，已强制结束', watchdog: true };
  checkpoint('总超时强制落盘');
  try { await persist(); } finally { process.exit(2); }
}, 55_000);

const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36',
});
const page = await context.newPage();
page.on('console', message => { if (['error', 'warning'].includes(message.type())) result.console.push({ type: message.type(), text: message.text() }); });
page.on('pageerror', error => result.pageErrors.push(error.message));
page.on('websocket', socket => {
  const record = { url: socket.url(), openedAt: new Date().toISOString(), sent: [], received: [], errors: [], closedAt: null };
  result.webSockets.push(record);
  socket.on('framesent', event => record.sent.push({ at: new Date().toISOString(), payload: frameText(event.payload) }));
  socket.on('framereceived', event => record.received.push({ at: new Date().toISOString(), payload: frameText(event.payload) }));
  socket.on('socketerror', error => record.errors.push(String(error)));
  socket.on('close', () => { record.closedAt = new Date().toISOString(); });
});

let failure = null;
try {
  const url = new URL(target);
  url.searchParams.set('solo-entry', String(Date.now()));
  if (disabledEnhancers) url.searchParams.set('disable-enhancers', disabledEnhancers);
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('.lobby-shell', { timeout: 30_000 });
  checkpoint('大厅已显示', { connected: await page.locator('body').innerText().then(text => text.includes('游戏服务器已连接')) });
  await page.getByRole('button', { name: /单机练习/ }).click();
  await page.getByRole('button', { name: /三人单机/ }).waitFor({ state: 'visible', timeout: 10_000 });
  checkpoint('单机人数页已显示');
  await page.getByRole('button', { name: /三人单机/ }).click();
  checkpoint('已点击三人单机');

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const snapshot = await safeEvaluate(page, () => ({
      waitingRoom: Boolean(document.querySelector('.waiting-room-card')),
      rawGame: Boolean(document.querySelector('.btn-play')),
      tableHeader: Boolean(document.querySelector('.game-table-header')),
      tableShell: Boolean(document.querySelector('.game-table-shell')),
      hand: Boolean(document.querySelector('[data-card-id]')),
      connected: globalThis.__henan50kConnected === true,
      body: (document.body?.innerText || '').slice(0, 800),
    }), '读取单机页面状态');
    checkpoint('页面状态', snapshot);
    if (snapshot.tableShell && snapshot.hand) break;
    await page.waitForTimeout(500);
  }

  const finalState = await safeEvaluate(page, () => ({
    waitingRoom: Boolean(document.querySelector('.waiting-room-card')),
    rawGame: Boolean(document.querySelector('.btn-play')),
    tableHeader: Boolean(document.querySelector('.game-table-header')),
    tableShell: Boolean(document.querySelector('.game-table-shell')),
    hand: Boolean(document.querySelector('[data-card-id]')),
    connected: globalThis.__henan50kConnected === true,
    body: (document.body?.innerText || '').slice(0, 1600),
    html: document.documentElement.outerHTML.slice(0, 6000),
  }), '读取单机最终状态');
  result.finalState = finalState;
  if (!finalState.tableShell || !finalState.hand) throw new Error('三人单机未在30秒内进入可操作牌桌');
  checkpoint('三人单机牌桌可操作');
} catch (error) {
  failure = { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : '' };
  result.failure = failure;
  try {
    result.failureSnapshot = await safeEvaluate(page, () => ({
      url: location.href,
      connected: globalThis.__henan50kConnected === true,
      body: (document.body?.innerText || '').slice(0, 2000),
      html: document.documentElement.outerHTML.slice(0, 8000),
    }), '读取失败页面快照');
  } catch (snapshotError) {
    result.failureSnapshotError = snapshotError instanceof Error ? snapshotError.message : String(snapshotError);
  }
} finally {
  clearTimeout(watchdog);
  try { await Promise.race([page.screenshot({ path: path.join(outputDir, `solo-entry-${caseName}.png`), fullPage: true }), timeoutAfter(3500, '保存失败截图')]); } catch {}
  await persist();
  await Promise.race([browser.close(), timeoutAfter(3500, '关闭浏览器')]).catch(() => {});
}

if (failure) throw new Error(failure.message);
console.log(`solo entry diagnostic passed: ${caseName}`);
