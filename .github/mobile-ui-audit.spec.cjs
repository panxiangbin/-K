const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:10000';
const AUDIT_DIR = process.env.AUDIT_DIR || path.resolve(process.cwd(), 'mobile-audit-output');
fs.mkdirSync(AUDIT_DIR, { recursive: true });

async function collectLayout(page, name) {
  return page.evaluate((auditName) => {
    const visible = (node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const buttons = [...document.querySelectorAll('button')].filter(visible).map((button) => {
      const rect = button.getBoundingClientRect();
      const cx = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const cy = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const topNode = document.elementFromPoint(cx, cy);
      return {
        text: button.textContent.trim().replace(/\s+/g, ' '),
        disabled: button.disabled,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        inViewportX: rect.left >= -1 && rect.right <= innerWidth + 1,
        centerReachable: button.disabled || Boolean(topNode && (topNode === button || button.contains(topNode))),
      };
    });
    return {
      name: auditName,
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1,
      buttons,
    };
  }, name);
}

function assertLayout(layout) {
  expect(layout.horizontalOverflow, `${layout.name} must not horizontally overflow`).toBeFalsy();
  for (const button of layout.buttons) {
    expect(button.inViewportX, `${layout.name}: ${button.text} must stay inside the viewport`).toBeTruthy();
    expect(button.centerReachable, `${layout.name}: ${button.text} must not be covered by another layer`).toBeTruthy();
    expect(button.height, `${layout.name}: ${button.text} touch height`).toBeGreaterThanOrEqual(38);
  }
}

test('390px portrait lobby and game remain operable, then adapt to 844x390 landscape', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.ink-release-badge')).toContainText('新中式墨韵');
  await page.screenshot({ path: path.join(AUDIT_DIR, '390x844-home.png'), fullPage: true });
  const home = await collectLayout(page, '390x844-home');
  assertLayout(home);

  const soloButton = page.getByRole('button', { name: /单机练习/ });
  await expect(soloButton).toBeVisible();
  await soloButton.click();
  await expect(page.getByRole('button', { name: /三人单机/ })).toBeVisible();
  await page.screenshot({ path: path.join(AUDIT_DIR, '390x844-solo-choice.png'), fullPage: true });
  const soloChoice = await collectLayout(page, '390x844-solo-choice');
  assertLayout(soloChoice);

  await page.getByRole('button', { name: /三人单机/ }).click();
  await expect(page.getByText('本轮出牌')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.game-table-shell')).toBeVisible();
  await page.screenshot({ path: path.join(AUDIT_DIR, '390x844-game.png') });
  const portraitGame = await collectLayout(page, '390x844-game');
  assertLayout(portraitGame);

  for (const name of ['理牌', '清空', '提示', '过牌']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /出牌/ })).toBeVisible();

  const arrangeButton = page.getByRole('button', { name: /理牌|还原/ });
  await arrangeButton.click();
  await expect(page.getByRole('button', { name: /还原/ })).toBeVisible();

  const firstCard = page.locator('[data-card-id]').first();
  await expect(firstCard).toBeVisible();
  await firstCard.click();
  await page.screenshot({ path: path.join(AUDIT_DIR, '390x844-card-selected.png') });

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(AUDIT_DIR, '844x390-game.png') });
  const landscapeGame = await collectLayout(page, '844x390-game');
  assertLayout(landscapeGame);

  fs.writeFileSync(path.join(AUDIT_DIR, 'report.json'), JSON.stringify({
    release: documentRelease(await page.locator('html').getAttribute('data-ui-release')),
    consoleErrors,
    layouts: [home, soloChoice, portraitGame, landscapeGame],
  }, null, 2));

  expect(consoleErrors, 'mobile journey must not emit browser errors').toEqual([]);
});

function documentRelease(value) {
  return value || 'unknown';
}

test('430px portrait home keeps primary actions visible and clickable', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.ink-release-badge')).toBeVisible();
  await page.screenshot({ path: path.join(AUDIT_DIR, '430x932-home.png'), fullPage: true });
  const layout = await collectLayout(page, '430x932-home');
  assertLayout(layout);
  await expect(page.getByRole('button', { name: /单机练习/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /创建房间/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /加入房间/ })).toBeVisible();
});
