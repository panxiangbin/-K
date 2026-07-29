import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const target = process.env.LANDSCAPE_AUDIT_URL || 'http://127.0.0.1:4173/pan/50k';
const expectedRelease = process.env.EXPECTED_UI_RELEASE || 'ink-06-mobile-r4';
const outputDir = path.resolve('landscape-audit-artifacts');

const profiles = [
  { name: 'phone-portrait-390x844', width: 390, height: 844, mode: 'gate' },
  { name: 'tablet-portrait-820x1180', width: 820, height: 1180, mode: 'gate' },
  { name: 'phone-landscape-844x390', width: 844, height: 390, mode: 'game' },
  { name: 'large-phone-landscape-932x430', width: 932, height: 430, mode: 'game' },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openRelease(page, profile) {
  await page.goto(`${target}/?landscape-audit=${Date.now()}-${Math.random().toString(16).slice(2)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForSelector('.lobby-shell', { state: 'attached', timeout: 60_000 });
  await page.waitForFunction(release => document.documentElement.dataset.uiRelease === release, expectedRelease, { timeout: 60_000 });
  await page.waitForFunction(() => document.documentElement.dataset.layoutMode === 'landscape-r1', null, { timeout: 30_000 });
  if (profile.mode === 'gate') {
    await page.waitForSelector('#henan50k-landscape-gate:not([hidden])', { state: 'visible', timeout: 20_000 });
  } else {
    await page.waitForFunction(() => {
      const gate = document.getElementById('henan50k-landscape-gate');
      return !document.body.classList.contains('landscape-gate-active') && (!gate || gate.hidden);
    }, null, { timeout: 20_000 });
  }
}

async function auditPortraitGate(page, profile) {
  const metrics = await page.evaluate(() => {
    const gate = document.getElementById('henan50k-landscape-gate');
    const root = document.getElementById('root');
    const button = document.getElementById('henan50k-enter-landscape');
    const gateRect = gate?.getBoundingClientRect();
    const buttonRect = button?.getBoundingClientRect();
    return {
      layoutMode: document.documentElement.dataset.layoutMode || '',
      bodyActive: document.body.classList.contains('landscape-gate-active'),
      gateHidden: gate?.hidden,
      gateText: gate?.textContent?.replace(/\s+/g, ' ').trim() || '',
      gateRect: gateRect ? { width: gateRect.width, height: gateRect.height, left: gateRect.left, top: gateRect.top } : null,
      rootVisibility: root ? getComputedStyle(root).visibility : '',
      rootPointerEvents: root ? getComputedStyle(root).pointerEvents : '',
      button: buttonRect ? { width: buttonRect.width, height: buttonRect.height } : null,
      viewport: { width: innerWidth, height: innerHeight },
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  assert(metrics.layoutMode === 'landscape-r1', `${profile.name}: 横屏版本标记缺失`);
  assert(metrics.bodyActive, `${profile.name}: 竖屏没有激活横屏提示`);
  assert(metrics.gateHidden === false, `${profile.name}: 横屏提示被隐藏`);
  assert(metrics.gateText.includes('请横屏使用'), `${profile.name}: 没有明确提示横屏`);
  assert(metrics.gateText.includes('进入横屏游戏'), `${profile.name}: 没有横屏入口按钮`);
  assert(metrics.rootVisibility === 'hidden', `${profile.name}: 竖版大厅仍在提示层后显示`);
  assert(metrics.rootPointerEvents === 'none', `${profile.name}: 竖版大厅仍可误触`);
  assert(metrics.gateRect?.width >= metrics.viewport.width - 2, `${profile.name}: 横屏提示没有覆盖整个屏幕`);
  assert(metrics.gateRect?.height >= metrics.viewport.height - 2, `${profile.name}: 横屏提示没有覆盖整个屏幕高度`);
  assert(metrics.button?.height >= 48, `${profile.name}: 横屏按钮触控高度不足`);
  assert(metrics.documentOverflow <= 2, `${profile.name}: 横屏提示页面横向溢出`);
  return metrics;
}

async function enterSoloGame(page) {
  await page.getByRole('button', { name: /单机练习/ }).click();
  await page.getByRole('button', { name: /三人单机/ }).click();
  await page.waitForSelector('.game-table-shell', { timeout: 120_000 });
  await page.waitForSelector('[data-card-id]', { timeout: 30_000 });
  await page.waitForTimeout(500);
}

async function auditLandscapeGame(page, profile) {
  await enterSoloGame(page);
  const metrics = await page.evaluate(() => {
    const rect = selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const value = node.getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    };
    const actions = [...document.querySelectorAll('.game-hand-actions button')].map(button => {
      const value = button.getBoundingClientRect();
      return {
        text: button.textContent?.trim() || '',
        left: value.left,
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        width: value.width,
        height: value.height,
      };
    });
    const gate = document.getElementById('henan50k-landscape-gate');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      layoutMode: document.documentElement.dataset.layoutMode || '',
      gateHidden: !gate || gate.hidden,
      bodyActive: document.body.classList.contains('landscape-gate-active'),
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      shell: rect('.game-table-shell'),
      stage: rect('.game-table-stage'),
      dock: rect('.game-table-hand-dock'),
      cardCount: document.querySelectorAll('[data-card-id]').length,
      actions,
    };
  });

  assert(metrics.layoutMode === 'landscape-r1', `${profile.name}: 横屏版本标记缺失`);
  assert(metrics.gateHidden && !metrics.bodyActive, `${profile.name}: 横屏时旋转提示没有消失`);
  assert(metrics.viewport.width > metrics.viewport.height, `${profile.name}: 视口不是横屏`);
  assert(metrics.documentOverflow <= 2, `${profile.name}: 横屏页面溢出 ${metrics.documentOverflow}px`);
  assert(metrics.shell && metrics.stage && metrics.dock, `${profile.name}: 横屏牌桌结构不完整`);
  assert(metrics.shell.width >= metrics.viewport.width - 2, `${profile.name}: 牌桌没有铺满横屏宽度`);
  assert(metrics.shell.height >= metrics.viewport.height - 2, `${profile.name}: 牌桌没有铺满横屏高度`);
  assert(metrics.shell.right <= metrics.viewport.width + 2 && metrics.shell.bottom <= metrics.viewport.height + 2, `${profile.name}: 牌桌超出横屏视口`);
  assert(metrics.stage.bottom <= metrics.dock.top + 2, `${profile.name}: 横屏牌桌与手牌操作区重叠`);
  assert(metrics.cardCount > 0, `${profile.name}: 横屏没有手牌`);
  assert(metrics.actions.length >= 5, `${profile.name}: 横屏操作按钮不足5个`);
  for (const action of metrics.actions) {
    assert(action.left >= -1 && action.right <= metrics.viewport.width + 1, `${profile.name}: “${action.text}”横向越界`);
    assert(action.top >= -1 && action.bottom <= metrics.viewport.height + 1, `${profile.name}: “${action.text}”纵向越界`);
    assert(action.height >= 38, `${profile.name}: “${action.text}”按钮高度不足`);
  }

  const targetCard = page.locator('[data-card-id]').last();
  const cardId = await targetCard.getAttribute('data-card-id');
  await targetCard.scrollIntoViewIfNeeded();
  await targetCard.click();
  await page.waitForFunction(id => {
    const card = [...document.querySelectorAll('[data-card-id]')].find(node => node.dataset.cardId === id);
    return card?.getAttribute('aria-pressed') === 'true';
  }, cardId, { timeout: 10_000 });

  return { ...metrics, selectedCardId: cardId };
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
    const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
    page.on('console', message => {
      if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
    });
    page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
    page.on('requestfailed', request => diagnostics.requestFailures.push({ url: request.url(), failure: request.failure()?.errorText || 'unknown' }));
    page.on('response', response => {
      if (response.status() >= 400) diagnostics.httpErrors.push({ url: response.url(), status: response.status() });
    });

    try {
      await openRelease(page, profile);
      const metrics = profile.mode === 'gate'
        ? await auditPortraitGate(page, profile)
        : await auditLandscapeGame(page, profile);
      await page.screenshot({ path: path.join(outputDir, `${profile.name}.png`), fullPage: true });
      assert(diagnostics.consoleErrors.length === 0, `${profile.name}: 控制台错误 ${diagnostics.consoleErrors.join('；')}`);
      assert(diagnostics.pageErrors.length === 0, `${profile.name}: 页面错误 ${diagnostics.pageErrors.join('；')}`);
      assert(diagnostics.requestFailures.length === 0, `${profile.name}: 请求失败 ${JSON.stringify(diagnostics.requestFailures)}`);
      assert(diagnostics.httpErrors.length === 0, `${profile.name}: HTTP错误 ${JSON.stringify(diagnostics.httpErrors)}`);
      report.push({ ...profile, metrics, diagnostics });
    } finally {
      await context.close();
    }
  }
} catch (error) {
  failure = { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : '', at: new Date().toISOString() };
  throw error;
} finally {
  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  if (failure) await fs.writeFile(path.join(outputDir, 'failure.json'), JSON.stringify(failure, null, 2));
  await browser.close();
}

console.log('landscape live audit passed: portrait gate + two real landscape tables');
