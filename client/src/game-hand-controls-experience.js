const SLIDE_INTENT_PX = 9;

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
    handSurface.setAttribute('aria-description', '轻点单张牌选择；横向滑动超过一定距离后才会连续选择，避免手指轻微抖动误选。');
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

  root.addEventListener('pointerdown', event => {
    const card = event.target?.closest?.('[data-card-id]');
    const surface = card?.closest?.('.game-hand-surface');
    if (!card || !surface || event.button > 0) return;
    active = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      committed: false,
    };
  }, true);

  root.addEventListener('pointermove', event => {
    if (!active || active.pointerId !== event.pointerId || active.committed) return;
    const distance = Math.hypot(event.clientX - active.x, event.clientY - active.y);
    if (distance >= SLIDE_INTENT_PX) {
      active.committed = true;
      return;
    }
    event.stopImmediatePropagation();
  }, true);

  const clear = event => {
    if (!active || (event.pointerId != null && active.pointerId !== event.pointerId)) return;
    active = null;
  };
  root.addEventListener('pointerup', clear, true);
  root.addEventListener('pointercancel', clear, true);

  return () => {
    active = null;
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

export { SLIDE_INTENT_PX };
