const PLAYER_STATE_LABELS = {
  current: '出牌中',
  offline: '离线',
  recovering: '恢复中',
  finished: '已出完',
  left: '已退出',
  ready: '等待中',
};

function findPlayerCards(root) {
  const stage = root?.querySelector?.('.game-table-stage');
  const handDock = root?.querySelector?.('.game-table-hand-dock');
  if (!stage || !handDock) return [];

  const cards = [];
  const left = stage.querySelector('.game-table-player-rail--left')?.firstElementChild;
  const right = stage.querySelector('.game-table-player-rail--right')?.firstElementChild;
  const center = stage.querySelector('.game-table-center-column');
  const top = center?.firstElementChild?.firstElementChild;
  const self = handDock.firstElementChild?.firstElementChild;

  if (left) cards.push({ element: left, position: 'left', label: '左侧玩家' });
  if (top) cards.push({ element: top, position: 'top', label: '上方玩家' });
  if (right) cards.push({ element: right, position: 'right', label: '右侧玩家' });
  if (self) cards.push({ element: self, position: 'self', label: '我的状态' });
  return cards;
}

function readPlayerState(element) {
  const text = element?.textContent || '';
  const opacity = Number.parseFloat(element?.style?.opacity || '1');
  const current = text.includes('出牌中');
  const left = text.includes('已退出');
  const finished = text.includes('已出完') || /0张/.test(text);
  const recovering = text.includes('恢复中') || text.includes('正在恢复');
  const offline = !left && !recovering && (text.includes('离线') || opacity < 0.8);

  if (current) return 'current';
  if (left) return 'left';
  if (finished) return 'finished';
  if (recovering) return 'recovering';
  if (offline) return 'offline';
  return 'ready';
}

function extractPlayerSummary(element, fallbackLabel) {
  const text = (element?.textContent || '').replace(/\s+/g, ' ').trim();
  const cardMatch = text.match(/(\d+)张/);
  const scoreMatch = text.match(/(\d+)分/);
  const state = readPlayerState(element);
  const details = [];
  if (scoreMatch) details.push(`${scoreMatch[1]}分`);
  if (cardMatch) details.push(`剩余${cardMatch[1]}张牌`);
  details.push(PLAYER_STATE_LABELS[state]);
  return `${fallbackLabel}，${details.join('，')}`;
}

function ensureStateBadge(element, state) {
  let badge = element.querySelector(':scope > .game-player-card__state');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'game-player-card__state';
    badge.setAttribute('aria-hidden', 'true');
    element.appendChild(badge);
  }
  const label = PLAYER_STATE_LABELS[state];
  if (badge.dataset.state !== state) badge.dataset.state = state;
  if (badge.textContent !== label) badge.textContent = label;
}

function enhancePlayerCard({ element, position, label }) {
  if (!element) return;
  const state = readPlayerState(element);
  element.classList.add('game-player-card', `game-player-card--${position}`);
  if (element.dataset.playerState !== state) element.dataset.playerState = state;
  element.setAttribute('role', 'group');
  const summary = extractPlayerSummary(element, label);
  if (element.getAttribute('aria-label') !== summary) element.setAttribute('aria-label', summary);
  ensureStateBadge(element, state);

  const avatar = element.firstElementChild;
  if (avatar) avatar.classList.add('game-player-card__avatar');

  const textNodes = [...element.children].filter(child => child !== avatar && !child.classList.contains('game-player-card__state'));
  textNodes.forEach((child, index) => child.classList.add(index === 0 ? 'game-player-card__name' : 'game-player-card__meta'));
}

function enhanceGamePlayerCards(root) {
  const cards = findPlayerCards(root);
  cards.forEach(enhancePlayerCard);
  return cards.length > 0;
}

function resolveRoot(root) {
  if (root) return root;
  const documentObject = globalThis.document;
  if (!documentObject || typeof documentObject.getElementById !== 'function') return null;
  return documentObject.getElementById('root');
}

export function installGamePlayerCardExperience(root = null) {
  const resolvedRoot = resolveRoot(root);
  if (!resolvedRoot || typeof MutationObserver === 'undefined') return () => {};
  let queued = false;
  const run = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      enhanceGamePlayerCards(resolvedRoot);
    });
  };
  const observer = new MutationObserver(run);
  observer.observe(resolvedRoot, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  });
  run();
  return () => observer.disconnect();
}

export { enhanceGamePlayerCards, findPlayerCards, readPlayerState, extractPlayerSummary };
