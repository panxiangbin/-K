import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium, webkit } from 'playwright';

const target = process.env.GAME_CLEAN_AUDIT_URL || 'http://127.0.0.1:4173/pan/50k';
const outputDir = path.resolve('game-clean-audit-artifacts');
const engines = [
  { name: 'chromium-android', launcher: chromium, userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36' },
  { name: 'webkit-iphone', launcher: webkit, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function attachDiagnostics(page) {
  const result = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on('console', message => {
    if (message.type() === 'error') result.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => result.pageErrors.push(error.message));
  page.on('requestfailed', request => result.requestFailures.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));
  page.on('response', response => {
    if (response.status() >= 400) result.httpErrors.push({ url: response.url(), status: response.status() });
  });
  return result;
}

async function enterThreePlayerGame(page) {
  await page.goto(`${target}/?clean-game-audit=${Date.now()}-${Math.random().toString(16).slice(2)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForSelector('#henan50k-landscape-gate:not([hidden])', { state: 'visible', timeout: 60_000 });
  await page.getByRole('button', { name: /直接进入横屏/ }).tap();
  await page.waitForFunction(() => document.documentElement.dataset.landscapePresentation === 'forced', null, { timeout: 15_000 });
  await page.locator('.lobby-solo-button').tap();
  await page.getByRole('heading', { name: '选择参与人数' }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('.lobby-choice-grid .lobby-choice-card').first().tap();
  await page.waitForSelector('.game-table-shell', { state: 'visible', timeout: 120_000 });
  await page.waitForSelector('.game-hand-actions', { state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.gameVisual === 'clean-landscape-v1', null, { timeout: 20_000 });
  await page.waitForTimeout(800);
}

async function readLayout(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const actions = [...document.querySelectorAll('.game-hand-actions button')].map(node => {
      const r = node.getBoundingClientRect();
      return { text: node.textContent?.trim() || '', left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    });
    const visibleCards = [...document.querySelectorAll('[data-card-id]')].filter(node => {
      const r = node.getBoundingClientRect();
      return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
    }).length;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      presentation: document.documentElement.dataset.landscapePresentation || '',
      visual: document.documentElement.dataset.gameVisual || '',
      bodyClass: document.body.className,
      shell: rect('.game-table-shell'),
      header: rect('.game-table-header'),
      stage: rect('.game-table-stage'),
      board: rect('.game-table-trick-board'),
      dock: rect('.game-table-hand-dock'),
      hand: rect('.game-hand-surface'),
      selection: rect('.game-hand-selection-status'),
      actions,
      totalCards: document.querySelectorAll('[data-card-id]').length,
      visibleCards,
      boardText: document.querySelector('.game-table-trick-board')?.textContent?.replace(/\s+/g, ' ').trim() || '',
    };
  });
}

function assertInside(rect, viewport, label, tolerance = 3) {
  assert(rect, `${label}不存在`);
  assert(rect.left >= -tolerance, `${label}左侧越界 ${rect.left}px`);
  assert(rect.top >= -tolerance, `${label}顶部越界 ${rect.top}px`);
  assert(rect.right <= viewport.width + tolerance, `${label}右侧越界 ${rect.right - viewport.width}px`);
  assert(rect.bottom <= viewport.height + tolerance, `${label}底部越界 ${rect.bottom - viewport.height}px`);
}

function auditLayout(metrics, label) {
  assert(metrics.visual === 'clean-landscape-v1', `${label}: 新牌桌版本未生效`);
  assert(metrics.presentation === 'forced' || metrics.presentation === 'native', `${label}: 横屏状态错误`);
  assert(metrics.bodyClass.includes('game-screen-clean-v1'), `${label}: 新牌桌类名未启用`);
  for (const [name, rect] of Object.entries({ shell: metrics.shell, header: metrics.header, stage: metrics.stage, board: metrics.board, dock: metrics.dock, hand: metrics.hand, selection: metrics.selection })) {
    assertInside(rect, metrics.viewport, `${label}:${name}`);
  }
  assert(metrics.stage.width > metrics.dock.height * 3, `${label}: 牌桌仍像竖版压缩`);
  assert(metrics.board.width >= 360, `${label}: 中央出牌区太窄 ${metrics.board.width}px`);
  assert(metrics.totalCards > 0 && metrics.visibleCards >= 8, `${label}: 手牌可见数量不足 ${metrics.visibleCards}/${metrics.totalCards}`);
  assert(metrics.actions.length >= 5, `${label}: 操作按钮不完整`);
  for (const action of metrics.actions) {
    assertInside(action, metrics.viewport, `${label}:按钮“${action.text}”`);
    assert(action.height >= 38, `${label}:按钮“${action.text}”高度不足`);
  }
}

async function clearSelection(page) {
  const clear = page.getByRole('button', { name: /^清空$/ });
  if (await clear.isEnabled().catch(() => false)) {
    await clear.tap();
    await page.waitForTimeout(150);
  }
}

async function playOneLegalTurn(page, label, attempt) {
  await clearSelection(page);
  await page.waitForFunction(() => {
    const turn = document.querySelector('.game-table-header__turn')?.textContent || '';
    return turn.includes('轮到你');
  }, null, { timeout: 45_000 });

  const handBefore = await page.locator('[data-card-id]').count();
  const hint = page.getByRole('button', { name: /^提示$/ });
  await hint.tap();
  await page.waitForFunction(() => /出牌\(\d+\)/.test(document.querySelector('.btn-play')?.textContent || ''), null, { timeout: 10_000 });
  const selectedStatus = await page.locator('.game-hand-selection-status').textContent();
  const play = page.locator('.btn-play');
  await play.tap();
  await page.waitForFunction(before => document.querySelectorAll('[data-card-id]').length < before, handBefore, { timeout: 20_000 });
  const handAfter = await page.locator('[data-card-id]').count();
  const boardText = await page.locator('.game-table-trick-board').textContent();
  assert(handAfter < handBefore, `${label}: 第${attempt}次真实出牌后手牌未减少`);
  assert(/单张|对子|三张|四张|五张|六张|七张|五十K|炸弹/.test(boardText || ''), `${label}: 第${attempt}次出牌后中央牌型未显示`);
  return { attempt, handBefore, handAfter, selectedStatus: selectedStatus?.replace(/\s+/g, ' ').trim() || '', boardText: boardText?.replace(/\s+/g, ' ').trim() || '' };
}

async function stressLongestPatternLabels(page, label) {
  const metrics = await page.evaluate(() => {
    const board = document.querySelector('.game-table-trick-board');
    const dock = document.querySelector('.game-table-hand-dock');
    const meta = document.querySelector('.trick-board-summary__meta');
    const action = document.querySelector('.trick-action-card__header > :last-child');
    const selectionText = document.querySelector('.game-hand-selection-status > div');
    if (!board || !dock || !meta || !action || !selectionText) return null;

    meta.innerHTML = '牌型 <span style="font-weight:900">四王炸弹</span> · 本墩 <span style="font-weight:900">120分</span>';
    action.textContent = '八张同点炸弹';
    selectionText.textContent = '已选7张 · 普通七张（可点出牌，由系统判断）';

    const box = node => {
      const r = node.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const textBox = node => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      board: box(board),
      dock: box(dock),
      meta: box(meta),
      metaText: textBox(meta),
      action: box(action),
      actionText: textBox(action),
      selection: box(selectionText),
      selectionText: textBox(selectionText),
      labels: { meta: meta.textContent, action: action.textContent, selection: selectionText.textContent },
    };
  });
  assert(metrics, `${label}: 无法建立最长牌型压力测试`);
  const inside = (inner, outer, name) => {
    assert(inner.left >= outer.left - 2, `${label}:${name}左侧被截断`);
    assert(inner.right <= outer.right + 2, `${label}:${name}右侧被截断 ${inner.right - outer.right}px`);
    assert(inner.top >= outer.top - 2, `${label}:${name}顶部被截断`);
    assert(inner.bottom <= outer.bottom + 2, `${label}:${name}底部被截断`);
  };
  inside(metrics.metaText, metrics.board, '牌型汇总“四王炸弹”');
  inside(metrics.actionText, metrics.board, '玩家出牌“八张同点炸弹”');
  inside(metrics.selectionText, metrics.dock, '选牌状态“普通七张”');
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
      await enterThreePlayerGame(page);
      const initial = await readLayout(page);
      auditLayout(initial, `${engine.name}-initial`);
      await page.screenshot({ path: path.join(outputDir, `${engine.name}-01-clean-game.png`), fullPage: false });

      const plays = [];
      for (let index = 1; index <= 3; index += 1) {
        plays.push(await playOneLegalTurn(page, engine.name, index));
      }
      const afterPlay = await readLayout(page);
      auditLayout(afterPlay, `${engine.name}-after-play`);
      await page.screenshot({ path: path.join(outputDir, `${engine.name}-02-after-three-plays.png`), fullPage: false });

      const longLabels = await stressLongestPatternLabels(page, engine.name);
      await page.screenshot({ path: path.join(outputDir, `${engine.name}-03-long-pattern-labels.png`), fullPage: false });

      assert(diagnostics.consoleErrors.length === 0, `${engine.name}: 控制台错误 ${diagnostics.consoleErrors.join('；')}`);
      assert(diagnostics.pageErrors.length === 0, `${engine.name}: 页面错误 ${diagnostics.pageErrors.join('；')}`);
      assert(diagnostics.requestFailures.length === 0, `${engine.name}: 请求失败 ${JSON.stringify(diagnostics.requestFailures)}`);
      assert(diagnostics.httpErrors.length === 0, `${engine.name}: HTTP错误 ${JSON.stringify(diagnostics.httpErrors)}`);
      report.push({ engine: engine.name, initial, plays, afterPlay, longLabels, diagnostics });
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

console.log('clean landscape game audit passed: Chromium/WebKit + three real plays + longest pattern labels');
