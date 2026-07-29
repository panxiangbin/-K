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

export function clampHandScroll(surface, startScrollLeft, dx) {
  const maxScrollLeft = Math.max(0, Number(surface?.scrollWidth || 0) - Number(surface?.clientWidth || 0));
  return Math.max(0, Math.min(maxScrollLeft, Number(startScrollLeft || 0) - Number(dx || 0)));
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
  let pointerActive = null;
  let touchActive = null;
  let suppressClickUntil = 0;

  function setScrolling(surface, scrolling) {
    if (!surface) return;
    if (scrolling) surface.dataset.handScrolling = 'true';
    else delete surface.dataset.handScrolling;
  }

  function beginGesture({ surface, x, y, id, inputType }) {
    return {
      id,
      inputType,
      x,
      y,
      surface,
      startScrollLeft: Number(surface.scrollLeft) || 0,
      committed: false,
    };
  }

  function moveGesture(gesture, x, y, event) {
    const dx = x - gesture.x;
    const dy = y - gesture.y;
    const distance = Math.hypot(dx, dy);

    if (!gesture.committed && distance >= SLIDE_INTENT_PX && Math.abs(dx) >= Math.abs(dy)) {
      gesture.committed = true;
      suppressClickUntil = Date.now() + TOUCH_CLICK_SUPPRESSION_MS;
      setScrolling(gesture.surface, true);
    }
    if (!gesture.committed) return false;

    const targetScrollLeft = clampHandScroll(gesture.surface, gesture.startScrollLeft, dx);
    if (Math.abs(gesture.surface.scrollLeft - targetScrollLeft) > 0.5) {
      gesture.surface.scrollLeft = targetScrollLeft;
    }
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }

  function finishGesture(gesture) {
    if (!gesture) return;
    if (gesture.committed) suppressClickUntil = Date.now() + TOUCH_CLICK_SUPPRESSION_MS;
    const surface = gesture.surface;
    setTimeout(() => setScrolling(surface, false), 0);
  }

  const handlePointerDown = event => {
    const card = event.target?.closest?.('[data-card-id]');
    const surface = card?.closest?.('.game-hand-surface');
    if (!card || !surface || event.button > 0) return;
    pointerActive = beginGesture({
      surface,
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      inputType: event.pointerType || 'mouse',
    });
  };

  const handlePointerMove = event => {
    if (!pointerActive || pointerActive.id !== event.pointerId) return;

    if (pointerActive.inputType !== 'mouse') {
      if (!moveGesture(pointerActive, event.clientX, event.clientY, event)) {
        // 阻止 React 在触屏微小移动阶段提前进入连续选牌。
        event.stopImmediatePropagation();
      }
      return;
    }

    const distance = Math.hypot(event.clientX - pointerActive.x, event.clientY - pointerActive.y);
    if (pointerActive.committed) return;
    if (distance >= SLIDE_INTENT_PX) {
      pointerActive.committed = true;
      return;
    }
    event.stopImmediatePropagation();
  };

  const clearPointer = event => {
    if (!pointerActive || (event.pointerId != null && pointerActive.id !== event.pointerId)) return;
    finishGesture(pointerActive.inputType === 'mouse' ? null : pointerActive);
    pointerActive = null;
  };

  const handleTouchStart = event => {
    const touch = event.touches?.[0];
    const card = event.target?.closest?.('[data-card-id]');
    const surface = card?.closest?.('.game-hand-surface');
    if (!touch || !card || !surface || event.touches.length !== 1) return;
    touchActive = beginGesture({
      surface,
      x: touch.clientX,
      y: touch.clientY,
      id: touch.identifier,
      inputType: 'touch',
    });
  };

  const findActiveTouch = event => [...(event.touches || [])].find(touch => touch.identifier === touchActive?.id);

  const handleTouchMove = event => {
    if (!touchActive) return;
    const touch = findActiveTouch(event);
    if (!touch) return;
    if (!moveGesture(touchActive, touch.clientX, touch.clientY, event)) {
      event.stopImmediatePropagation();
    }
  };

  const clearTouch = event => {
    if (!touchActive) return;
    const ended = [...(event.changedTouches || [])].some(touch => touch.identifier === touchActive.id);
    if (!ended && event.touches?.length) return;
    finishGesture(touchActive);
    touchActive = null;
  };

  const handleClick = event => {
    if (Date.now() >= suppressClickUntil) return;
    const card = event.target?.closest?.('[data-card-id]');
    if (!card?.closest?.('.game-hand-surface')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  root.addEventListener('pointerdown', handlePointerDown, true);
  root.addEventListener('pointermove', handlePointerMove, true);
  root.addEventListener('pointerup', clearPointer, true);
  root.addEventListener('pointercancel', clearPointer, true);
  root.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
  root.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
  root.addEventListener('touchend', clearTouch, true);
  root.addEventListener('touchcancel', clearTouch, true);
  root.addEventListener('click', handleClick, true);

  return () => {
    pointerActive = null;
    touchActive = null;
    suppressClickUntil = 0;
    root.removeEventListener('pointerdown', handlePointerDown, true);
    root.removeEventListener('pointermove', handlePointerMove, true);
    root.removeEventListener('pointerup', clearPointer, true);
    root.removeEventListener('pointercancel', clearPointer, true);
    root.removeEventListener('touchstart', handleTouchStart, true);
    root.removeEventListener('touchmove', handleTouchMove, true);
    root.removeEventListener('touchend', clearTouch, true);
    root.removeEventListener('touchcancel', clearTouch, true);
    root.removeEventListener('click', handleClick, true);
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
  const cleanupSlideGuard = installSlideIntentGuard(root);
  return () => {
    observer.disconnect();
    cleanupSlideGuard();
  };
}

export { SLIDE_INTENT_PX, TOUCH_CLICK_SUPPRESSION_MS };
