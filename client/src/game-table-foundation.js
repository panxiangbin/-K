function findTableShell(root) {
  const header = root?.querySelector?.('.game-table-header');
  if (!header) return null;
  const shell = header.parentElement;
  const stage = header.nextElementSibling;
  const handDock = stage?.nextElementSibling;
  if (!shell || !stage || !handDock) return null;
  return { shell, header, stage, handDock };
}

function findTrickBoard(stage) {
  const heading = [...(stage?.querySelectorAll?.('div') || [])]
    .find(node => node.childElementCount === 0 && node.textContent?.trim() === '本轮出牌');
  return heading?.parentElement?.parentElement || null;
}

function applyPlayerRailClasses(stage) {
  if (!stage || stage.children.length < 3) return;
  stage.children[0]?.classList.add('game-table-player-rail', 'game-table-player-rail--left');
  stage.children[1]?.classList.add('game-table-center-column');
  stage.children[2]?.classList.add('game-table-player-rail', 'game-table-player-rail--right');
}

function enhanceGameTable(root) {
  const nodes = findTableShell(root);
  if (!nodes) return false;
  const { shell, header, stage, handDock } = nodes;

  shell.classList.add('game-table-shell');
  header.setAttribute('role', 'banner');
  stage.classList.add('game-table-stage');
  stage.setAttribute('aria-label', '河南五十K牌桌');
  handDock.classList.add('game-table-hand-dock');
  handDock.setAttribute('aria-label', '我的手牌与操作区');
  applyPlayerRailClasses(stage);

  const turn = header.querySelector('.game-table-header__turn');
  if (turn) {
    const isMine = turn.textContent?.includes('轮到你');
    turn.dataset.turnState = isMine ? 'self' : 'other';
    turn.setAttribute('role', 'status');
    turn.setAttribute('aria-live', 'polite');
    turn.setAttribute('aria-atomic', 'true');
  }

  const trickBoard = findTrickBoard(stage);
  if (trickBoard) {
    trickBoard.classList.add('game-table-trick-board');
    trickBoard.setAttribute('aria-label', '本轮出牌与牌堆信息');
  }

  return true;
}

export function installGameTableFoundation(root = globalThis.document?.getElementById?.('root')) {
  if (!root || typeof MutationObserver === 'undefined') return () => {};
  let queued = false;
  const run = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      enhanceGameTable(root);
    });
  };
  const observer = new MutationObserver(run);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  run();
  return () => observer.disconnect();
}

export { enhanceGameTable, findTableShell, findTrickBoard };
