export const INK_THEME_ID = 'ink-06';
export const INK_THEME_RELEASE = 'ink-06-r2';

function ensureReleaseBadge(documentObject) {
  const brand = documentObject?.querySelector?.('.lobby-brand');
  if (!brand || brand.querySelector('.ink-release-badge')) return false;
  const badge = documentObject.createElement('span');
  badge.className = 'ink-release-badge';
  badge.textContent = '新中式墨韵 · 06';
  badge.setAttribute('aria-label', '当前界面主题：新中式墨韵06号');
  brand.appendChild(badge);
  return true;
}

export function applyInkThemeRelease(documentObject = globalThis.document) {
  if (!documentObject?.documentElement) return false;
  documentObject.documentElement.dataset.uiTheme = INK_THEME_ID;
  documentObject.documentElement.dataset.uiRelease = INK_THEME_RELEASE;
  ensureReleaseBadge(documentObject);
  documentObject.querySelector?.('.game-table-shell')?.setAttribute('data-ui-release', INK_THEME_RELEASE);
  documentObject.querySelector?.('.settlement-experience')?.setAttribute('data-ui-release', INK_THEME_RELEASE);
  return true;
}

export function installInkThemeRelease({ documentObject = globalThis.document, MutationObserverClass = globalThis.MutationObserver } = {}) {
  if (!documentObject?.documentElement) return { disconnect() {} };
  applyInkThemeRelease(documentObject);
  const root = documentObject.getElementById?.('root');
  if (!root || typeof MutationObserverClass !== 'function') return { disconnect() {} };

  const observer = new MutationObserverClass(() => applyInkThemeRelease(documentObject));
  observer.observe(root, { childList: true, subtree: true });
  return observer;
}
