const BOARD_SELECTOR = '.game-table-trick-board';
const ENHANCED_ATTR = 'data-trick-board-experience';
const LATEST_ATTR = 'data-latest-trick-play';
const cellSnapshots = new Map();
let latestCellKey = '';

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function setTextIfChanged(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

function setAttributeIfChanged(node, name, value) {
  if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function findBoard() {
  return [...document.querySelectorAll('div')].find(element => {
    if (element.getAttribute(ENHANCED_ATTR) === 'true') return true;
    const firstChild = element.firstElementChild;
    return firstChild && normalizeText(firstChild.textContent).includes('本轮出牌');
  }) || null;
}

function classifyCell(cell) {
  const text = normalizeText(cell.textContent);
  if (text.includes('已过牌') || text.includes('过牌')) return 'passed';
  if (text.includes('等待操作') || text.includes('待出')) return 'waiting';
  return 'played';
}

function classifySpecialPlay(actionText) {
  if (actionText.includes('五十K')) return 'fifty-k';
  if (actionText.includes('黑四')) return 'black-four';
  if (actionText.includes('红四')) return 'red-four';
  if (actionText.includes('八张')) return 'same-eight';
  if (actionText.includes('四王')) return 'four-jokers';
  if (actionText.includes('炸弹')) return 'bomb';
  return '';
}

function specialPlayLabel(specialPlay) {
  if (specialPlay === 'fifty-k') return '同花五十K';
  if (specialPlay === 'black-four') return '黑四炸弹';
  if (specialPlay === 'red-four') return '红四炸弹';
  if (specialPlay === 'same-eight') return '八张同点炸弹';
  if (specialPlay === 'four-jokers') return '四王炸弹';
  if (specialPlay === 'bomb') return '炸弹';
  return '';
}

function getCellKey(cell, index) {
  const header = cell.firstElementChild;
  return normalizeText(header?.firstElementChild?.textContent) || `seat-${index}`;
}

function getCellSignature(cell, state) {
  const body = cell.children[1];
  return `${state}|${normalizeText(body?.textContent)}|${body?.children?.length || 0}`;
}

function syncLatestBadge(cell, isLatest) {
  const header = cell.firstElementChild;
  let badge = cell.querySelector(':scope > :first-child > .trick-action-card__latest-badge');
  if (!isLatest) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'trick-action-card__latest-badge';
    badge.setAttribute('aria-hidden', 'true');
    header?.appendChild(badge);
  }
  setTextIfChanged(badge, '上一手');
}

function setLatestCell(cells, latestKey) {
  cells.forEach((cell, index) => {
    const key = getCellKey(cell, index);
    const isLatest = key === latestKey && cell.dataset.trickState === 'played';
    cell.toggleAttribute(LATEST_ATTR, isLatest);
    cell.classList.toggle('is-latest-play', isLatest);
    cell.classList.toggle('is-history-play', cell.dataset.trickState === 'played' && !isLatest);
    syncLatestBadge(cell, isLatest);

    const baseLabel = cell.dataset.trickAriaLabel || cell.getAttribute('aria-label') || key;
    setAttributeIfChanged(cell, 'aria-label', isLatest ? `${baseLabel}，这是上一手牌` : baseLabel);
  });
}

function enhanceCell(cell, index) {
  const state = classifyCell(cell);
  cell.classList.remove(
    'is-played',
    'is-passed',
    'is-waiting',
    'is-fifty-k',
    'is-black-four',
    'is-red-four',
    'is-same-eight',
    'is-four-jokers',
    'is-bomb',
  );
  cell.classList.add('trick-action-card', `is-${state}`);
  if (cell.dataset.trickState !== state) cell.dataset.trickState = state;
  setAttributeIfChanged(cell, 'role', 'listitem');

  const header = cell.firstElementChild;
  const body = cell.children[1];
  header?.classList.add('trick-action-card__header');
  body?.classList.add('trick-action-card__body');

  const seatText = normalizeText(header?.firstElementChild?.textContent) || `第${index + 1}位玩家`;
  const actionText = state === 'passed'
    ? '已过牌'
    : state === 'waiting'
      ? '等待操作'
      : normalizeText(header?.lastElementChild?.textContent) || '已出牌';
  const cardCount = state === 'played' ? body?.children?.length || 0 : 0;
  const specialPlay = state === 'played' ? classifySpecialPlay(actionText) : '';
  const specialLabel = specialPlayLabel(specialPlay);

  const cardCountValue = String(cardCount);
  if (cell.dataset.cardCount !== cardCountValue) cell.dataset.cardCount = cardCountValue;
  const specialValue = specialPlay || 'normal';
  if (cell.dataset.specialPlay !== specialValue) cell.dataset.specialPlay = specialValue;
  if (specialPlay) cell.classList.add(`is-${specialPlay}`);

  const cardCountText = cardCount > 0 ? `，共${cardCount}张牌` : '';
  const ariaLabel = `${seatText}，${specialLabel || actionText}${cardCountText}`;
  if (cell.dataset.trickAriaLabel !== ariaLabel) cell.dataset.trickAriaLabel = ariaLabel;
  setAttributeIfChanged(cell, 'aria-label', ariaLabel);

  const key = getCellKey(cell, index);
  const signature = getCellSignature(cell, state);
  const previous = cellSnapshots.get(key);
  cellSnapshots.set(key, signature);
  return { cell, key, state, changedToPlay: state === 'played' && previous && previous !== signature };
}

function ensureLatestSummary(board) {
  let summary = board.querySelector('.trick-board-latest-summary');
  if (!summary) {
    summary = document.createElement('div');
    summary.className = 'trick-board-latest-summary';
    summary.setAttribute('role', 'status');
    summary.setAttribute('aria-live', 'polite');
    summary.setAttribute('aria-atomic', 'true');
    board.appendChild(summary);
  }
  return summary;
}

function updateLatestPlay(board, cellResults) {
  const played = cellResults.filter(result => result.state === 'played');
  const changed = played.filter(result => result.changedToPlay);
  if (changed.length) latestCellKey = changed[changed.length - 1].key;
  else if (!played.some(result => result.key === latestCellKey)) latestCellKey = played[played.length - 1]?.key || '';

  setLatestCell(cellResults.map(result => result.cell), latestCellKey);
  const latest = played.find(result => result.key === latestCellKey);
  const summary = ensureLatestSummary(board);
  if (latest) {
    const label = latest.cell.dataset.trickAriaLabel || latest.key;
    setTextIfChanged(summary, `上一手：${label}`);
    if (board.dataset.latestPlay !== 'available') board.dataset.latestPlay = 'available';
  } else {
    setTextIfChanged(summary, '本轮还没有玩家出牌');
    if (board.dataset.latestPlay !== 'empty') board.dataset.latestPlay = 'empty';
  }
}

function enhanceBoard(board) {
  if (!board) return false;
  const header = board.firstElementChild;
  const grid = board.children[1];
  if (!header || !grid) return false;

  board.classList.add('trick-board-experience');
  if (board.getAttribute(ENHANCED_ATTR) !== 'true') board.setAttribute(ENHANCED_ATTR, 'true');
  setAttributeIfChanged(board, 'aria-label', '本轮出牌与牌堆状态');

  header.classList.add('trick-board-summary');
  const summaryItems = [...header.children];
  const title = summaryItems[0];
  const turn = summaryItems[1];
  const meta = summaryItems[2];

  title?.classList.add('trick-board-summary__title');
  turn?.classList.add('trick-board-summary__turn');
  meta?.classList.add('trick-board-summary__meta');

  if (turn) {
    setAttributeIfChanged(turn, 'role', 'status');
    setAttributeIfChanged(turn, 'aria-live', 'polite');
    setAttributeIfChanged(turn, 'aria-atomic', 'true');
  }

  grid.classList.add('trick-action-grid');
  setAttributeIfChanged(grid, 'role', 'list');
  setAttributeIfChanged(grid, 'aria-label', '本轮四位玩家行动');
  const cellResults = [...grid.children].map(enhanceCell);
  updateLatestPlay(board, cellResults);

  const hasPlayed = cellResults.some(result => result.state === 'played');
  const phase = hasPlayed ? 'active' : 'empty';
  if (board.dataset.trickPhase !== phase) board.dataset.trickPhase = phase;
  return true;
}

function installGameTrickBoardExperience() {
  let scheduled = false;
  const scan = () => {
    scheduled = false;
    enhanceBoard(findBoard());
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(scan);
  };

  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  return () => observer.disconnect();
}

export {
  BOARD_SELECTOR,
  classifyCell,
  classifySpecialPlay,
  enhanceBoard,
  installGameTrickBoardExperience,
  specialPlayLabel,
  updateLatestPlay,
};
