import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium, webkit } from 'playwright';

const target = process.env.LANDSCAPE_AUDIT_URL || 'http://127.0.0.1:4173/pan/50k';
const expectedRelease = process.env.EXPECTED_UI_RELEASE || 'ink-06-mobile-r4';
const outputDir = path.resolve('landscape-audit-artifacts');

const engines = [
  {
    name: 'chromium-android',
    launcher: chromium,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36',
  },
  {
    name: 'webkit-iphone',
    launcher: webkit,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function attachDiagnostics(page) {
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on('console', message => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', request => diagnostics.requestFailures.push({ url: request.url(), failure: request.failure()?.errorText || 'unknown' }));
  page.on('response', response => {
    if (response.status() >= 400) diagnostics.httpErrors.push({ url: response.url(), status: response.status() });
  });
  return diagnostics;
}

async function openRelease(page) {
  await page.goto(`${target}/?landscape-r2-audit=${Date.now()}-${Math.random().toString(16).slice(2)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForSelector('.lobby-shell', { state: 'attached', timeout: 60_000 });
  await page.waitForFunction(release => document.documentElement.dataset.uiRelease === release, expectedRelease, { timeout: 60_000 });
  await page.waitForFunction(() => document.documentElement.dataset.layoutMode === 'landscape-r2', null, { timeout: 30_000 });
  await page.waitForSelector('#henan50k-landscape-gate:not([hidden])', { state: 'visible', timeout: 20_000 });
}

async function auditGate(page, label) {
  const metrics = await page.evaluate(() => {
    const gate = document.getElementById('henan50k-landscape-gate');
    const root = document.getElementById('root');
    const button = document.getElementById('henan50k-enter-landscape');
    const gateRect = gate?.getBoundingClientRect();
    const buttonRect = button?.getBoundingClientRect();
    return {
      layoutMode: document.documentElement.dataset.layoutMode || '',
      presentation: document.documentElement.dataset.landscapePresentation || '',
      gateActive: document.body.classList.contains('landscape-gate-active'),
      forcedActive: document.body.classList.contains('force-landscape-active'),
      gateHidden: gate?.hidden,
      gateText: gate?.textContent?.replace(/\s+/g, ' ').trim() || '',
      gateRect: gateRect ? { width: gateRect.width, height: gateRect.height } : null,
      rootVisibility: root ? getComputedStyle(root).visibility : '',
      rootPointerEvents: root ? getComputedStyle(root).pointerEvents : '',
      button: buttonRect ? { width: buttonRect.width, height: buttonRect.height } : null,
      viewport: { width: innerWidth, height: innerHeight },
    };
  });

  assert(metrics.layoutMode === 'landscape-r2', `${label}: 新横屏版本标记缺失`);
  assert(metrics.presentation === 'gate', `${label}: 竖屏没有进入横屏入口状态`);
  assert(metrics.gateActive && !metrics.forcedActive, `${label}: 竖屏入口类名错误`);
  assert(metrics.gateHidden === false, `${label}: 横屏入口被隐藏`);
  assert(metrics.gateText.includes('请横屏使用'), `${label}: 没有横屏说明`);
  assert(metrics.gateText.includes('直接进入横屏'), `${label}: 没有可靠的兼容横屏按钮`);
  assert(metrics.rootVisibility === 'hidden', `${label}: 入口后仍露出竖版大厅`);
  assert(metrics.rootPointerEvents === 'none', `${label}: 入口后仍能误触竖版大厅`);
  assert(metrics.gateRect?.width >= metrics.viewport.width - 2, `${label}: 横屏入口没有铺满宽度`);
  assert(metrics.gateRect?.height >= metrics.viewport.height - 2, `${label}: 横屏入口没有铺满高度`);
  assert(metrics.button?.height >= 48, `${label}: 横屏按钮触控高度不足`);
  return metrics;
}

async function forceLandscape(page, label) {
  await page.getByRole('button', { name: /直接进入横屏/ }).click();
  await page.waitForFunction(() => {
    return document.body.classList.contains('force-landscape-active')
      && document.documentElement.dataset.landscapePresentation === 'forced';
  }, null, { timeout: 10_000 });

  const metrics = await page.evaluate(() => {
    const root = document.getElementById('root');
    const gate = document.getElementById('henan50k-landscape-gate');
    const rect = root?.getBoundingClientRect();
    const rootStyle = root ? getComputedStyle(root) : null;
    const htmlStyle = getComputedStyle(document.documentElement);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      presentation: document.documentElement.dataset.landscapePresentation || '',
      gateHidden: gate?.hidden,
      forcedActive: document.body.classList.contains('force-landscape-active'),
      gateActive: document.body.classList.contains('landscape-gate-active'),
      rootRect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
      rootWidth: rootStyle?.width || '',
      rootHeight: rootStyle?.height || '',
      rootTransform: rootStyle?.transform || '',
      appWidth: htmlStyle.getPropertyValue('--app-width').trim(),
      appHeight: htmlStyle.getPropertyValue('--app-height').trim(),
    };
  });

  assert(metrics.viewport.height > metrics.viewport.width, `${label}: 回退测试必须保持浏览器竖屏`);
  assert(metrics.presentation === 'forced', `${label}: 浏览器拒绝旋转后没有进入兼容横屏`);
  assert(metrics.forcedActive && !metrics.gateActive, `${label}: 兼容横屏类名没有正确切换`);
  assert(metrics.gateHidden === true, `${label}: 兼容横屏后入口仍挡住游戏`);
  assert(metrics.rootTransform !== 'none', `${label}: 兼容横屏没有旋转实际应用`);
  assert(parseFloat(metrics.rootWidth) >= metrics.viewport.height - 2, `${label}: 兼容横屏内部宽度没有交换`);
  assert(parseFloat(metrics.rootHeight) >= metrics.viewport.width - 2, `${label}: 兼容横屏内部高度没有交换`);
  assert(parseFloat(metrics.appWidth) >= metrics.viewport.height - 2, `${label}: --app-width 没有交换为横屏宽度`);
  assert(parseFloat(metrics.appHeight) >= metrics.viewport.width - 2, `${label}: --app-height 没有交换为横屏高度`);
  assert(metrics.rootRect?.width >= metrics.viewport.width - 3, `${label}: 旋转后的游戏没有覆盖物理屏幕宽度`);
  assert(metrics.rootRect?.height >= metrics.viewport.height - 3, `${label}: 旋转后的游戏没有覆盖物理屏幕高度`);
  return metrics;
}

async function enterSoloGame(page) {
  await page.getByRole('button', { name: /单机练习/ }).click();
  await page.getByRole('button', { name: /三人单机/ }).click();
  await page.waitForSelector('.game-table-shell', { timeout: 120_000 });
  await page.waitForSelector('[data-card-id]', { timeout: 30_000 });
  await page.waitForTimeout(500);
}

async function auditPlayableTable(page, label, expectedPresentation) {
  const metrics = await page.evaluate(() => {
    const rect = selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const value = node.getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    };
    const actions = [...document.querySelectorAll('.game-hand-actions button')].map(button => {
      const value = button.getBoundingClientRect();
      return { text: button.textContent?.trim() || '', left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      presentation: document.documentElement.dataset.landscapePresentation || '',
      shell: rect('.game-table-shell'),
      stage: rect('.game-table-stage'),
      dock: rect('.game-table-hand-dock'),
      cardCount: document.querySelectorAll('[data-card-id]').length,
      actions,
    };
  });

  assert(metrics.presentation === expectedPresentation, `${label}: 牌桌横屏模式应为 ${expectedPresentation}`);
  assert(metrics.shell && metrics.stage && metrics.dock, `${label}: 牌桌结构不完整`);
  assert(metrics.shell.width >= metrics.viewport.width - 3, `${label}: 牌桌没有覆盖屏幕宽度`);
  assert(metrics.shell.height >= metrics.viewport.height - 3, `${label}: 牌桌没有覆盖屏幕高度`);
  assert(metrics.shell.left >= -3 && metrics.shell.top >= -3, `${label}: 牌桌起点超出屏幕`);
  assert(metrics.shell.right <= metrics.viewport.width + 3 && metrics.shell.bottom <= metrics.viewport.height + 3, `${label}: 牌桌超出屏幕`);
  assert(metrics.cardCount > 0, `${label}: 没有手牌`);
  assert(metrics.actions.length >= 5, `${label}: 操作按钮不足5个`);
  for (const action of metrics.actions) {
    assert(action.left >= -2 && action.right <= metrics.viewport.width + 2, `${label}: “${action.text}”横向越界`);
    assert(action.top >= -2 && action.bottom <= metrics.viewport.height + 2, `${label}: “${action.text}”纵向越界`);
    assert(action.height >= 38 || action.width >= 38, `${label}: “${action.text}”触控区域不足`);
  }

  const targetCard = page.locator('[data-card-id]').last();
  const cardId = await targetCard.getAttribute('data-card-id');
  await targetCard.click();
  await page.waitForFunction(id => {
    const card = [...document.querySelectorAll('[data-card-id]')].find(node => node.dataset.cardId === id);
    return card?.getAttribute('aria-pressed') === 'true';
  }, cardId, { timeout: 10_000 });
  return { ...metrics, selectedCardId: cardId };
}

async function rotateToNativeLandscape(page, label) {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => {
    return document.documentElement.dataset.landscapePresentation === 'native'
      && !document.body.classList.contains('force-landscape-active')
      && !document.body.classList.contains('landscape-gate-active');
  }, null, { timeout: 10_000 });
  const metrics = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    presentation: document.documentElement.dataset.landscapePresentation || '',
    forcedActive: document.body.classList.contains('force-landscape-active'),
    gateActive: document.body.classList.contains('landscape-gate-active'),
    gateHidden: document.getElementById('henan50k-landscape-gate')?.hidden,
  }));
  assert(metrics.viewport.width > metrics.viewport.height, `${label}: 模拟真实旋转后视口仍非横屏`);
  assert(metrics.presentation === 'native', `${label}: 真实旋转后没有切回原生横屏`);
  assert(!metrics.forcedActive && !metrics.gateActive && metrics.gateHidden, `${label}: 真实旋转后兼容层没有清理`);
  return metrics;
}

await fs.mkdir(outputDir, { recursive: true });
const report = [];
let failure = null;

try {
  for (const engine of engines) {
    const browser = await engine.launcher.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
        userAgent: engine.userAgent,
      });
      const page = await context.newPage();
      const diagnostics = attachDiagnostics(page);
      const label = engine.name;

      await openRelease(page);
      const gate = await auditGate(page, label);
      await page.screenshot({ path: path.join(outputDir, `${label}-01-gate.png`), fullPage: false });

      const forced = await forceLandscape(page, label);
      await enterSoloGame(page);
      const forcedGame = await auditPlayableTable(page, `${label}-forced`, 'forced');
      await page.screenshot({ path: path.join(outputDir, `${label}-02-forced-game.png`), fullPage: false });

      const nativeRotation = await rotateToNativeLandscape(page, label);
      const nativeGame = await auditPlayableTable(page, `${label}-native`, 'native');
      await page.screenshot({ path: path.join(outputDir, `${label}-03-native-game.png`), fullPage: false });

      assert(diagnostics.consoleErrors.length === 0, `${label}: 控制台错误 ${diagnostics.consoleErrors.join('；')}`);
      assert(diagnostics.pageErrors.length === 0, `${label}: 页面错误 ${diagnostics.pageErrors.join('；')}`);
      assert(diagnostics.requestFailures.length === 0, `${label}: 请求失败 ${JSON.stringify(diagnostics.requestFailures)}`);
      assert(diagnostics.httpErrors.length === 0, `${label}: HTTP错误 ${JSON.stringify(diagnostics.httpErrors)}`);
      report.push({ engine: engine.name, gate, forced, forcedGame, nativeRotation, nativeGame, diagnostics });
      await context.close();
    } finally {
      await browser.close();
    }
  }
} catch (error) {
  failure = { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : '', at: new Date().toISOString() };
  throw error;
} finally {
  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  if (failure) await fs.writeFile(path.join(outputDir, 'failure.json'), JSON.stringify(failure, null, 2));
}

console.log('landscape r2 live audit passed: Chromium + WebKit forced fallback + native rotation + playable table');