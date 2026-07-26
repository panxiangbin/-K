const CONNECTION_EVENT = 'henan50k-connection-change';
const PLAY_SELECTOR = '.btn-play';
const PASS_SELECTOR = '.btn-pass';
const HINT_SELECTOR = '.btn-lite.hint';

export function getGameActionFeedback({
  connected = false,
  busy = false,
  gameEnded = false,
  myFinished = false,
  isMyTurn = false,
  isFirst = false,
  selectedCount = 0,
  selectedValid = true,
  canBeat = true,
} = {}) {
  if (gameEnded) return '本局已经结束，请查看结算结果。';
  if (!connected) return '网络尚未连接，出牌、提示和过牌已暂停，连接恢复后再操作。';
  if (busy) return '上一项操作正在等待服务器确认，请不要重复点击。';
  if (myFinished) return '你已经出完手牌，请等待本墩结束并结算分牌。';
  if (!isMyTurn) return '现在还没轮到你，请等待当前玩家完成操作。';
  if (selectedCount > 0 && !selectedValid) return '所选牌型不合法。只能出单张、对子、三张、四至七张同点牌或合法炸弹。';
  if (selectedCount > 0 && !canBeat) return '所选牌压不过上一手。请换同类型、同张数的更大牌，或使用合法炸弹。';
  if (selectedCount > 0) return `已选择${selectedCount}张合法牌，可以点击“出牌”。`;
  if (isFirst) return '你是本轮先手，请选择任意合法牌型；先手不能过牌。';
  return '请选择能压过上一手的牌。可点“提示”查看全部候选；有合法更大牌时必须压牌。';
}

export function getActionButtonDescription(action, state = {}) {
  const feedback = getGameActionFeedback(state);
  if (action === 'hint') return `${feedback} “提示”会依次展示可压候选；没有更大牌时会明确说明。`;
  if (action === 'pass') return `${feedback} 只有确实没有合法更大牌时才可以过牌。`;
  return feedback;
}

function findStatusText(root) {
  const candidates = [...root.querySelectorAll('div')]
    .map((node) => (node.textContent || '').trim())
    .filter((text) => text && text.length <= 90);
  return candidates.find((text) => /^(已选|正在出牌|你已出完|请出牌|你先出牌|已理牌|可点选)/.test(text)) || '';
}

function readState(root = document) {
  const play = root.querySelector(PLAY_SELECTOR);
  const pass = root.querySelector(PASS_SELECTOR);
  const pageText = root.body?.textContent || '';
  const statusText = findStatusText(root);
  const turnText = root.querySelector('.game-table-header__turn')?.textContent || '';
  const selectedCount = Number((play?.textContent || '').match(/\((\d+)\)/)?.[1] || 0);
  const selectedValid = !statusText.includes('非法牌型');
  const canBeat = selectedCount === 0 || (!statusText.includes('可点出牌，由系统判断') && selectedValid);
  return {
    connected: globalThis.__henan50kConnected === true,
    busy: Boolean(root.querySelector('[data-action-guard-busy="true"], [aria-busy="true"]')),
    gameEnded: !play && /本局结束|结算/.test(pageText),
    myFinished: statusText.includes('你已出完'),
    isMyTurn: /轮到你/.test(turnText) || /^(请出牌|你先出牌)/.test(statusText),
    isFirst: /你先出牌|先手不能过牌/.test(statusText) || Boolean(pass?.disabled && /先手/.test(pageText)),
    selectedCount,
    selectedValid,
    canBeat,
  };
}

function ensureFeedbackNode(actionRow, root = document) {
  let node = root.getElementById?.('henan50k-game-action-feedback');
  if (node) return node;
  node = root.createElement('div');
  node.id = 'henan50k-game-action-feedback';
  node.className = 'game-action-feedback';
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  node.setAttribute('aria-atomic', 'true');
  actionRow.parentElement?.insertBefore(node, actionRow);
  return node;
}

function refresh(root = document) {
  const play = root.querySelector(PLAY_SELECTOR);
  const pass = root.querySelector(PASS_SELECTOR);
  const hint = root.querySelector(HINT_SELECTOR);
  if (!play || !pass || !hint) {
    root.getElementById?.('henan50k-game-action-feedback')?.remove();
    return;
  }
  const actionRow = play.parentElement;
  const state = readState(root);
  const node = ensureFeedbackNode(actionRow, root);
  const feedback = getGameActionFeedback(state);
  node.textContent = feedback;

  for (const [action, button] of [['play', play], ['pass', pass], ['hint', hint]]) {
    const description = getActionButtonDescription(action, state);
    button.setAttribute('aria-describedby', node.id);
    button.setAttribute('title', description);
    button.setAttribute('data-disabled-reason', button.disabled ? description : '');
  }
}

export function installGameActionFeedback(root = document) {
  if (globalThis.__henan50kGameActionFeedbackCleanup) return globalThis.__henan50kGameActionFeedbackCleanup;
  let scheduled = false;
  const scheduleRefresh = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      refresh(root);
    });
  };
  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(root.documentElement || root.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['disabled', 'aria-busy', 'data-action-guard-busy'],
  });
  globalThis.addEventListener?.(CONNECTION_EVENT, scheduleRefresh);
  scheduleRefresh();

  const cleanup = () => {
    observer.disconnect();
    globalThis.removeEventListener?.(CONNECTION_EVENT, scheduleRefresh);
    root.getElementById?.('henan50k-game-action-feedback')?.remove();
    delete globalThis.__henan50kGameActionFeedbackCleanup;
  };
  globalThis.__henan50kGameActionFeedbackCleanup = cleanup;
  return cleanup;
}
