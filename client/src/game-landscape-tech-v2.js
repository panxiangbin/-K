const TECH_GAME_RELEASE = 'tech-landscape-v2';

function findToastStack(root = document) {
  const app = root.getElementById?.('root')?.firstElementChild;
  if (!app) return null;
  return [...app.children].find(node => {
    const style = node?.style;
    return style?.position === 'fixed'
      && style?.left === '50%'
      && style?.pointerEvents === 'none';
  }) || null;
}

function syncTechGameChrome(root = document) {
  const shell = root.querySelector?.('.tech-game-shell');
  if (!shell) return false;
  root.documentElement.dataset.gameVisual = TECH_GAME_RELEASE;
  root.body?.classList.add('game-screen-tech-v2');
  findToastStack(root)?.classList.add('tech-toast-stack');
  return true;
}

export function installGameLandscapeTechV2(root = document) {
  let queued = false;
  const scan = () => {
    queued = false;
    syncTechGameChrome(root);
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(scan);
  };
  scan();
  const observer = new MutationObserver(queue);
  observer.observe(root.documentElement || root, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}

export { TECH_GAME_RELEASE, findToastStack, syncTechGameChrome };
