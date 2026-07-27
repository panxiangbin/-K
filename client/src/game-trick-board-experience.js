const BOARD_SELECTOR = '.game-table-trick-board';
const ENHANCED_ATTR = 'data-trick-board-experience';

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

function enhanceCell(cell, index) {
  const state = classifyCell(cell);
  cell.classList.add('trick-action-card', `is-${state}`);
  cell.dataset.trickState = state;
  cell.setAttribute('role', 'listitem');

  const header = cell.firstElementChild;
  const body = cell.children[1];
  header?.classList.add('trick-action-card__header');
  body?.classList.add('trick-action-card__body');

  const seatText = normalizeText(header?.firstElementChild?.textContent) || `第${index + 1}位玩家`;
  const actionText = state === 'passed' ? '已过牌' : state === 'waiting' ? '等待操作' : normalizeText(header?.lastElementChild?.textContent) || '已出牌';
  cell.setAttribute('aria-label', `${seatText}，${actionText}`);
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
  [...grid.children].forEach(enhanceCell);

  const hasPlayed = [...grid.children].some(cell => cell.dataset.trickState === 'played');
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
};
