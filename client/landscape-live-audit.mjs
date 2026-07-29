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

function assertInsideViewport(rect, viewport, label, tolerance = 2) {
  assert(rect, `${label}: 元素不存在`);
  assert(rect.left >= -tolerance, `${label}: 左侧超出屏幕 ${rect.left}px`);
  assert(rect.top >= -tolerance, `${label}: 顶部超出屏幕 ${rect.top}px`);
  assert(rect.right <= viewport.width + tolerance, `${label}: 右侧超出屏幕 ${rect.right - viewport.width}px`);
  assert(rect.bottom <= viewport.height + tolerance, `${label}: 底部超出屏幕 ${rect.bottom - viewport.height}px`);
  assert(Math.min(rect.width, rect.height) >= 38, `${label}: 实际触控短边不足38px`);
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
  await page.goto(`${target}/?landscape-r3-audit=${Date.now()}-${Math.random().toString(16).slice(2)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForSelector('.lobby-shell', { state: 'attached', timeout: 60_000 });
  await page.waitForFunction(release => document.documentElement.dataset.uiRelease === release, expectedRelease, { timeout: 60_000 });
  await page.waitForFunction(() => document.documentElement.dataset.layoutMode === 'landscape-r3', null, { timeout: 30_000 });
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
      gateRect: gateRect ? { left: gateRect.left, top: gateRect.top, right: gateRect.right, bottom: gateRect.bottom, width: gateRect.width, height: gateRect.height } : null,
      rootVisibility: root ? getComputedStyle(root).visibility : '',
      rootPointerEvents: root ? getComputedStyle(root).pointerEvents : '',
      button: buttonRect ? { left: buttonRect.left, top: buttonRect.top, right: buttonRect.right, bottom: buttonRect.bottom, width: buttonRect.width, height: buttonRect.height } : null,
      viewport: { width: innerWidth, height: innerHeight },
    };
  });

  assert(metrics.layoutMode === 'landscape-r3', `${label}: 横屏大厅修复版本标记缺失`);
  assert(metrics.presentation === 'gate', `${label}: 竖屏没有进入横屏入口状态`);
  assert(metrics.gateActive && !metrics.forcedActive, `${label}: 竖屏入口类名错误`);
  assert(metrics.gateHidden === false, `${label}: 横屏入口被隐藏`);
  assert(metrics.gateText.includes('请横屏使用'), `${label}: 没有横屏说明`);
  assert(metrics.gateText.includes('直接进入横屏'), `${label}: 没有可靠的兼容横屏按钮`);
  assert(metrics.rootVisibility === 'hidden', `${label}: 入口后仍露出竖版大厅`);
  assert(metrics.rootPointerEvents === 'none', `${label}: 入口后仍能误触竖版大厅`);
  assertInsideViewport(metrics.gateRect, metrics.viewport, `${label}: 横屏入口覆盖层`);
  assertInsideViewport(metrics.button, metrics.viewport, `${label}: 直接进入横屏按钮`);
  return metrics;
}

async function forceLandscape(page, label) {
  await page.getByRole('button', { name: /直接进入横屏/ }).tap();
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

async function readForcedLobby(page, phase) {
  return page.evaluate(currentPhase => {
    const rect = selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const value = node.getBoundingClientRect();
      return {
        left: value.left,
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        width: value.width,
        height: value.height,
      };
    };
    const hitTarget = selector => {
      const node = document.querySelector(selector);
      const value = node?.getBoundingClientRect();
      if (!node || !value || value.width <= 0 || value.height <= 0) return false;
      const hit = document.elementFromPoint(value.left + value.width / 2, value.top + value.height / 2);
      return Boolean(hit?.closest?.(selector));
    };
    const panel = document.querySelector('.lobby-panel');
    const shell = document.querySelector('.lobby-shell');
    const shellStyle = shell ? getComputedStyle(shell) : null;
    return {
      phase: currentPhase,
      viewport: { width: innerWidth, height: innerHeight },
      presentation: document.documentElement.dataset.landscapePresentation || '',
      gridTemplateColumns: shellStyle?.gridTemplateColumns || '',
      gridTemplateRows: shellStyle?.gridTemplateRows || '',
      shell: rect('.lobby-shell'),
      brand: rect('.lobby-brand'),
      main: rect('.lobby-main'),
      panel: rect('.lobby-panel'),
      panelClientHeight: panel?.clientHeight || 0,
      panelScrollHeight: panel?.scrollHeight || 0,
      panelScrollTop: panel?.scrollTop || 0,
      solo: rect('.lobby-solo-button'),
      create: rect('.lobby-action-grid .lobby-button:first-child'),
      join: rect('.lobby-action-grid .lobby-button:last-child'),
      choice3: rect('.lobby-choice-grid .lobby-choice-card:first-child'),
      choice4: rect('.lobby-choice-grid .lobby-choice-card:last-child'),
      soloHit: hitTarget('.lobby-solo-button'),
      createHit: hitTarget('.lobby-action-grid .lobby-button:first-child'),
      joinHit: hitTarget('.lobby-action-grid .lobby-button:last-child'),
      choice3Hit: hitTarget('.lobby-choice-grid .lobby-choice-card:first-child'),
      choice4Hit: hitTarget('.lobby-choice-grid .lobby-choice-card:last-child'),
    };
  }, phase);
}

function auditForcedHomeMetrics(metrics, label) {
  assert(metrics.presentation === 'forced', `${label}: 大厅不是兼容横屏状态`);
  assert(metrics.gridTemplateColumns.trim().split(/\s+/).length >= 2, `${label}: 大厅仍被竖屏媒体查询压成单列：${metrics.gridTemplateColumns}`);
  assertInsideViewport(metrics.shell, metrics.viewport, `${label}: 大厅外壳`);
  assertInsideViewport(metrics.brand, metrics.viewport, `${label}: 品牌区域`);
  assertInsideViewport(metrics.main, metrics.viewport, `${label}: 大厅操作区域`);
  assertInsideViewport(metrics.panel, metrics.viewport, `${label}: 大厅面板`);
  assertInsideViewport(metrics.solo, metrics.viewport, `${label}: 单机练习按钮`);
  assertInsideViewport(metrics.create, metrics.viewport, `${label}: 创建房间按钮`);
  assertInsideViewport(metrics.join, metrics.viewport, `${label}: 加入房间按钮`);
  assert(metrics.soloHit, `${label}: 单机练习按钮中心触点没有命中按钮`);
  assert(metrics.createHit, `${label}: 创建房间按钮中心触点没有命中按钮`);
  assert(metrics.joinHit, `${label}: 加入房间按钮中心触点没有命中按钮`);
  assert(metrics.panelScrollHeight <= metrics.panelClientHeight + 2, `${label}: 首页仍需滚动，内容高 ${metrics.panelScrollHeight}px、可视高 ${metrics.panelClientHeight}px`);
  assert(metrics.panelScrollTop === 0, `${label}: 测试程序偷偷滚动了大厅面板`);
}

function auditForcedChoiceMetrics(metrics, label) {
  assert(metrics.presentation === 'forced', `${label}: 人数选择页不是兼容横屏状态`);
  assertInsideViewport(metrics.panel, metrics.viewport, `${label}: 人数选择面板`);
  assertInsideViewport(metrics.choice3, metrics.viewport, `${label}: 三人单机按钮`);
  assertInsideViewport(metrics.choice4, metrics.viewport, `${label}: 四人单机按钮`);
  assert(metrics.choice3Hit, `${label}: 三人单机按钮中心触点没有命中按钮`);
  assert(metrics.choice4Hit, `${label}: 四人单机按钮中心触点没有命中按钮`);
  assert(metrics.panelScrollHeight <= metrics.panelClientHeight + 2, `${label}: 人数选择页仍需滚动`);
  assert(metrics.panelScrollTop === 0, `${label}: 测试程序偷偷滚动了人数选择面板`);
}

async function enterSoloGameThroughVisibleLobby(page, label) {
  const home = await readForcedLobby(page, 'home');
  auditForcedHomeMetrics(home, `${label}-home`);
  await page.screenshot({ path: path.join(outputDir, `${label}-02-forced-lobby-home.png`), fullPage: false });

  await page.locator('.lobby-solo-button').tap();
  await page.getByRole('heading', { name: '选择参与人数' }).waitFor({ state: 'visible', timeout: 10_000 });

  const choice = await readForcedLobby(page, 'solo-choice');
  auditForcedChoiceMetrics(choice, `${label}-solo-choice`);
  await page.screenshot({ path: path.join(outputDir, `${label}-03-forced-lobby-choice.png`), fullPage: false });

  await page.locator('.lobby-choice-grid .lobby-choice-card').first().tap();
  await page.waitForSelector('.game-table-shell', { timeout: 120_000 });
  await page.waitForSelector('[data-card-id]', { timeout: 30_000 });
  await page.waitForTimeout(500);
  return { home, choice };
}

async function readSelectedCount(page) {
  return page.evaluate(() => {
    const playText = document.querySelector('.btn-play')?.textContent || '';
    const match = playText.match(/\((\d+)\)/);
    return Number(match?.[1] || 0);
  });
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
  assertInsideViewport(metrics.shell, metrics.viewport, `${label}: 牌桌`);
  assert(metrics.cardCount > 0, `${label}: 没有手牌`);
  assert(metrics.actions.length >= 5, `${label}: 操作按钮不足5个`);
  for (const action of metrics.actions) {
    assertInsideViewport(action, metrics.viewport, `${label}: “${action.text}”`);
  }

  const targetCard = page.locator('[data-card-id]').last();
  const cardId = await targetCard.getAttribute('data-card-id');
  const selectedBefore = await readSelectedCount(page);
  await targetCard.tap();
  await page.waitForFunction(before => {
    const playText = document.querySelector('.btn-play')?.textContent || '';
    const match = playText.match(/\((\d+)\)/);
    return Number(match?.[1] || 0) !== before;
  }, selectedBefore, { timeout: 10_000 });
  const selectedAfter = await readSelectedCount(page);
  return { ...metrics, selectedCardId: cardId, selectedBefore, selectedAfter };
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
      const forcedLobby = await enterSoloGameThroughVisibleLobby(page, label);
      const forcedGame = await auditPlayableTable(page, `${label}-forced`, 'forced');
      await page.screenshot({ path: path.join(outputDir, `${label}-04-forced-game.png`), fullPage: false });

      const nativeRotation = await rotateToNativeLandscape(page, label);
      const nativeGame = await auditPlayableTable(page, `${label}-native`, 'native');
      await page.screenshot({ path: path.join(outputDir, `${label}-05-native-game.png`), fullPage: false });

      assert(diagnostics.consoleErrors.length === 0, `${label}: 控制台错误 ${diagnostics.consoleErrors.join('；')}`);
      assert(diagnostics.pageErrors.length === 0, `${label}: 页面错误 ${diagnostics.pageErrors.join('；')}`);
      assert(diagnostics.requestFailures.length === 0, `${label}: 请求失败 ${JSON.stringify(diagnostics.requestFailures)}`);
      assert(diagnostics.httpErrors.length === 0, `${label}: HTTP错误 ${JSON.stringify(diagnostics.httpErrors)}`);
      report.push({ engine: engine.name, gate, forced, forcedLobby, forcedGame, nativeRotation, nativeGame, diagnostics });
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

console.log('landscape r3 live audit passed: visible forced lobby + touch start path + Chromium/WebKit table');
