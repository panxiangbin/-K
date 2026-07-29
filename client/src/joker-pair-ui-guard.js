const CARD_SELECTOR = '[data-card-id][aria-pressed="true"]';
const PLAY_SELECTOR = '.btn-play';
const STATUS_SELECTOR = '.game-hand-selection-status';
const BLOCKED_ATTR = 'data-joker-pair-blocked';

function cardText(node) {
  return `${node?.getAttribute?.('aria-label') || ''} ${node?.textContent || ''}`.replace(/\s+/g, ' ').trim();
}

export function isJokerCardNode(node) {
  return /小王|大王/.test(cardText(node));
}

export function hasForbiddenJokerPair(root = document) {
  const selected = [...(root.querySelectorAll?.(CARD_SELECTOR) || [])];
  return selected.length === 2 && selected.some(isJokerCardNode);
}

function setStatus(root, blocked) {
  const play = root.querySelector?.(PLAY_SELECTOR);
  const status = root.querySelector?.(STATUS_SELECTOR);
  const hand = root.querySelector?.('.game-hand-surface[data-hand-interaction="true"]');
  if (!play) return false;

  if (blocked) {
    play.disabled = true;
    play.setAttribute('aria-disabled', 'true');
    play.setAttribute('data-disabled-reason', '王不能组成普通对子，请重新选牌。');
    hand?.setAttribute(BLOCKED_ATTR, 'true');
    if (status && status.textContent !== '王不能组成普通对子，请重新选牌。') {
      status.textContent = '王不能组成普通对子，请重新选牌。';
    }
  } else {
    play.removeAttribute('aria-disabled');
    if (play.getAttribute('data-disabled-reason') === '王不能组成普通对子，请重新选牌。') {
      play.removeAttribute('data-disabled-reason');
    }
    hand?.removeAttribute(BLOCKED_ATTR);
  }
  return blocked;
}

export function installJokerPairUiGuard(root = document) {
  let scheduled = false;
  const refresh = () => {
    scheduled = false;
    setStatus(root, hasForbiddenJokerPair(root));
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(refresh);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(root.documentElement || root.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-pressed'],
  });
  root.addEventListener('click', event => {
    const play = event.target?.closest?.(PLAY_SELECTOR);
    if (!play || !hasForbiddenJokerPair(root)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setStatus(root, true);
  }, true);
  schedule();
  return () => observer.disconnect();
}
