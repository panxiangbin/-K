const RELEASE = 'clean-landscape-v1';

function addClass(node, ...names) {
  if (!node?.classList) return;
  names.forEach(name => node.classList.add(name));
}

function findToastStack(appRoot) {
  return [...(appRoot?.children || [])].find(node => {
    const style = node?.style;
    return style?.position === 'fixed'
      && style?.left === '50%'
      && style?.pointerEvents === 'none';
  }) || null;
}

function enhanceGameVisual(root = document) {
  const shell = root.querySelector?.('.game-table-shell');
  if (!shell) {
    root.body?.classList.remove('game-screen-clean-v1');
    return false;
  }

  root.documentElement.dataset.gameVisual = RELEASE;
  root.body?.classList.add('game-screen-clean-v1');
  addClass(shell, 'game-clean-shell');

  const header = shell.querySelector('.game-table-header');
  const stage = shell.querySelector('.game-table-stage');
  const dock = shell.querySelector('.game-table-hand-dock');
  addClass(header, 'game-clean-header');
  addClass(stage, 'game-clean-stage');
  addClass(dock, 'game-clean-dock');

  stage?.querySelectorAll('.game-table-player-rail').forEach(rail => {
    addClass(rail, 'game-clean-player-rail');
    addClass(rail.firstElementChild, 'game-clean-player-seat');
  });

  const centerColumn = stage?.querySelector('.game-table-center-column');
  addClass(centerColumn, 'game-clean-center');
  const topSeatHost = centerColumn?.firstElementChild;
  if (topSeatHost?.childElementCount) {
    addClass(topSeatHost, 'game-clean-top-seat-host');
    addClass(topSeatHost.firstElementChild, 'game-clean-player-seat', 'game-clean-player-seat--top');
  }

  const trickBoard = shell.querySelector('.game-table-trick-board');
  addClass(trickBoard, 'game-clean-trick-board');

  const selfSeat = dock?.firstElementChild?.firstElementChild;
  addClass(selfSeat, 'game-clean-self-seat');
  addClass(dock?.querySelector('.game-hand-selection-status'), 'game-clean-selection-status');
  addClass(dock?.querySelector('.game-hand-surface'), 'game-clean-hand-surface');
  addClass(dock?.querySelector('.game-hand-actions'), 'game-clean-actions');

  const appRoot = root.getElementById?.('root')?.firstElementChild;
  addClass(findToastStack(appRoot), 'game-clean-toast-stack');
  addClass(root.querySelector?.('[aria-label^="网络状态："]'), 'game-clean-connection');
  const sound = [...(root.querySelectorAll?.('button') || [])]
    .find(button => /人声/.test(button.getAttribute('aria-label') || ''));
  addClass(sound, 'game-clean-sound');
  return true;
}

export function installGameLandscapeCleanV1(root = document) {
  let queued = false;
  const scan = () => {
    queued = false;
    enhanceGameVisual(root);
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(scan);
  };

  scan();
  const observer = new MutationObserver(queue);
  observer.observe(root.documentElement || root, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  return () => {
    observer.disconnect();
    root.body?.classList.remove('game-screen-clean-v1');
  };
}

export { RELEASE, enhanceGameVisual, findToastStack };
