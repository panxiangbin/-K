function normalizeText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

export function getParentSiteUrl(locationObject = globalThis.location) {
  try {
    const href = locationObject?.href || '/';
    return new URL('../', href).href;
  } catch {
    return '/';
  }
}

export function isLobbyHome(panel) {
  const title = panel?.querySelector?.('.lobby-view-heading h2');
  return normalizeText(title?.textContent) === '选一种方式，马上开局';
}

function makeButton({ text, className, ariaLabel, onClick }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.setAttribute('aria-label', ariaLabel);
  button.addEventListener('click', onClick);
  return button;
}

function returnToPreviousPage() {
  if (globalThis.history?.length > 1) {
    globalThis.history.back();
    return;
  }
  globalThis.location?.assign?.(getParentSiteUrl());
}

function exitGameSite() {
  globalThis.location?.assign?.(getParentSiteUrl());
}

export function syncLobbyHomeControls(root = document) {
  const existing = root.querySelector?.('.lobby-home-controls');
  const panel = root.querySelector?.('.lobby-shell .lobby-panel');

  if (!panel || !isLobbyHome(panel)) {
    existing?.remove();
    return false;
  }

  if (existing?.isConnected) return true;

  const controls = document.createElement('nav');
  controls.className = 'lobby-home-controls';
  controls.setAttribute('aria-label', '首页导航');

  controls.append(
    makeButton({
      text: '返回',
      className: 'lobby-home-control lobby-home-control--back',
      ariaLabel: '返回上一页',
      onClick: returnToPreviousPage,
    }),
    makeButton({
      text: '退出',
      className: 'lobby-home-control lobby-home-control--exit',
      ariaLabel: '退出五十K并返回网站首页',
      onClick: exitGameSite,
    }),
  );

  // React only owns #root. Mounting this navigation directly under body avoids
  // reconciliation errors when Lobby changes between home/solo/room views.
  root.body?.appendChild(controls);
  return controls.isConnected;
}

export function installLobbyHomeControls(root = document) {
  let queued = false;
  const scan = () => {
    queued = false;
    syncLobbyHomeControls(root);
  };
  const queueScan = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(scan);
  };

  scan();
  const observer = new MutationObserver(queueScan);
  observer.observe(root.documentElement || root, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  return () => {
    observer.disconnect();
    root.querySelector?.('.lobby-home-controls')?.remove();
  };
}
