const BOARD_SELECTOR = '.game-table-trick-board';
const ENHANCED_ATTR = 'data-trick-board-experience';
const LATEST_ATTR = 'data-latest-trick-play';
const cellSnapshots = new Map();
let latestCellKey = '';

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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

function getCellKey(cell, index) {
  const header = cell.firstElementChild;
  return normalizeText(header?.firstElementChild?.textContent) || `seat-${index}`;
}

function getCellSignature(cell, state) {
  const body = cell.children[1];
  return `${state}|${normalizeText(body?.textContent)}|${body?.children?.length || 0}`;
}

function removeLatestBadge(cell) {
  cell.querySelector('.trick-action-card__latest-badge')?.remove();
}

function setLatestCell(cells, latestKey) {
  cells.forEach((cell, index) => {
    const key = getCellKey(cell, index);
    const isLatest = key === latestKey && cell.dataset.trickState === 'played';
    cell.toggleAttribute(LATEST_ATTR, isLatest);
    cell.classList.toggle('is-latest-play', isLatest);
    cell.classList.toggle('is-history-play', cell.dataset.trickState === 'played' && !isLatest);

    removeLatestBadge(cell);
    if (isLatest) {
      const badge = document.createElement('span');
      badge.className = 'trick-action-card__latest-badge';
      badge.textContent = '上一手';
      badge.setAttribute('aria-hidden', 'true');
      cell.firstElementChild?.appendChild(badge);
    }

    const baseLabel = cell.dataset.trickAriaLabel || cell.getAttribute('aria-label') || key;
    cell.setAttribute('aria-label', isLatest ? `${baseLabel}，这是上一手牌` : baseLabel);
  });
}

function enhanceCell(cell, index) {
  const state = classifyCell(cell);
  cell.classList.remove('is-played', 'is-passed', 'is-waiting');
  cell.classList.add('trick-action-card', `is-${state}`);
  cell.dataset.trickState = state;
  cell.setAttribute('role', 'listitem');

  const header = cell.firstElementChild;
  const body = cell.children[1];
  header?.classList.add('trick-action-card__header');
  body?.classList.add('trick-action-card__body');

  const seatText = normalizeText(header?.firstElementChild?.textContent) || `第${index + 1}位玩家`;
  const actionText = state === 'passed' ? '已过牌' : state === 'waiting' ? '等待操作' : normalizeText(header?.lastElementChild?.textContent) || '已出牌';
  const ariaLabel = `${seatText}，${actionText}`;
  cell.dataset.trickAriaLabel = ariaLabel;
  cell.setAttribute('aria-label', ariaLabel);

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
    summary.textContent = `上一手：${label}`;
    board.dataset.latestPlay = 'available';
  } else {
    summary.textContent = '本轮还没有玩家出牌';
    board.dataset.latestPlay = 'empty';
  }
}

function enhanceBoard(board) {
  if (!board) return false;
  const header = board.firstElementChild;
  const grid = board.children[1];
  if (!header || !grid) return false;

  board.classList.add('trick-board-experience');
  board.setAttribute(ENHANCED_ATTR, 'true');
  board.setAttribute('aria-label', '本轮出牌与牌堆状态');

  header.classList.add('trick-board-summary');
  const summaryItems = [...header.children];
  const title = summaryItems[0];
  const turn = summaryItems[1];
  const meta = summaryItems[2];

  title?.classList.add('trick-board-summary__title');
  turn?.classList.add('trick-board-summary__turn');
  meta?.classList.add('trick-board-summary__meta');

  if (turn) {
    turn.setAttribute('role', 'status');
    turn.setAttribute('aria-live', 'polite');
    turn.setAttribute('aria-atomic', 'true');
  }

  grid.classList.add('trick-action-grid');
  grid.setAttribute('role', 'list');
  grid.setAttribute('aria-label', '本轮四位玩家行动');
  const cellResults = [...grid.children].map(enhanceCell);
  updateLatestPlay(board, cellResults);

  const hasPlayed = cellResults.some(result => result.state === 'played');
  board.dataset.trickPhase = hasPlayed ? 'active' : 'empty';
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
  classifyCell,
  enhanceBoard,
  installGameTrickBoardExperience,
  updateLatestPlay,
};