const LANDSCAPE_LAYOUT_RELEASE = 'landscape-r2';
const PORTRAIT_WIDTH_LIMIT = 1100;
const FORCE_LANDSCAPE_DELAY_MS = 650;

function getViewport(target) {
  const viewport = target?.visualViewport;
  return {
    width: Math.round(viewport?.width || target?.innerWidth || 0),
    height: Math.round(viewport?.height || target?.innerHeight || 0),
  };
}

function getOrientationAngle(target) {
  const modernAngle = Number(target?.screen?.orientation?.angle);
  if (Number.isFinite(modernAngle)) return modernAngle;
  const legacyAngle = Number(target?.orientation);
  return Number.isFinite(legacyAngle) ? legacyAngle : 0;
}

export function isNativeLandscape(target = globalThis) {
  const { width, height } = getViewport(target);
  const mediaLandscape = target?.matchMedia?.('(orientation: landscape)')?.matches === true;
  const angle = Math.abs(getOrientationAngle(target)) % 180;
  return mediaLandscape || angle === 90 || (width > 0 && height > 0 && width > height);
}

export function shouldRequireLandscape(target = globalThis) {
  const { width, height } = getViewport(target);
  if (!width || !height || isNativeLandscape(target)) return false;
  return height >= width && width <= PORTRAIT_WIDTH_LIMIT;
}

export async function requestLandscapeMode(target = globalThis) {
  const documentObject = target?.document;
  let fullscreen = false;
  let locked = false;

  try {
    if (documentObject?.documentElement?.requestFullscreen && !documentObject.fullscreenElement) {
      await documentObject.documentElement.requestFullscreen({ navigationUI: 'hide' });
      fullscreen = true;
    }
  } catch {
    // Safari、Edge 内嵌页及部分安卓浏览器可能拒绝网页全屏，后续自动使用兼容横屏。
  }

  try {
    if (target?.screen?.orientation?.lock) {
      await target.screen.orientation.lock('landscape');
      locked = true;
    }
  } catch {
    // 普通网页通常无权锁定方向，后续自动使用 CSS 兼容横屏。
  }

  return { fullscreen, locked };
}

function createLandscapeGate(documentObject) {
  const existing = documentObject.getElementById('henan50k-landscape-gate');
  if (existing) return existing;

  const gate = documentObject.createElement('section');
  gate.id = 'henan50k-landscape-gate';
  gate.setAttribute('role', 'dialog');
  gate.setAttribute('aria-modal', 'true');
  gate.setAttribute('aria-labelledby', 'henan50k-landscape-title');
  gate.innerHTML = `
    <div class="landscape-gate-card">
      <div class="landscape-phone-icon" aria-hidden="true">
        <span class="landscape-phone-screen"></span>
      </div>
      <p class="landscape-gate-kicker">河南五十K · 横屏牌桌</p>
      <h1 id="henan50k-landscape-title">请横屏使用</h1>
      <p class="landscape-gate-copy">先把手机横过来。仍然没有变化时，点下面按钮，页面会直接切成兼容横屏。</p>
      <button type="button" id="henan50k-enter-landscape">直接进入横屏</button>
      <p id="henan50k-landscape-hint" class="landscape-gate-hint">无需依赖手机自动旋转；浏览器不支持时会自动启用兼容横屏。</p>
    </div>
  `;
  documentObject.body.appendChild(gate);
  return gate;
}

function applyViewportVars(documentObject, target, forced) {
  const viewport = getViewport(target);
  const width = forced && viewport.height > viewport.width ? viewport.height : viewport.width;
  const height = forced && viewport.height > viewport.width ? viewport.width : viewport.height;
  const style = documentObject.documentElement.style;
  style.setProperty('--app-width', `${width}px`);
  style.setProperty('--app-height', `${height}px`);
  style.setProperty('--forced-landscape-width', `${width}px`);
  style.setProperty('--forced-landscape-height', `${height}px`);
}

export function installLandscapeMode(target = globalThis) {
  const documentObject = target?.document;
  if (!documentObject?.documentElement || !documentObject.body) return () => {};

  documentObject.documentElement.dataset.layoutMode = LANDSCAPE_LAYOUT_RELEASE;
  const gate = createLandscapeGate(documentObject);
  const button = gate.querySelector('#henan50k-enter-landscape');
  const hint = gate.querySelector('#henan50k-landscape-hint');
  const orientationMedia = target.matchMedia?.('(orientation: landscape)');
  const timers = new Set();
  let forced = false;

  const sync = () => {
    const nativeLandscape = isNativeLandscape(target);
    if (nativeLandscape) forced = false;
    const required = shouldRequireLandscape(target);
    const forcedActive = forced && required;
    const gateActive = required && !forcedActive;

    documentObject.body.classList.toggle('force-landscape-active', forcedActive);
    documentObject.body.classList.toggle('landscape-gate-active', gateActive);
    documentObject.documentElement.dataset.landscapePresentation = nativeLandscape
      ? 'native'
      : forcedActive
        ? 'forced'
        : gateActive
          ? 'gate'
          : 'desktop';
    gate.hidden = !gateActive;
    gate.setAttribute('aria-hidden', gateActive ? 'false' : 'true');
    applyViewportVars(documentObject, target, forcedActive);
  };

  const scheduleSync = () => {
    sync();
    for (const delay of [80, 250, 600, 1200]) {
      const timer = target.setTimeout?.(() => {
        timers.delete(timer);
        sync();
      }, delay);
      if (timer != null) timers.add(timer);
    }
  };

  const enterLandscape = async () => {
    button.disabled = true;
    button.textContent = '正在进入横屏…';
    const result = await requestLandscapeMode(target);
    await new Promise(resolve => target.setTimeout?.(resolve, FORCE_LANDSCAPE_DELAY_MS) ?? resolve());

    if (!isNativeLandscape(target) && shouldRequireLandscape(target)) {
      forced = true;
      hint.textContent = '已启用兼容横屏。请把手机向左横放，即可正常操作。';
    } else {
      hint.textContent = result.locked ? '已进入系统横屏。' : '已检测到手机横屏。';
    }

    button.textContent = '直接进入横屏';
    button.disabled = false;
    scheduleSync();
  };

  button.addEventListener('click', enterLandscape);
  target.addEventListener?.('resize', scheduleSync);
  target.addEventListener?.('orientationchange', scheduleSync);
  target.visualViewport?.addEventListener?.('resize', scheduleSync);
  orientationMedia?.addEventListener?.('change', scheduleSync);
  scheduleSync();

  return () => {
    button.removeEventListener('click', enterLandscape);
    target.removeEventListener?.('resize', scheduleSync);
    target.removeEventListener?.('orientationchange', scheduleSync);
    target.visualViewport?.removeEventListener?.('resize', scheduleSync);
    orientationMedia?.removeEventListener?.('change', scheduleSync);
    for (const timer of timers) target.clearTimeout?.(timer);
    timers.clear();
    gate.remove();
    documentObject.body.classList.remove('landscape-gate-active', 'force-landscape-active');
    delete documentObject.documentElement.dataset.landscapePresentation;
  };
}

export { FORCE_LANDSCAPE_DELAY_MS, LANDSCAPE_LAYOUT_RELEASE, PORTRAIT_WIDTH_LIMIT };