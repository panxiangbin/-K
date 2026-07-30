import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium, webkit } from 'playwright';

const target = process.env.GAME_TECH_AUDIT_URL
  || process.env.GAME_CLEAN_AUDIT_URL
  || 'http://127.0.0.1:4173/pan/50k';
const outputDir = path.resolve(process.env.GAME_TECH_AUDIT_OUTPUT_DIR || 'game-tech-audit-artifacts');
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
const WEBKIT_FONT_BOX_TOLERANCE = 8;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function diagnosticsFor(page) {
  const state = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on('console', message => {
    if (message.type() === 'error') state.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => state.pageErrors.push(error.message));
  page.on('requestfailed', request => state.requestFailures.push({
    url: request.url(),
    error: request.failure()?.errorText || 'unknown',
  }));
  page.on('response', response => {
    if (response.status() >= 400) state.httpErrors.push({ url: response.url(), status: response.status() });
  });
  return state;
}

async function enterGame(page) {
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto(`${target}/?tech-game-v2=${nonce}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForSelector('#henan50k-landscape-gate:not([hidden])', {
    state: 'visible',
    timeout: 60_000,
  });
  await page.getByRole('button', { name: /直接进入横屏/ }).tap();
  await page.waitForFunction(
    () => document.documentElement.dataset.landscapePresentation === 'forced',
    null,
    { timeout: 15_000 },
  );
  await page.locator('.lobby-solo-button').tap();
  await page.getByRole('heading', { name: '选择参与人数' }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('.lobby-choice-grid .lobby-choice-card').first().tap();
  await page.waitForSelector('.tech-game-shell', { state: 'visible', timeout: 120_000 });
  await page.waitForSelector('.tech-actions', { state: 'visible', timeout: 30_000 });
  await page.waitForFunction(
    () => document.documentElement.dataset.gameVisual === 'tech-landscape-v2',
    null,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(900);
}

async function inspect(page) {
  return page.evaluate(() => {
    const rect = node => {
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
    const logical = node => node ? {
      width: node.offsetWidth,
      height: node.offsetHeight,
      offsetTop: node.offsetTop,
      offsetLeft: node.offsetLeft,
      clientWidth: node.clientWidth,
      clientHeight: node.clientHeight,
      scrollWidth: node.scrollWidth,
      scrollHeight: node.scrollHeight,
    } : null;
    const one = selector => document.querySelector(selector);
    const shell = one('.tech-game-shell');
    const board = one('.tech-trick-board');
    const dock = one('.tech-hand-dock');
    const hand = one('.tech-hand-surface');
    const actions = one('.tech-actions');
    const cards = [...document.querySelectorAll('[data-card-id]')];
    return {
      viewport: { width: innerWidth, height: innerHeight },
      presentation: document.documentElement.dataset.landscapePresentation || '',
      visual: document.documentElement.dataset.gameVisual || '',
      shell: rect(shell),
      shellLogical: logical(shell),
      board: rect(board),
      boardLogical: logical(board),
      dock: rect(dock),
      hand: rect(hand),
      handLogical: logical(hand),
      actions: rect(actions),
      actionsLogical: logical(actions),
      buttons: [...document.querySelectorAll('.tech-actions button')].map(node => ({
        text: node.textContent?.trim() || '',
        rect: rect(node),
        logical: logical(node),
      })),
      cells: [...document.querySelectorAll('.tech-trick-cell')].map(node => ({
        text: node.textContent?.replace(/\s+/g, ' ').trim() || '',
        rect: rect(node),
        logical: logical(node),
      })),
      cardCount: cards.length,
      visibleCardCount: cards.filter(node => {
        const value = node.getBoundingClientRect();
        return value.right > 0 && value.left < innerWidth && value.bottom > 0 && value.top < innerHeight;
      }).length,
    };
  });
}

function inside(rect, viewport, label, tolerance = 3) {
  assert(rect, `${label}不存在`);
  assert(rect.left >= -tolerance, `${label}左侧越界 ${rect.left}px`);
  assert(rect.top >= -tolerance, `${label}顶部越界 ${rect.top}px`);
  assert(rect.right <= viewport.width + tolerance, `${label}右侧越界 ${rect.right - viewport.width}px`);
  assert(rect.bottom <= viewport.height + tolerance, `${label}底部越界 ${rect.bottom - viewport.height}px`);
}

function verifyLayout(data, label) {
  assert(data.visual === 'tech-landscape-v2', `${label}:科技V2界面标记缺失`);
  assert(data.presentation === 'forced' || data.presentation === 'native', `${label}:未处于横屏模式`);
  inside(data.shell, data.viewport, `${label}:牌桌`);
  inside(data.board, data.viewport, `${label}:中央出牌区`);
  inside(data.dock, data.viewport, `${label}:手牌区`);
  inside(data.hand, data.viewport, `${label}:手牌滚动行`);
  inside(data.actions, data.viewport, `${label}:操作按钮区`);
  assert(
    data.handLogical.offsetTop + data.handLogical.height <= data.actionsLogical.offsetTop + 2,
    `${label}:操作按钮覆盖手牌逻辑行`,
  );
  assert(
    data.shellLogical?.width >= 800 && data.shellLogical?.height <= 410,
    `${label}:逻辑画布不是横版 ${JSON.stringify(data.shellLogical)}`,
  );
  assert(
    data.boardLogical?.scrollHeight <= data.boardLogical?.clientHeight + WEBKIT_FONT_BOX_TOLERANCE,
    `${label}:中央出牌区纵向被裁切 ${data.boardLogical?.scrollHeight}/${data.boardLogical?.clientHeight}`,
  );
  assert(
    data.boardLogical?.scrollWidth <= data.boardLogical?.clientWidth + 2,
    `${label}:中央出牌区横向被裁切`,
  );
  assert(data.cells.length >= 3, `${label}:玩家行动格不足`);
  for (const [index, cell] of data.cells.entries()) {
    inside(cell.rect, data.viewport, `${label}:行动格${index + 1}`);
    assert(
      cell.logical.scrollHeight <= cell.logical.clientHeight + WEBKIT_FONT_BOX_TOLERANCE,
      `${label}:行动格${index + 1}内容被裁切 ${cell.logical.scrollHeight}/${cell.logical.clientHeight}`,
    );
    assert(cell.logical.scrollWidth <= cell.logical.clientWidth + 2, `${label}:行动格${index + 1}横向被裁切`);
  }
  assert(data.buttons.length === 5, `${label}:操作按钮应为5个，实际${data.buttons.length}`);
  for (const button of data.buttons) {
    inside(button.rect, data.viewport, `${label}:按钮“${button.text}”`);
    assert(
      button.logical.width >= 60 && button.logical.height >= 38,
      `${label}:按钮“${button.text}”触控区域不足 ${button.logical.width}x${button.logical.height}`,
    );
  }
  assert(data.cardCount > 0 && data.visibleCardCount >= 12, `${label}:可见手牌不足 ${data.visibleCardCount}/${data.cardCount}`);
}

async function playLegalTurn(page, label, number) {
  await page.waitForFunction(
    () => (document.querySelector('.game-table-header__turn')?.textContent || '').includes('轮到你'),
    null,
    { timeout: 45_000 },
  );
  const clear = page.getByRole('button', { name: /^清空$/ });
  if (await clear.isEnabled().catch(() => false)) await clear.tap();

  const before = await page.locator('[data-card-id]').count();
  await page.getByRole('button', { name: /^提示$/ }).tap();
  await page.waitForTimeout(450);

  const decision = await page.evaluate(() => {
    const play = document.querySelector('.btn-play');
    const pass = document.querySelector('.btn-pass');
    const selectedCount = document.querySelectorAll('[data-card-id][aria-pressed="true"]').length;
    return {
      selectedCount,
      canPlay: selectedCount > 0 && Boolean(play) && !play.disabled && play.getAttribute('aria-disabled') !== 'true',
      canPass: Boolean(pass) && !pass.disabled && pass.getAttribute('aria-disabled') !== 'true',
      playText: play?.textContent?.trim() || '',
      passText: pass?.textContent?.trim() || '',
    };
  });

  const selectedText = (await page.locator('.tech-selection-status').textContent())?.replace(/\s+/g, ' ').trim() || '';
  if (decision.canPlay) {
    await page.locator('.btn-play').tap();
    await page.waitForFunction(
      value => document.querySelectorAll('[data-card-id]').length < value,
      before,
      { timeout: 20_000 },
    );
    const after = await page.locator('[data-card-id]').count();
    const boardText = (await page.locator('.tech-trick-board').textContent())?.replace(/\s+/g, ' ').trim() || '';
    assert(/单张|对子|三张|四张|五张|六张|七张|五十K|炸弹/.test(boardText), `${label}:第${number}回合出牌后牌型没有显示`);
    return { number, action: 'play', before, after, selectedText, boardText };
  }

  assert(decision.canPass, `${label}:第${number}回合既无可出牌也不能过牌 ${JSON.stringify(decision)}`);
  await page.locator('.btn-pass').tap();
  await page.waitForTimeout(700);
  return {
    number,
    action: 'pass',
    before,
    after: await page.locator('[data-card-id]').count(),
    selectedText,
    boardText: (await page.locator('.tech-trick-board').textContent())?.replace(/\s+/g, ' ').trim() || '',
  };
}

async function stressLabels(page, label) {
  const result = await page.evaluate(() => {
    const meta = document.querySelector('.tech-round-meta');
    const action = document.querySelector('.tech-trick-cell-head strong');
    const selectionOuter = document.querySelector('.tech-selection-status');
    const selectionText = selectionOuter?.firstElementChild;
    if (!meta || !action || !selectionOuter || !selectionText) {
      return { missing: { meta: Boolean(meta), action: Boolean(action), selectionOuter: Boolean(selectionOuter), selectionText: Boolean(selectionText) } };
    }
    meta.innerHTML = '<span class="tech-meta-label">牌型</span><strong>四王炸弹</strong><span class="tech-meta-separator">·</span><span class="tech-meta-label">本墩</span><strong>120分</strong>';
    action.textContent = '八张同点炸弹';
    selectionText.textContent = '已选7张 · 普通七张（可点出牌，由系统判断）';
    const box = node => {
      const value = node.getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom };
    };
    const textBox = node => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const value = range.getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom };
    };
    return {
      meta: box(meta), metaText: textBox(meta),
      action: box(action), actionText: textBox(action),
      selectionOuter: box(selectionOuter), selectionText: textBox(selectionText),
      labels: { meta: meta.textContent, action: action.textContent, selection: selectionText.textContent },
    };
  });
  assert(!result.missing, `${label}:最长牌型目标缺失 ${JSON.stringify(result.missing)}`);
  const contained = (inner, outer, name) => {
    assert(inner.left >= outer.left - 2, `${label}:${name}左侧被裁切`);
    assert(inner.right <= outer.right + 2, `${label}:${name}右侧被裁切 ${inner.right - outer.right}px`);
    assert(inner.top >= outer.top - 2, `${label}:${name}顶部被裁切`);
    assert(inner.bottom <= outer.bottom + 2, `${label}:${name}底部被裁切`);
  };
  contained(result.metaText, result.meta, '四王炸弹汇总');
  contained(result.actionText, result.action, '八张同点炸弹行动标签');
  contained(result.selectionText, result.selectionOuter, '普通七张选牌提示');
  return result;
}

await fs.mkdir(outputDir, { recursive: true });
const report = [];
let failure = null;
let debug = null;

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
      const diagnostics = diagnosticsFor(page);
      await enterGame(page);

      const initial = await inspect(page);
      debug = { engine: engine.name, initial, diagnostics };
      await page.screenshot({ path: path.join(outputDir, `${engine.name}-01-tech-game.png`), fullPage: false });
      verifyLayout(initial, `${engine.name}-initial`);

      const turns = [];
      for (let number = 1; number <= 3; number += 1) {
        turns.push(await playLegalTurn(page, engine.name, number));
      }
      await page.waitForTimeout(350);
      const afterTurns = await inspect(page);
      debug = { engine: engine.name, initial, turns, afterTurns, diagnostics };
      await page.screenshot({ path: path.join(outputDir, `${engine.name}-02-after-three-turns.png`), fullPage: false });
      verifyLayout(afterTurns, `${engine.name}-after-turns`);

      const longLabels = await stressLabels(page, engine.name);
      debug = { engine: engine.name, initial, turns, afterTurns, longLabels, diagnostics };
      await page.screenshot({ path: path.join(outputDir, `${engine.name}-03-long-pattern-labels.png`), fullPage: false });

      assert(diagnostics.consoleErrors.length === 0, `${engine.name}:控制台错误 ${diagnostics.consoleErrors.join('；')}`);
      assert(diagnostics.pageErrors.length === 0, `${engine.name}:页面错误 ${diagnostics.pageErrors.join('；')}`);
      assert(diagnostics.requestFailures.length === 0, `${engine.name}:请求失败 ${JSON.stringify(diagnostics.requestFailures)}`);
      assert(diagnostics.httpErrors.length === 0, `${engine.name}:HTTP错误 ${JSON.stringify(diagnostics.httpErrors)}`);
      report.push({ engine: engine.name, initial, turns, afterTurns, longLabels, diagnostics });
      debug = null;
      await context.close();
    } finally {
      await browser.close();
    }
  }
} catch (error) {
  failure = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : '',
    at: new Date().toISOString(),
    debug,
  };
  throw error;
} finally {
  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  if (failure) await fs.writeFile(path.join(outputDir, 'failure.json'), JSON.stringify(failure, null, 2));
}

console.log('technology landscape game V2 audit passed: Chromium/WebKit, three legal turns, no board clipping, longest labels visible');
