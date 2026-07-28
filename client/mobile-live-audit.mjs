import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const target = process.env.MOBILE_AUDIT_URL || 'https://henan-50k.onrender.com';
const expectedRelease = process.env.EXPECTED_UI_RELEASE || 'ink-06-mobile-r3';
const outputDir = path.resolve('mobile-audit-artifacts');
const releaseTimeoutMs = Number(process.env.RELEASE_TIMEOUT_MS || 12 * 60 * 1000);

const profiles = [
  { name: 'iphone-390x844', width: 390, height: 844, portrait: true },
  { name: 'android-430x932', width: 430, height: 932, portrait: true },
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
    const hand = document.querySelector('.game-hand-surface[data-hand-interaction="true"]');
    const cards = [...document.querySelectorAll('[data-card-id]')];
    const actions = [...document.querySelectorAll('.game-hand-actions button')];

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
      hand: hand ? {
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
  assert(metrics.hand, `${profile.name}: 找不到可操作手牌容器`);
  assert(metrics.actions.length >= 5, `${profile.name}: 手牌操作按钮不足5个`);

  for (const action of metrics.actions) {
    assert(action.left >= -1 && action.right <= metrics.viewport.width + 1, `${profile.name}: “${action.text}”横向越界`);
    assert(action.top >= -1 && action.bottom <= metrics.viewport.height + 1, `${profile.name}: “${action.text}”纵向越界`);
    assert(action.height >= (profile.portrait ? 44 : 38), `${profile.name}: “${action.text}”触控高度只有${action.height}px`);
    assert(!action.covered, `${profile.name}: “${action.text}”中心点被其他元素遮挡`);
  }

  if (profile.portrait) {
    assert(metrics.hand.overflowX === 'auto' || metrics.hand.overflowX === 'scroll', `${profile.name}: 手牌没有横向滚动能力`);
    assert(metrics.hand.touchAction.includes('pan-x'), `${profile.name}: 手牌未保留横向触控手势`);
    assert(metrics.hand.scrollWidth > metrics.hand.clientWidth, `${profile.name}: 多张手牌没有形成可横滑区域`);
    assert(metrics.actionRows.length >= 2, `${profile.name}: 五个操作仍被挤在同一排`);
  }
}

async function verifyCardTapAndScroll(page, profile) {
  const firstCard = page.locator('[data-card-id]').first();
  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.click();
  await page.waitForFunction(() => document.querySelector('[data-card-id]')?.getAttribute('aria-pressed') === 'true');

  if (profile.portrait) {
    const movement = await page.locator('.game-hand-surface[data-hand-interaction="true"]').evaluate(hand => {
      const before = hand.scrollLeft;
      hand.scrollTo({ left: hand.scrollWidth, behavior: 'instant' });
      return { before, after: hand.scrollLeft, max: hand.scrollWidth - hand.clientWidth };
    });
    assert(movement.max > 0 && movement.after > movement.before, `${profile.name}: 手牌无法实际横向移动`);
  }
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
    await verifyCardTapAndScroll(page, profile);
    await page.screenshot({ path: path.join(outputDir, `${profile.name}-game.png`), fullPage: true });

    report.push({ ...profile, metrics, consoleErrors });
    await context.close();
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
}

console.log(`mobile live audit passed for ${profiles.length} viewports at ${expectedRelease}`);
