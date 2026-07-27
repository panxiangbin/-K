const ACTION_GUIDANCE_ID = 'game-action-guidance';
const HINT_TOAST_PATTERN = /提示\s*(\d+)\s*\/\s*(\d+)/;

function getStatusText(root) {
  return root.querySelector?.('.game-hand-selection-status')?.textContent?.trim() || '';
}

function getPlayReason(playButton, statusText) {
  if (!playButton?.disabled) return '已可出牌。确认所选牌型后，点击出牌。';
  if (/已出完/.test(statusText)) return '你已经出完手牌，等待本墩结束。';
  if (/正在出牌|处理中/.test(statusText)) return '出牌请求正在处理中，请勿重复点击。';
  if (/非法牌型/.test(statusText)) return '所选牌型不合法，请重新选牌或点击提示。';
  if (/已选\d+张/.test(statusText)) return '所选牌暂时不能压过上一手，请调整选牌或点击提示。';
  if (/请出牌|你先出牌/.test(statusText)) return '请先选择一组合法牌，再点击出牌。';
  return '还没轮到你，轮到你时按钮会自动可用。';
}

function getPassReason(passButton, statusText) {
  if (!passButton?.disabled) return '当前可以过牌。只有没有强制压牌要求时才能使用。';
  if (/已出完/.test(statusText)) return '你已经出完手牌，无需过牌。';
  if (/正在出牌|处理中/.test(statusText)) return '当前请求正在处理中，请勿重复操作。';
  if (/你先出牌/.test(statusText)) return '你是本轮先手，必须出牌，不能过牌。';
  if (/请出牌，需压过/.test(statusText)) return '如有合法更大牌必须压牌；没有可压牌时系统才允许过牌。';
  return '还没轮到你，暂时不能过牌。';
}

function getHintReason(hintButton, statusText, hintProgress) {
  if (hintProgress) return `当前显示提示候选 ${hintProgress.current}/${hintProgress.total}；再次点击可查看下一组。`;
  if (!hintButton?.disabled) return '点击提示可选择一组合法候选；连续点击可依次查看其他候选。';
  if (/已出完/.test(statusText)) return '你已经出完手牌，无需提示。';
  if (/正在出牌|处理中/.test(statusText)) return '当前请求正在处理中，稍后再使用提示。';
  return '当前暂时不能使用提示。';
}

function ensureDescription(root, id, text) {
  let node = root.getElementById?.(id);
  if (!node) {
    node = root.createElement('span');
    node.id = id;
    node.className = 'game-action-description sr-only';
    root.body?.appendChild(node);
  }
  node.textContent = text;
  return node;
}

function findLatestHintProgress(root) {
  const nodes = [...(root.querySelectorAll?.('div') || [])];
  for (let index = nodes.length - 1; index >= 0; index--) {
    const match = nodes[index].textContent?.trim().match(HINT_TOAST_PATTERN);
    if (match) return { current: Number(match[1]), total: Number(match[2]) };
  }
  return null;
}

export function enhanceGameActionGuidance(root = document) {
  const playButton = root.querySelector?.('.btn-play');
  const passButton = root.querySelector?.('.btn-pass');
  const hintButton = root.querySelector?.('.btn-lite.hint');
  const actionBar = playButton?.parentElement;
  if (!playButton || !passButton || !hintButton || !actionBar) return false;

  const statusText = getStatusText(root);
  const hintProgress = findLatestHintProgress(root);
  const descriptions = {
    play: getPlayReason(playButton, statusText),
    pass: getPassReason(passButton, statusText),
    hint: getHintReason(hintButton, statusText, hintProgress),
  };

  const playDescription = ensureDescription(root, 'game-play-description', descriptions.play);
  const passDescription = ensureDescription(root, 'game-pass-description', descriptions.pass);
  const hintDescription = ensureDescription(root, 'game-hint-description', descriptions.hint);

  playButton.setAttribute('aria-describedby', playDescription.id);
  passButton.setAttribute('aria-describedby', passDescription.id);
  hintButton.setAttribute('aria-describedby', hintDescription.id);
  playButton.title = descriptions.play;
  passButton.title = descriptions.pass;
  hintButton.title = descriptions.hint;

  let guidance = root.getElementById?.(ACTION_GUIDANCE_ID);
  if (!guidance) {
    guidance = root.createElement('div');
    guidance.id = ACTION_GUIDANCE_ID;
    guidance.className = 'game-action-guidance';
    guidance.setAttribute('role', 'status');
    guidance.setAttribute('aria-live', 'polite');
    guidance.setAttribute('aria-atomic', 'true');
    actionBar.insertAdjacentElement('afterend', guidance);
  }

  const activeText = hintProgress
    ? descriptions.hint
    : !playButton.disabled
      ? descriptions.play
      : !passButton.disabled
        ? descriptions.pass
        : descriptions.play;
  guidance.textContent = activeText;
  guidance.dataset.state = hintProgress ? 'hint' : playButton.disabled ? 'waiting' : 'ready';
  return true;
}

export function installGameActionGuidance(root = document) {
  let queued = false;
  const scan = () => {
    queued = false;
    enhanceGameActionGuidance(root);
  };
  const queueScan = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(scan);
  };

  scan();
  const observer = new MutationObserver(queueScan);
  observer.observe(root.documentElement || root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['disabled', 'aria-busy'],
  });
  return () => observer.disconnect();
}

export { ACTION_GUIDANCE_ID, HINT_TOAST_PATTERN, getHintReason, getPassReason, getPlayReason };