const LANDSCAPE_LAYOUT_RELEASE = 'landscape-r1';
const PORTRAIT_WIDTH_LIMIT = 1100;

function getViewport(target) {
  const viewport = target?.visualViewport;
  return {
    width: Math.round(viewport?.width || target?.innerWidth || 0),
    height: Math.round(viewport?.height || target?.innerHeight || 0),
  };
}

export function shouldRequireLandscape(target = globalThis) {
  const { width, height } = getViewport(target);
  if (!width || !height) return false;
  return height > width && width <= PORTRAIT_WIDTH_LIMIT;
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
    // iOS Safari 和部分内嵌浏览器不支持网页主动全屏，保留手动旋转提示。
  }

  try {
    if (target?.screen?.orientation?.lock) {
      await target.screen.orientation.lock('landscape');
      locked = true;
    }
  } catch {
    // 屏幕方向锁定通常要求全屏或安装为 PWA；失败时让用户手动横置手机。
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
      <p class="landscape-gate-copy">这套牌桌按横屏设计。手机请横过来，电脑请把浏览器窗口拉宽。</p>
      <button type="button" id="henan50k-enter-landscape">进入横屏游戏</button>
      <p id="henan50k-landscape-hint" class="landscape-gate-hint">支持的安卓浏览器会尝试自动全屏并锁定横屏。</p>
    </div>
  `;
  documentObject.body.appendChild(gate);
  return gate;
}

export function installLandscapeMode(target = globalThis) {
  const documentObject = target?.document;
  if (!documentObject?.documentElement || !documentObject.body) return () => {};

  documentObject.documentElement.dataset.layoutMode = LANDSCAPE_LAYOUT_RELEASE;
  const gate = createLandscapeGate(documentObject);
  const button = gate.querySelector('#henan50k-enter-landscape');
  const hint = gate.querySelector('#henan50k-landscape-hint');

  const sync = () => {
    const required = shouldRequireLandscape(target);
    documentObject.body.classList.toggle('landscape-gate-active', required);
    gate.hidden = !required;
    gate.setAttribute('aria-hidden', required ? 'false' : 'true');
  };

  const enterLandscape = async () => {
    button.disabled = true;
    button.textContent = '正在切换横屏…';
    const result = await requestLandscapeMode(target);
    sync();
    if (shouldRequireLandscape(target)) {
      hint.textContent = result.fullscreen
        ? '已进入全屏，请把手机横过来。'
        : '浏览器不能自动旋转，请把手机横过来；电脑请把窗口拉宽。';
      button.textContent = '再次尝试横屏';
      button.disabled = false;
    }
  };

  button.addEventListener('click', enterLandscape);
  target.addEventListener?.('resize', sync);
  target.addEventListener?.('orientationchange', sync);
  target.visualViewport?.addEventListener?.('resize', sync);
  sync();

  return () => {
    button.removeEventListener('click', enterLandscape);
    target.removeEventListener?.('resize', sync);
    target.removeEventListener?.('orientationchange', sync);
    target.visualViewport?.removeEventListener?.('resize', sync);
    gate.remove();
    documentObject.body.classList.remove('landscape-gate-active');
  };
}

export { LANDSCAPE_LAYOUT_RELEASE, PORTRAIT_WIDTH_LIMIT };
