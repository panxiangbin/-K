import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const target = process.env.MOBILE_AUDIT_URL || 'http://127.0.0.1:4173/pan/50k';
const outputDir = path.resolve('mobile-audit-artifacts');
const result = {
  target,
  startedAt: new Date().toISOString(),
  webSockets: [],
  console: [],
  pageErrors: [],
  checkpoints: [],
};

function checkpoint(name, detail = {}) {
  result.checkpoints.push({ name, at: new Date().toISOString(), ...detail });
  console.log(`[solo-entry] ${name}`);
}

function frameText(payload) {
  const text = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload ?? '');
  return text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
}

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36',
});
const page = await context.newPage();

page.on('console', message => {
  if (['error', 'warning'].includes(message.type())) result.console.push({ type: message.type(), text: message.text() });
});
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
  await page.goto(`${target}/?solo-entry=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('.lobby-shell', { timeout: 30_000 });
  checkpoint('大厅已显示', { connected: await page.locator('body').innerText().then(text => text.includes('游戏服务器已连接')) });

  await page.getByRole('button', { name: /单机练习/ }).click();
  await page.getByRole('button', { name: /三人单机/ }).waitFor({ state: 'visible', timeout: 10_000 });
  checkpoint('单机人数页已显示');
  await page.getByRole('button', { name: /三人单机/ }).click();
  checkpoint('已点击三人单机');

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const snapshot = await page.evaluate(() => ({
      waitingRoom: Boolean(document.querySelector('.waiting-room-card')),
      rawGame: Boolean(document.querySelector('.btn-play')),
      tableHeader: Boolean(document.querySelector('.game-table-header')),
      tableShell: Boolean(document.querySelector('.game-table-shell')),
      hand: Boolean(document.querySelector('[data-card-id]')),
      connected: globalThis.__henan50kConnected === true,
      body: (document.body?.innerText || '').slice(0, 800),
    }));
    checkpoint('页面状态', snapshot);
    if (snapshot.tableShell && snapshot.hand) break;
    await page.waitForTimeout(500);
  }

  const finalState = await page.evaluate(() => ({
    waitingRoom: Boolean(document.querySelector('.waiting-room-card')),
    rawGame: Boolean(document.querySelector('.btn-play')),
    tableHeader: Boolean(document.querySelector('.game-table-header')),
    tableShell: Boolean(document.querySelector('.game-table-shell')),
    hand: Boolean(document.querySelector('[data-card-id]')),
    connected: globalThis.__henan50kConnected === true,
    body: (document.body?.innerText || '').slice(0, 1600),
    html: document.documentElement.outerHTML.slice(0, 6000),
  }));
  result.finalState = finalState;
  if (!finalState.tableShell || !finalState.hand) throw new Error('三人单机未在30秒内进入可操作牌桌');
  checkpoint('三人单机牌桌可操作');
} catch (error) {
  failure = { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : '' };
  result.failure = failure;
  try {
    result.failureSnapshot = await page.evaluate(() => ({
      url: location.href,
      connected: globalThis.__henan50kConnected === true,
      body: (document.body?.innerText || '').slice(0, 2000),
      html: document.documentElement.outerHTML.slice(0, 8000),
    }));
  } catch {}
} finally {
  try { await page.screenshot({ path: path.join(outputDir, 'solo-entry-final.png'), fullPage: true }); } catch {}
  result.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(outputDir, 'solo-entry-diagnostic.json'), JSON.stringify(result, null, 2));
  await browser.close();
}

if (failure) throw new Error(failure.message);
console.log('solo entry diagnostic passed');
