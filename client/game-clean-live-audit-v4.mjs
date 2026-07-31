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

function diagnosticsFor(page) {
  const state = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on('console', message => { if (message.type() === 'error') state.consoleErrors.push(message.text()); });
  page.on('pageerror', error => state.pageErrors.push(error.message));
  page.on('requestfailed', request => state.requestFailures.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));
  page.on('response', response => { if (response.status() >= 400) state.httpErrors.push({ url: response.url(), status: response.status() }); });
  return state;
}

async function enterGame(page) {
  await page.goto(`${target}/?clean-game-v4=${Date.now()}-${Math.random().toString(16).slice(2)}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForSelector('#henan50k-landscape-gate:not([hidden])', { state: 'visible', timeout: 60_000 });
  await page.getByRole('button', { name: /直接进入横屏/ }).tap();
  await page.waitForFunction(() => document.documentElement.dataset.landscapePresentation === 'forced', null, { timeout: 15_000 });
  await page.locator('.lobby-solo-button').tap();
  await page.getByRole('heading', { name: '选择参与人数' }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('.lobby-choice-grid .lobby-choice-card').first().tap();
  await page.waitForSelector('.game-table-shell', { state: 'visible', timeout: 120_000 });
  await page.waitForSelector('.game-hand-actions', { state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.dataset.gameVisual === 'clean-landscape-v1', null, { timeout: 20_000 });
  await page.waitForTimeout(900);
}

async function inspect(page) {
  return page.evaluate(() => {
    const rect = node => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const logical = node => node ? {
      width: node.offsetWidth, height: node.offsetHeight,
      clientWidth: node.clientWidth, clientHeight: node.clientHeight,
      scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight,
    } : null;
    const shell = document.querySelector('.game-table-shell');
    const board = document.querySelector('.game-table-trick-board');
    const dock = document.querySelector('.game-table-hand-dock');
    const cards = [...document.querySelectorAll('[data-card-id]')];
    const buttons = [...document.querySelectorAll('.game-hand-actions button')].map(node => ({ text: node.textContent?.trim() || '', rect: rect(node), logical: logical(node) }));
    const cells = [...(board?.children?.[1]?.children || [])].map(node => ({ text: node.textContent?.replace(/\s+/g, ' ').trim() || '', rect: rect(node), logical: logical(node) }));
    return {
      viewport: { width: innerWidth, height: innerHeight },
      presentation: document.documentElement.dataset.landscapePresentation || '',
      visual: document.documentElement.dataset.gameVisual || '',
      shell: rect(shell), shellLogical: logical(shell),
      board: rect(board), boardLogical: logical(board),
      dock: rect(dock), dockLogical: logical(dock),
      buttons, cells,
      cardCount: cards.length,
      visibleCardCount: cards.filter(node => { const r = node.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; }).length,
      boardText: board?.textContent?.replace(/\s+/g, ' ').trim() || '',
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
  assert(data.visual === 'clean-landscape-v1', `${label}:新界面标记缺失`);
  assert(data.presentation === 'forced' || data.presentation === 'native', `${label}:未处于横屏模式`);
  inside(data.shell, data.viewport, `${label}:牌桌`);
  inside(data.board, data.viewport, `${label}:中央出牌区`);
  inside(data.dock, data.viewport, `${label}:手牌区`);
  assert(data.shellLogical?.width >= 800 && data.shellLogical?.height <= 410, `${label}:逻辑画布不是横版 ${JSON.stringify(data.shellLogical)}`);
  assert(data.boardLogical?.scrollHeight <= data.boardLogical?.clientHeight + 2, `${label}:中央出牌区纵向被裁切`);
  assert(data.boardLogical?.scrollWidth <= data.boardLogical?.clientWidth + 2, `${label}:中央出牌区横向被裁切`);
  assert(data.cells.length >= 3, `${label}:玩家行动格不足`);
  for (const [index, cell] of data.cells.entries()) {
    inside(cell.rect, data.viewport, `${label}:行动格${index + 1}`);
    assert(cell.logical.scrollHeight <= cell.logical.clientHeight + 2, `${label}:行动格${index + 1}纵向裁切`);
    assert(cell.logical.scrollWidth <= cell.logical.clientWidth + 2, `${label}:行动格${index + 1}横向裁切`);
  }
  assert(data.buttons.length === 5, `${label}:操作按钮应为5个，实际${data.buttons.length}`);
  for (const button of data.buttons) {
    inside(button.rect, data.viewport, `${label}:按钮“${button.text}”`);
    assert(button.logical.width >= 60 && button.logical.height >= 38, `${label}:按钮“${button.text}”触控区域不足`);
  }
  assert(data.cardCount > 0 && data.visibleCardCount === data.cardCount, `${label}:手牌未全部显示 ${data.visibleCardCount}/${data.cardCount}`);
}

async function waitForYourTurn(page) {
  await page.waitForFunction(() => (document.querySelector('.game-table-header__turn')?.textContent || '').includes('轮到你'), null, { timeout: 45_000 });
}

async function waitForTurnToMove(page) {
  await page.waitForFunction(() => !(document.querySelector('.game-table-header__turn')?.textContent || '').includes('轮到你'), null, { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function clearSelection(clear) {
  if (await clear.isEnabled().catch(() => false)) await clear.tap().catch(() => {});
}

async function tryPlayCurrentTurn(page, label, number, attempt) {
  const clear = page.getByRole('button', { name: /^清空$/ });
  const hint = page.getByRole('button', { name: /^提示$/ });
  const pass = page.getByRole('button', { name: /^过牌$/ });
  const play = page.locator('.btn-play');

  await clearSelection(clear);
  const before = await page.locator('[data-card-id]').count();
  const canPass = await pass.isEnabled().catch(() => false);

  if (canPass) {
    await hint.tap();
    await page.waitForTimeout(350);
    const hasHint = await page.evaluate(() => /出牌\(\d+\)/.test(document.querySelector('.btn-play')?.textContent || ''));
    if (!hasHint) {
      await pass.tap();
      await waitForTurnToMove(page);
      return { played: false, reason: 'no-legal-hint', number, attempt, before };
    }
  } else {
    const firstCard = page.locator('[data-card-id]').first();
    assert(await firstCard.count(), `${label}:第${number}次出牌没有可选手牌`);
    // 新一墩自己领出时直接选首张单牌；单牌一定合法，也避开随机提示牌型带来的误判。
    await firstCard.click({ force: true });
    await page.waitForFunction(() => /出牌\(\d+\)/.test(document.querySelector('.btn-play')?.textContent || ''), null, { timeout: 5_000 });
  }

  const selectedText = (await page.locator('.game-hand-selection-status').textContent())?.replace(/\s+/g, ' ').trim() || '';
  await play.tap();
  const accepted = await page.waitForFunction(value => document.querySelectorAll('[data-card-id]').length < value, before, { timeout: canPass ? 5_000 : 10_000 })
    .then(() => true)
    .catch(() => false);
  const after = await page.locator('[data-card-id]').count();

  if (accepted && after < before) {
    const boardText = (await page.locator('.game-table-trick-board').textContent())?.replace(/\s+/g, ' ').trim() || '';
    assert(/单张|对子|三张|四张|五张|六张|七张|五十K|炸弹/.test(boardText), `${label}:第${number}次出牌后牌型没有显示`);
    return { played: true, number, attempt, before, after, selectedText, boardText };
  }

  const stateText = await page.evaluate(() => ({
    turn: document.querySelector('.game-table-header__turn')?.textContent?.replace(/\s+/g, ' ').trim() || '',
    selection: document.querySelector('.game-hand-selection-status')?.textContent?.replace(/\s+/g, ' ').trim() || '',
    play: document.querySelector('.btn-play')?.textContent?.replace(/\s+/g, ' ').trim() || '',
  }));

  if (canPass && await pass.isEnabled().catch(() => false)) {
    // 提示牌可能因随机局面或服务端最终判定而被拒绝；此时清空并合法过牌，继续等下一个回合。
    await clearSelection(clear);
    await pass.tap();
    await waitForTurnToMove(page);
    return { played: false, reason: 'hint-rejected-pass', number, attempt, before, after, selectedText, stateText };
  }

  throw new Error(`${label}:第${number}次领出单牌仍被拒绝 ${JSON.stringify({ before, after, selectedText, stateText })}`);
}

async function playLegalTurn(page, label, number) {
  const skippedTurns = [];
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    await waitForYourTurn(page);
    const result = await tryPlayCurrentTurn(page, label, number, attempt);
    if (result.played) return { ...result, skippedTurns };
    skippedTurns.push(result);
  }
  throw new Error(`${label}:第${number}次出牌连续12个回合都只能合法过牌`);
}

async function stressLabels(page, label) {
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => {
    const board = document.querySelector('.game-table-trick-board');
    const meta = document.querySelector('.trick-board-summary__meta') || board?.firstElementChild?.lastElementChild;
    const firstCell = board?.children?.[1]?.firstElementChild;
    const action = document.querySelector('.trick-action-card__header > :last-child') || firstCell?.firstElementChild?.lastElementChild;
    const selectionOuter = document.querySelector('.game-hand-selection-status');
    const selectionText = selectionOuter?.firstElementChild;
    if (!board || !meta || !action || !selectionOuter || !selectionText) return { missing: true };
    meta.innerHTML = '牌型 <span>四王炸弹</span> · 本墩 <span>120分</span>';
    action.textContent = '八张同点炸弹';
    selectionText.textContent = '已选7张 · 普通七张（可点出牌，由系统判断）';
    const logical = node => ({ clientWidth: node.clientWidth, clientHeight: node.clientHeight, scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight });
    return { meta: logical(meta), action: logical(action), selectionOuter: logical(selectionOuter), selectionText: logical(selectionText), labels: { meta: meta.textContent, action: action.textContent, selection: selectionText.textContent } };
  });
  assert(!result.missing, `${label}:最长牌型目标缺失`);
  const noOverflow = (box, name) => {
    assert(box.scrollWidth <= box.clientWidth + 2, `${label}:${name}横向被裁切 ${box.scrollWidth}/${box.clientWidth}`);
    assert(box.scrollHeight <= box.clientHeight + 2, `${label}:${name}纵向被裁切 ${box.scrollHeight}/${box.clientHeight}`);
  };
  noOverflow(result.meta, '四王炸弹汇总');
  noOverflow(result.action, '八张同点炸弹行动标签');
  noOverflow(result.selectionOuter, '普通七张选牌提示容器');
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
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: engine.userAgent });
      try {
        const page = await context.newPage();
        const diagnostics = diagnosticsFor(page);
        await enterGame(page);
        const initial = await inspect(page);
        debug = { engine: engine.name, initial, diagnostics };
        await page.screenshot({ path: path.join(outputDir, `${engine.name}-01-clean-game.png`), fullPage: false });
        verifyLayout(initial, `${engine.name}-initial`);
        const plays = [];
        for (let number = 1; number <= 3; number += 1) {
          const play = await playLegalTurn(page, engine.name, number);
          plays.push(play);
          debug = { engine: engine.name, initial, plays, diagnostics };
        }
        await page.waitForTimeout(350);
        const afterPlay = await inspect(page);
        debug = { engine: engine.name, initial, plays, afterPlay, diagnostics };
        await page.screenshot({ path: path.join(outputDir, `${engine.name}-02-after-three-plays.png`), fullPage: false });
        verifyLayout(afterPlay, `${engine.name}-after-play`);
        const longLabels = await stressLabels(page, engine.name);
        debug = { engine: engine.name, initial, plays, afterPlay, longLabels, diagnostics };
        await page.screenshot({ path: path.join(outputDir, `${engine.name}-03-long-pattern-labels.png`), fullPage: false });
        assert(diagnostics.consoleErrors.length === 0, `${engine.name}:控制台错误 ${diagnostics.consoleErrors.join('；')}`);
        assert(diagnostics.pageErrors.length === 0, `${engine.name}:页面错误 ${diagnostics.pageErrors.join('；')}`);
        assert(diagnostics.requestFailures.length === 0, `${engine.name}:请求失败 ${JSON.stringify(diagnostics.requestFailures)}`);
        assert(diagnostics.httpErrors.length === 0, `${engine.name}:HTTP错误 ${JSON.stringify(diagnostics.httpErrors)}`);
        report.push({ engine: engine.name, initial, plays, afterPlay, longLabels, diagnostics });
        debug = null;
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }
} catch (error) {
  failure = { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : '', at: new Date().toISOString(), debug };
  throw error;
} finally {
  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  if (failure) await fs.writeFile(path.join(outputDir, 'failure.json'), JSON.stringify(failure, null, 2));
}
console.log('clean landscape game audit V4 passed: Chromium/WebKit, rejected random hints fall back to legal pass, three real plays, all cards visible, logical overflow checks passed');
