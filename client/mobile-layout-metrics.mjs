import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const target = process.env.MOBILE_AUDIT_URL || 'http://127.0.0.1:4173/pan/50k';
const outputDir = path.resolve('mobile-audit-artifacts');
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
const diagnostics = { console: [], pageErrors: [], requestFailures: [] };
page.on('console', message => {
  if (message.type() === 'error' || message.type() === 'warning') diagnostics.console.push({ type: message.type(), text: message.text() });
});
page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
page.on('requestfailed', request => diagnostics.requestFailures.push({ url: request.url(), error: request.failure()?.errorText || '' }));

let result;
try {
  await page.goto(`${target}/?layout-metrics=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('.lobby-shell', { timeout: 30_000 });
  await page.getByRole('button', { name: /单机练习/ }).click();
  await page.getByRole('button', { name: /三人单机/ }).click();
  await page.waitForSelector('.game-table-shell', { timeout: 30_000 });
  await page.waitForSelector('[data-card-id]', { timeout: 20_000 });
  await page.waitForTimeout(600);

  result = await page.evaluate(() => {
    const rect = node => {
      if (!node) return null;
      const value = node.getBoundingClientRect();
      return {
        left: value.left,
        right: value.right,
        top: value.top,
        bottom: value.bottom,
        width: value.width,
        height: value.height,
      };
    };
    const describe = node => {
      if (!node) return null;
      const style = getComputedStyle(node);
      return {
        tag: node.tagName,
        className: node.className || '',
        id: node.id || '',
        text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
        rect: rect(node),
        display: style.display,
        position: style.position,
        overflow: `${style.overflowX}/${style.overflowY}`,
        minHeight: style.minHeight,
        maxHeight: style.maxHeight,
        gridRow: style.gridRow,
      };
    };

    const shell = document.querySelector('.game-table-shell');
    const stage = document.querySelector('.game-table-stage');
    const dock = document.querySelector('.game-table-hand-dock');
    const hand = document.querySelector('.game-hand-surface[data-hand-interaction="true"]');
    const actions = document.querySelector('.game-hand-actions');
    return {
      viewport: { innerWidth, innerHeight, visualWidth: visualViewport?.width || null, visualHeight: visualViewport?.height || null },
      document: {
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        bodyScrollHeight: document.body.scrollHeight,
      },
      shell: describe(shell),
      shellChildren: [...(shell?.children || [])].map(describe),
      stage: describe(stage),
      dock: describe(dock),
      dockChildren: [...(dock?.children || [])].map(describe),
      hand: {
        ...describe(hand),
        clientWidth: hand?.clientWidth || 0,
        scrollWidth: hand?.scrollWidth || 0,
        scrollLeft: hand?.scrollLeft || 0,
        touchAction: hand ? getComputedStyle(hand).touchAction : '',
      },
      actionContainer: describe(actions),
      actionButtons: [...(actions?.querySelectorAll('button') || [])].map(describe),
      release: document.documentElement.dataset.uiRelease || '',
      connected: globalThis.__henan50kConnected === true,
    };
  });
} catch (error) {
  result = { failure: error instanceof Error ? error.message : String(error) };
} finally {
  try { await page.screenshot({ path: path.join(outputDir, 'mobile-layout-metrics.png'), fullPage: true }); } catch {}
  await fs.writeFile(path.join(outputDir, 'mobile-layout-metrics.json'), JSON.stringify({ ...result, diagnostics }, null, 2));
  await browser.close();
}

if (result?.failure) throw new Error(result.failure);
console.log('mobile layout metrics captured');
