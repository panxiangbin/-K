const SLIDE_INTENT_PX = 9;
const TOUCH_CLICK_SUPPRESSION_MS = 420;

function findHandSurface(actionBar) {
  const dock = actionBar?.parentElement;
  if (!dock) return null;
  return [...dock.children].find(child => child.querySelector?.('[data-card-id]')) || null;
}

function findSelectionStatus(actionBar, handSurface) {
  const dock = actionBar?.parentElement;
  if (!dock || !handSurface) return null;
  const children = [...dock.children];
  const handIndex = children.indexOf(handSurface);
  for (let index = handIndex - 1; index >= 0; index--) {
    const candidate = children[index];
    if (candidate.textContent?.trim()) return candidate;
  }
  return null;
}

export function enhanceGameHandControls(root = document) {
  const playButton = root.querySelector?.('.btn-play');
  const actionBar = playButton?.parentElement;
  if (!playButton || !actionBar) return false;

  actionBar.classList.add('game-hand-actions');
  actionBar.setAttribute('role', 'group');
  actionBar.setAttribute('aria-label', '手牌操作');

  const legend = actionBar.firstElementChild;
  if (legend && !legend.matches('button')) {
    legend.classList.add('game-hand-sort-legend');
    legend.setAttribute('aria-hidden', 'true');
  }

  actionBar.querySelectorAll('button').forEach(button => {
    button.classList.add('game-hand-action');
    if (button.classList.contains('btn-play')) button.dataset.actionPriority = 'primary';
    else if (button.classList.contains('btn-pass')) button.dataset.actionPriority = 'secondary';
    else button.dataset.actionPriority = 'utility';
  });

  const handSurface = findHandSurface(actionBar);
  if (handSurface) {
    handSurface.classList.add('game-hand-surface');
    handSurface.dataset.slideIntent = String(SLIDE_INTENT_PX);
    handSurface.setAttribute('aria-description', '手机上轻点选牌、左右滑动查看全部手牌；鼠标可按住横向拖动连续选择。');
  }

  const status = findSelectionStatus(actionBar, handSurface);
  if (status) {
    status.classList.add('game-hand-selection-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
  }

  return true;
}

export function installSlideIntentGuard(root = document) {
  let active = null;
  let suppressClickUntil = 0;

  function setScrolling(surface, scrolling) {
    if (!surface) return;
    if (scrolling) surface.dataset.handScrolling = 'true';
    else delete surface.dataset.handScrolling;
  }

  root.addEventListener('pointerdown', event => {
    const card = event.target?.closest?.('[data-card-id]');
    const surface = card?.closest?.('.game-hand-surface');
    if (!card || !surface || event.button > 0) return;
    active = {
      pointerId: event.pointerId,
      pointerType: event.pointerType || 'mouse',
      x: event.clientX,
      y: event.clientY,
      surface,
      committed: false,
    };
  }, true);

  root.addEventListener('pointermove', event => {
    if (!active || active.pointerId !== event.pointerId) return;

    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    const distance = Math.hypot(dx, dy);

    if (active.pointerType !== 'mouse') {
      if (!active.committed && distance >= SLIDE_INTENT_PX && Math.abs(dx) >= Math.abs(dy)) {
        active.committed = true;
        suppressClickUntil = Date.now() + TOUCH_CLICK_SUPPRESSION_MS;
        setScrolling(active.surface, true);
      }
      // 不取消浏览器默认行为，让 touch-action: pan-x 承担真实横向滚动；
      // 这里只阻止 React 的连续选牌逻辑收到触屏移动事件。
      event.stopImmediatePropagation();
      return;
    }

    if (active.committed) return;
    if (distance >= SLIDE_INTENT_PX) {
      active.committed = true;
      return;
    }
    event.stopImmediatePropagation();
  }, true);

  const clear = event => {
    if (!active || (event.pointerId != null && active.pointerId !== event.pointerId)) return;
    if (active.committed && active.pointerType !== 'mouse') {
      suppressClickUntil = Date.now() + TOUCH_CLICK_SUPPRESSION_MS;
    }
    const surface = active.surface;
    active = null;
    setTimeout(() => setScrolling(surface, false), 0);
  };
  root.addEventListener('pointerup', clear, true);
  root.addEventListener('pointercancel', clear, true);

  root.addEventListener('click', event => {
    if (Date.now() >= suppressClickUntil) return;
    const card = event.target?.closest?.('[data-card-id]');
    if (!card?.closest?.('.game-hand-surface')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  return () => {
    active = null;
    suppressClickUntil = 0;
  };
}

export function installGameHandControlsExperience(root = document) {
  let queued = false;
  const scan = () => {
    queued = false;
    enhanceGameHandControls(root);
  };
  const queueScan = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(scan);
  };

  scan();
  const observer = new MutationObserver(queueScan);
  observer.observe(root.documentElement || root, { childList: true, subtree: true });
  installSlideIntentGuard(root);
  return () => observer.disconnect();
}

export { SLIDE_INTENT_PX, TOUCH_CLICK_SUPPRESSION_MS };
