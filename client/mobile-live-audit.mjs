import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const target = process.env.MOBILE_AUDIT_URL || 'https://henan-50k.onrender.com';
const expectedRelease = process.env.EXPECTED_UI_RELEASE || 'ink-06-mobile-r4';
const outputDir = path.resolve('mobile-audit-artifacts');
const releaseTimeoutMs = Number(process.env.RELEASE_TIMEOUT_MS || 12 * 60 * 1000);

const profiles = [
  { name: 'iphone-390x844', width: 390, height: 844, portrait: true },
  { name: 'android-430x932', width: 430, height: 932, portrait: true },
  { name: 'short-phone-390x700', width: 390, height: 700, portrait: true },
  { name: 'phone-landscape-844x390', width: 844, height: 390, portrait: false },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForRelease(page) {
  const deadline = Date.now() + releaseTimeoutMs;
  let lastRelease = '';
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const cacheBust = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      await page.goto(`${target}/?mobile-audit=${cacheBust}`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await page.waitForSelector('.lobby-shell', { timeout: 30_000 });
      lastRelease = await page.locator('html').getAttribute('data-ui-release') || '';
      if (lastRelease === expectedRelease) return;
      lastError = `线上版本仍为 ${lastRelease || '未标记'}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await page.waitForTimeout(15_000);
  }

  throw new Error(`等待线上版本 ${expectedRelease} 超时。最后状态：${lastError || lastRelease || '未知'}`);
}

async function enterSoloGame(page) {
  const solo = page.getByRole('button', { name: /单机练习/ });
  await solo.waitFor({ state: 'visible', timeout: 30_000 });
  await solo.click();

  const threePlayer = page.getByRole('button', { name: /三人单机/ });
  await threePlayer.waitFor({ state: 'visible', timeout: 10_000 });
  await threePlayer.click();

  await page.waitForSelector('.game-table-shell', { timeout: 90_000 });
  await page.waitForSelector('.game-hand-surface[data-hand-interaction="true"]', { timeout: 20_000 });
  await page.waitForSelector('[data-card-id]', { timeout: 20_000 });
  await page.waitForTimeout(800);
}

async function collectMetrics(page, profile) {
  return page.evaluate(({ portrait }) => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const documentOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const shell = document.querySelector('.game-table-shell');
    const stage = document.querySelector('.game-table-stage');
    const dock = document.querySelector('.game-table-hand-dock');
    const hand = document.querySelector('.game-hand-surface[data-hand-interaction="true"]');
    const cards = [...document.querySelectorAll('[data-card-id]')];
    const actions = [...document.querySelectorAll('.game-hand-actions button')];

    const rectOf = node => {
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };

    const actionMetrics = actions.map(button => {
      const rect = button.getBoundingClientRect();
      const centerX = Math.min(viewport.width - 1, Math.max(0, rect.left + rect.width / 2));
      const centerY = Math.min(viewport.height - 1, Math.max(0, rect.top + rect.height / 2));
      const hit = document.elementFromPoint(centerX, centerY);
      return {
        text: button.textContent?.trim() || '',
        disabled: button.disabled,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        covered: Boolean(hit && hit !== button && !button.contains(hit)),
      };
    });

    const actionRows = [...new Set(actionMetrics.map(item => Math.round(item.top / 4) * 4))];
    const handStyle = hand ? getComputedStyle(hand) : null;

    return {
      portrait,
      viewport,
      documentOverflow,
      release: document.documentElement.dataset.uiRelease || '',
      cardCount: cards.length,
      shell: rectOf(shell),
      stage: rectOf(stage),
      dock: rectOf(dock),
      hand: hand ? {
        ...rectOf(hand),
        clientWidth: hand.clientWidth,
        scrollWidth: hand.scrollWidth,
        scrollLeft: hand.scrollLeft,
        overflowX: handStyle?.overflowX,
        touchAction: handStyle?.touchAction,
      } : null,
      actionRows,
      actions: actionMetrics,
    };
  }, { portrait: profile.portrait });
}

function validateMetrics(metrics, profile) {
  assert(metrics.release === expectedRelease, `${profile.name}: 页面版本不是 ${expectedRelease}`);
  assert(metrics.documentOverflow <= 2, `${profile.name}: 页面横向溢出 ${metrics.documentOverflow}px`);
  assert(metrics.cardCount > 0, `${profile.name}: 没有渲染手牌`);
  assert(metrics.shell && metrics.stage && metrics.dock, `${profile.name}: 牌桌三段布局不完整`);
  assert(metrics.hand, `${profile.name}: 找不到可操作手牌容器`);
  assert(metrics.actions.length >= 5, `${profile.name}: 手牌操作按钮不足5个`);
  assert(metrics.shell.bottom <= metrics.viewport.height + 2, `${profile.name}: 整个牌桌超出可视高度`);
  assert(metrics.dock.bottom <= metrics.viewport.height + 2, `${profile.name}: 底部操作区被浏览器裁掉`);
  assert(metrics.stage.bottom <= metrics.dock.top + 2, `${profile.name}: 牌桌与底部操作区发生重叠`);

  for (const action of metrics.actions) {
    assert(action.left >= -1 && action.right <= metrics.viewport.width + 1, `${profile.name}: “${action.text}”横向越界`);
    assert(action.top >= -1 && action.bottom <= metrics.viewport.height + 1, `${profile.name}: “${action.text}”纵向越界`);
    assert(action.height >= (profile.portrait ? 42 : 38), `${profile.name}: “${action.text}”触控高度只有${action.height}px`);
    assert(!action.covered, `${profile.name}: “${action.text}”中心点被其他元素遮挡`);
  }

  if (profile.portrait) {
    assert(metrics.hand.overflowX === 'auto' || metrics.hand.overflowX === 'scroll', `${profile.name}: 手牌没有横向滚动能力`);
    assert(metrics.hand.touchAction.includes('pan-x'), `${profile.name}: 手牌未保留横向触控手势`);
    assert(metrics.hand.scrollWidth > metrics.hand.clientWidth, `${profile.name}: 多张手牌没有形成可横滑区域`);
    assert(metrics.actionRows.length >= 2, `${profile.name}: 五个操作仍被挤在同一排`);
  }
}

async function verifyTouchSwipeDoesNotSelect(page, profile) {
  if (!profile.portrait) return;
  const hand = page.locator('.game-hand-surface[data-hand-interaction="true"]');
  const box = await hand.boundingBox();
  assert(box, `${profile.name}: 无法取得手牌触控区域`);
  const before = await hand.evaluate(node => ({ scrollLeft: node.scrollLeft, selected: node.querySelectorAll('[aria-pressed="true"]').length }));
  assert(before.selected === 0, `${profile.name}: 滑动测试前已有意外选牌`);

  const session = await page.context().newCDPSession(page);
  const startX = box.x + box.width * 0.80;
  const endX = box.x + box.width * 0.22;
  const y = box.y + box.height * 0.56;
  const point = (x, id = 1) => ({ x, y, radiusX: 2, radiusY: 2, force: 1, id });

  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(startX)] });
  for (let step = 1; step <= 8; step += 1) {
    const x = startX + (endX - startX) * (step / 8);
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(x)] });
    await page.waitForTimeout(20);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(500);

  const after = await hand.evaluate(node => ({
    scrollLeft: node.scrollLeft,
    selected: node.querySelectorAll('[aria-pressed="true"]').length,
    scrolling: node.dataset.handScrolling || '',
  }));
  assert(after.scrollLeft > before.scrollLeft, `${profile.name}: 真实触屏滑动没有移动手牌`);
  assert(after.selected === 0, `${profile.name}: 横向滑手牌后误选了牌`);
  assert(after.scrolling === '', `${profile.name}: 滑动结束后仍残留滚动状态`);
}

async function verifyCardTap(page, profile) {
  const firstCard = page.locator('[data-card-id]').first();
  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.click();
  await page.waitForFunction(() => document.querySelector('[data-card-id]')?.getAttribute('aria-pressed') === 'true');
  const selected = await page.locator('[data-card-id][aria-pressed="true"]').count();
  assert(selected >= 1, `${profile.name}: 轻点手牌没有选中`);
}

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];

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
    const consoleErrors = [];
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', error => consoleErrors.push(error.message));

    await waitForRelease(page);
    await page.screenshot({ path: path.join(outputDir, `${profile.name}-lobby.png`), fullPage: true });
    await enterSoloGame(page);

    const metrics = await collectMetrics(page, profile);
    validateMetrics(metrics, profile);
    await verifyTouchSwipeDoesNotSelect(page, profile);
    await verifyCardTap(page, profile);
    await page.screenshot({ path: path.join(outputDir, `${profile.name}-game.png`), fullPage: true });

    report.push({ ...profile, metrics, consoleErrors });
    await context.close();
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
}

console.log(`mobile live audit passed for ${profiles.length} viewports at ${expectedRelease}`);
