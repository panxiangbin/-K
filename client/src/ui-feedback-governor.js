export const MAX_VISIBLE_TOASTS = 3;
export const PASS_TOAST_WINDOW_MS = 2200;

export function normalizeToastText(text) {
  return String(text || '').replace(/^[\s⚠💥🪙🏁🎮]+/u, '').replace(/\s+/g, ' ').trim();
}

export function isPassToast(text) {
  return /过牌$/.test(normalizeToastText(text));
}

export function getToastPriority(text, type = '') {
  const normalized = normalizeToastText(text);
  if (type === 'error' || /失败|断开|非法|不能|必须|超时|不存在|已满/.test(normalized)) return 5;
  if (type === 'bomb' || /炸弹/.test(normalized)) return 4;
  if (type === 'gold' || /\+\d+分|第\d+名|出完/.test(normalized)) return 3;
  if (type === 'success') return 2;
  if (isPassToast(normalized) || type === 'dim') return 0;
  return 1;
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

function applyToastPolicy(container) {
  const nodes = [...container.children];
  if (!nodes.length) return;

  const passNodes = nodes.filter(node => isPassToast(node.textContent));
  passNodes.forEach(node => {
    node.hidden = false;
    const original = node.dataset.originalToastText;
    if (original) node.textContent = original;
  });
  if (passNodes.length > 1) {
    passNodes.slice(0, -1).forEach(node => { node.hidden = true; });
    const latest = passNodes.at(-1);
    if (!latest.dataset.originalToastText) latest.dataset.originalToastText = latest.textContent;
    latest.textContent = `连续${passNodes.length}人过牌`;
    latest.setAttribute('aria-label', `${passNodes.length}名玩家连续过牌`);
  }

  const candidates = nodes.filter(node => !node.hidden);
  const visibleIndexes = new Set(chooseVisibleToastIndexes(candidates.map(node => ({ text: node.textContent }))));
  candidates.forEach((node, index) => { node.hidden = !visibleIndexes.has(index); });
  container.dataset.feedbackGoverned = 'true';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-relevant', 'additions text');
}

export function installUiFeedbackGovernor({ documentObject = globalThis.document, MutationObserverClass = globalThis.MutationObserver } = {}) {
  if (!documentObject?.body || !MutationObserverClass) return () => {};
  let toastObserver = null;
  let currentContainer = null;

  const attach = () => {
    const container = findToastContainer(documentObject);
    if (!container || container === currentContainer) return;
    toastObserver?.disconnect();
    currentContainer = container;
    applyToastPolicy(container);
    toastObserver = new MutationObserverClass(() => applyToastPolicy(container));
    toastObserver.observe(container, { childList: true, subtree: true, characterData: true });
  };

  const rootObserver = new MutationObserverClass(attach);
  rootObserver.observe(documentObject.body, { childList: true, subtree: true });
  attach();
  return () => {
    rootObserver.disconnect();
    toastObserver?.disconnect();
  };
}
