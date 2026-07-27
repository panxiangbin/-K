export const MAX_VISIBLE_TOASTS = 3;
export const MAX_VISIBLE_GAME_TOASTS = 2;
export const PASS_TOAST_WINDOW_MS = 2200;

export function normalizeToastText(text) {
  return String(text || '').replace(/^[\s⚠💥🪙🏁🎮✅❌ℹ]+/u, '').replace(/\s+/g, ' ').trim();
}

export function isPassToast(text) {
  return /\s过牌$/.test(normalizeToastText(text));
}

export function getToastTone(text, type = '') {
  const normalized = normalizeToastText(text);
  if (type === 'error' || /断开|连接失败|超时|不存在|已满|非法|不能|必须|失败/.test(normalized)) return 'error';
  if (/正在连接|正在恢复|服务器正在启动|请稍候|处理中/.test(normalized)) return 'connection';
  if (type === 'bomb' || /炸弹/.test(normalized)) return 'special';
  if (type === 'gold' || /\+\d+分|第\d+名|出完/.test(normalized)) return 'score';
  if (type === 'success' || /成功|已复制|已连接|网络已恢复/.test(normalized)) return 'success';
  if (/警告|注意|还差|等待时间较长/.test(normalized)) return 'warning';
  if (isPassToast(normalized) || type === 'dim') return 'quiet';
  return 'info';
}

export function getToastPriority(text, type = '') {
  const tone = getToastTone(text, type);
  return { error: 6, connection: 5, special: 4, score: 3, warning: 3, success: 2, info: 1, quiet: 0 }[tone];
}

export function chooseVisibleToastIndexes(items = [], maxVisible = MAX_VISIBLE_TOASTS) {
  const safeMax = Math.max(1, Number(maxVisible) || MAX_VISIBLE_TOASTS);
  return items
    .map((item, index) => ({ index, priority: getToastPriority(item?.text, item?.type), order: index }))
    .sort((a, b) => b.priority - a.priority || b.order - a.order)
    .slice(0, safeMax)
    .map(item => item.index)
    .sort((a, b) => a - b);
}

function findToastContainer(documentObject) {
  return [...documentObject.querySelectorAll('div')].find(node => {
    const style = node.style;
    return style?.position === 'fixed' && style?.zIndex === '999' && style?.pointerEvents === 'none';
  }) || null;
}

function setIfChanged(node, name, value) {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function decorateToast(node) {
  const original = node.dataset.originalToastText || node.textContent;
  if (!node.dataset.originalToastText) node.dataset.originalToastText = original;
  const tone = getToastTone(original, node.dataset.toastType || '');
  node.dataset.feedbackTone = tone;
  node.classList.add('governed-toast');
  setIfChanged(node, 'aria-atomic', 'true');
  if (tone === 'error') {
    setIfChanged(node, 'role', 'alert');
    node.removeAttribute('aria-live');
  } else {
    setIfChanged(node, 'role', 'status');
    setIfChanged(node, 'aria-live', 'polite');
  }
}

function applyToastPolicy(container, documentObject) {
  const nodes = [...container.children];
  if (!nodes.length) return;

  nodes.forEach(node => {
    const original = node.dataset.originalToastText;
    if (original) node.textContent = original;
    node.hidden = false;
    decorateToast(node);
  });

  const passNodes = nodes.filter(node => isPassToast(node.dataset.originalToastText || node.textContent));
  if (passNodes.length > 1) {
    passNodes.slice(0, -1).forEach(node => { node.hidden = true; });
    const latest = passNodes.at(-1);
    if (!latest.dataset.originalToastText) latest.dataset.originalToastText = latest.textContent;
    latest.textContent = `连续${passNodes.length}人过牌`;
    latest.setAttribute('aria-label', `${passNodes.length}名玩家连续过牌`);
    latest.dataset.feedbackTone = 'quiet';
  }

  const candidates = nodes.filter(node => !node.hidden);
  const gameActive = Boolean(documentObject.querySelector('.game-table-shell'));
  const maxVisible = gameActive ? MAX_VISIBLE_GAME_TOASTS : MAX_VISIBLE_TOASTS;
  const visibleIndexes = new Set(chooseVisibleToastIndexes(candidates.map(node => ({
    text: node.dataset.originalToastText || node.textContent,
    type: node.dataset.toastType || '',
  })), maxVisible));
  candidates.forEach((node, index) => { node.hidden = !visibleIndexes.has(index); });

  container.dataset.feedbackGoverned = 'true';
  container.dataset.feedbackSurface = gameActive ? 'game' : 'general';
  container.classList.add('governed-toast-stack');
  container.setAttribute('aria-label', '游戏状态提示');
  container.setAttribute('aria-live', 'off');
  container.setAttribute('aria-relevant', 'additions text');
}

export function installUiFeedbackGovernor({ documentObject = globalThis.document, MutationObserverClass = globalThis.MutationObserver } = {}) {
  if (!documentObject?.body || !MutationObserverClass) return () => {};
  let toastObserver = null;
  let currentContainer = null;

  const attach = () => {
    const container = findToastContainer(documentObject);
    if (!container) return;
    if (container !== currentContainer) {
      toastObserver?.disconnect();
      currentContainer = container;
      toastObserver = new MutationObserverClass(() => applyToastPolicy(container, documentObject));
      toastObserver.observe(container, { childList: true, subtree: true, characterData: true });
    }
    applyToastPolicy(container, documentObject);
  };

  const rootObserver = new MutationObserverClass(attach);
  rootObserver.observe(documentObject.body, { childList: true, subtree: true });
  attach();
  return () => {
    rootObserver.disconnect();
    toastObserver?.disconnect();
  };
}
