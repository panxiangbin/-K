const ROOM_SELECTOR = '.waiting-room-card';
const ENHANCED_CLASS = 'waiting-room-card--enhanced';
const START_BUTTON_PATTERN = /开始游戏|开始中/;

export function getWaitingRoomProgress({ current = 0, max = 0, isHost = false, connected = true } = {}) {
  const safeCurrent = Math.max(0, Number(current) || 0);
  const safeMax = Math.max(safeCurrent, Number(max) || 0);
  const remaining = Math.max(0, safeMax - safeCurrent);

  if (!connected) {
    return { tone: 'recovering', title: '正在恢复房间连接', detail: '连接恢复后，座位和开始状态会自动同步。', remaining };
  }
  if (remaining === 0 && safeMax > 0) {
    return {
      tone: 'ready',
      title: isHost ? '人员已到齐，可以开始' : '人员已到齐，等待房主开始',
      detail: isHost ? '确认大家都准备好后开始游戏。' : '房主开始后会自动进入牌桌。',
      remaining,
    };
  }
  return {
    tone: 'waiting',
    title: `还差${remaining || 1}位玩家`,
    detail: isHost ? '把房间号发给亲友，人员到齐后即可开始。' : '等待其他玩家加入，房主会在人员到齐后开始。',
    remaining,
  };
}

export function getStartActionState({ current = 0, max = 0, isHost = false, connected = true, busy = false } = {}) {
  if (!isHost) return { state: 'guest', title: '等待房主开始', detail: '人员到齐后，房主开始游戏，你会自动进入牌桌。' };
  if (!connected) return { state: 'recovering', title: '暂时不能开始', detail: '正在恢复服务器连接，连接成功后会自动更新开始状态。' };
  if (busy) return { state: 'busy', title: '正在开始游戏', detail: '请求已经发出，请勿重复点击。' };
  const remaining = Math.max(0, (Number(max) || 0) - (Number(current) || 0));
  if (remaining > 0) return { state: 'waiting', title: `还需${remaining}位玩家`, detail: '人员到齐后，“开始游戏”按钮会自动可用。' };
  return { state: 'ready', title: '可以开始游戏', detail: '确认所有玩家都在房间内，再点击开始。' };
}

function setTextIfChanged(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

function setAttributeIfChanged(node, name, value) {
  if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function readPlayerCount(card) {
  const text = card.querySelector('.waiting-room-count')?.textContent || '';
  const match = text.match(/(?:玩家\s*)?(\d+)\s*\/\s*(\d+)|已到\s*(\d+)\s*人\s*·\s*共\s*(\d+)/);
  if (!match) return { current: 0, max: 0 };
  return { current: Number(match[1] || match[3]), max: Number(match[2] || match[4]) };
}

function findStartButton(panel) {
  return [...(panel?.querySelectorAll('button') || [])].find(button => START_BUTTON_PATTERN.test(button.textContent || '')) || null;
}

function isHostView(card) {
  return Boolean(findStartButton(card.closest('.lobby-panel')));
}

function normalizePlayerState(player) {
  const text = player.querySelector('.waiting-player-status')?.textContent?.trim() || '';
  const state = /离线|断开/.test(text) ? 'offline' : /恢复|重连/.test(text) ? 'recovering' : /机器人/.test(text) ? 'bot' : 'online';
  if (player.dataset.connectionState !== state) player.dataset.connectionState = state;
  const name = player.querySelector('.waiting-player-name')?.textContent || '玩家';
  if (state === 'offline') setAttributeIfChanged(player, 'aria-label', `${name}，当前离线`);
  if (state === 'recovering') setAttributeIfChanged(player, 'aria-label', `${name}，正在恢复连接`);
  return state;
}

function buildSignature(card, current, max, connected, isHost) {
  const players = [...card.querySelectorAll(':scope > .waiting-player:not(.waiting-player--empty)')]
    .map(player => `${player.querySelector('.waiting-player-name')?.textContent || ''}:${player.querySelector('.waiting-player-status')?.textContent || ''}`)
    .join('|');
  const panel = card.closest('.lobby-panel');
  const start = findStartButton(panel);
  return `${current}:${max}:${connected ? 1 : 0}:${isHost ? 1 : 0}:${start?.disabled ? 1 : 0}:${start?.textContent || ''}:${players}`;
}

function ensureEmptySeatGrid(card) {
  let grid = card.querySelector(':scope > .waiting-empty-seat-grid');
  if (!grid) {
    grid = document.createElement('div');
    grid.className = 'waiting-empty-seat-grid';
    grid.setAttribute('aria-label', '空余座位');
    card.appendChild(grid);
  }
  return grid;
}

function syncSeatLayout(card, current, max) {
  const players = [...card.querySelectorAll(':scope > .waiting-player:not(.waiting-player--empty)')];
  players.forEach((player, index) => {
    const seat = String(index + 1);
    if (player.dataset.seat !== seat) player.dataset.seat = seat;
    setAttributeIfChanged(player, 'data-seat-label', `${seat}号位`);
    normalizePlayerState(player);
  });

  const grid = ensureEmptySeatGrid(card);
  const missing = Math.max(0, max - players.length);
  const signature = `${players.length}:${max}`;
  if (grid.dataset.emptySeatSignature === signature) return;
  grid.dataset.emptySeatSignature = signature;
  const emptySeats = [];
  for (let index = 0; index < missing; index += 1) {
    const seatNumber = players.length + index + 1;
    const empty = document.createElement('div');
    empty.className = 'waiting-player waiting-player--empty';
    empty.dataset.seat = String(seatNumber);
    empty.dataset.seatLabel = `${seatNumber}号位`;
    empty.setAttribute('aria-label', `${seatNumber}号位，等待玩家加入`);
    empty.innerHTML = '<span class="waiting-player-avatar waiting-player-avatar--empty" aria-hidden="true">+</span><span class="waiting-player-name">等待加入</span><span class="waiting-player-status waiting">空座位</span>';
    emptySeats.push(empty);
  }
  grid.replaceChildren(...emptySeats);
  grid.hidden = emptySeats.length === 0;
}

function updateGuidance(card, current, max, connected, isHost) {
  const panel = card.closest('.lobby-panel');
  if (!panel) return;
  const guidance = getWaitingRoomProgress({ current, max, isHost, connected });
  let status = panel.querySelector('.waiting-room-guidance');
  if (!status) {
    status = document.createElement('div');
    status.className = 'waiting-room-guidance';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    card.insertAdjacentElement('afterend', status);
  }
  if (status.dataset.tone !== guidance.tone) status.dataset.tone = guidance.tone;
  let title = status.querySelector('strong');
  let detail = status.querySelector('span');
  if (!title || !detail) {
    title = document.createElement('strong');
    detail = document.createElement('span');
    status.replaceChildren(title, detail);
  }
  setTextIfChanged(title, guidance.title);
  setTextIfChanged(detail, guidance.detail);

  const count = card.querySelector('.waiting-room-count');
  if (count) {
    setTextIfChanged(count, `已到 ${current} 人 · 共 ${max} 个座位`);
    setAttributeIfChanged(count, 'aria-label', `当前已有${current}位玩家，共${max}个座位`);
  }
}

function updateStartAction(panel, current, max, connected, isHost) {
  const start = findStartButton(panel);
  const busy = Boolean(start && (/开始中/.test(start.textContent || '') || start.getAttribute('aria-busy') === 'true'));
  const action = getStartActionState({ current, max, connected, isHost, busy });
  let hint = panel.querySelector('.waiting-start-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'waiting-start-hint';
    hint.id = 'waiting-start-hint';
    hint.setAttribute('role', 'status');
    hint.setAttribute('aria-live', 'polite');
    hint.setAttribute('aria-atomic', 'true');
    const exit = [...panel.querySelectorAll('button')].find(button => /退出房间|退出中/.test(button.textContent || ''));
    (start || exit)?.insertAdjacentElement('beforebegin', hint);
  }
  if (!hint) return;
  if (hint.dataset.state !== action.state) hint.dataset.state = action.state;
  let title = hint.querySelector('strong');
  let detail = hint.querySelector('span');
  if (!title || !detail) {
    title = document.createElement('strong');
    detail = document.createElement('span');
    hint.replaceChildren(title, detail);
  }
  setTextIfChanged(title, action.title);
  setTextIfChanged(detail, action.detail);
  if (start) {
    setAttributeIfChanged(start, 'aria-describedby', hint.id);
    setAttributeIfChanged(start, 'title', action.detail);
    if (start.dataset.readiness !== action.state) start.dataset.readiness = action.state;
    if (busy) setAttributeIfChanged(start, 'aria-busy', 'true');
    else if (start.hasAttribute('aria-busy')) start.removeAttribute('aria-busy');
  }
}

function installCopyFeedback(card) {
  const copy = card.querySelector('.waiting-room-copy');
  if (!copy) return;
  setAttributeIfChanged(copy, 'aria-label', '复制房间号');
  setAttributeIfChanged(copy, 'title', '复制房间号，发给亲友加入');
  if (copy.dataset.feedbackInstalled === 'true') return;
  copy.dataset.feedbackInstalled = 'true';

  let feedback = card.querySelector('.waiting-copy-feedback');
  if (!feedback) {
    feedback = document.createElement('span');
    feedback.className = 'waiting-copy-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    feedback.setAttribute('aria-atomic', 'true');
    copy.insertAdjacentElement('afterend', feedback);
  }

  copy.addEventListener('click', () => {
    feedback.dataset.tone = 'working';
    setTextIfChanged(feedback, '正在复制房间号…');
    window.setTimeout(() => {
      const failed = /失败|不支持/.test(copy.textContent || '');
      feedback.dataset.tone = failed ? 'error' : 'success';
      setTextIfChanged(feedback, failed ? '复制失败，请长按房间号手动复制。' : '房间号已复制，可以发给亲友了。');
    }, 220);
  });
}

function enhanceWaitingRoom(card) {
  const { current, max } = readPlayerCount(card);
  if (!max) return;
  const connected = Boolean(window.__henan50kConnected);
  const isHost = isHostView(card);
  const signature = buildSignature(card, current, max, connected, isHost);
  if (card.dataset.waitingRoomSignature === signature) return;

  card.dataset.waitingRoomSignature = signature;
  card.classList.add(ENHANCED_CLASS);
  syncSeatLayout(card, current, max);
  updateGuidance(card, current, max, connected, isHost);

  const panel = card.closest('.lobby-panel');
  updateStartAction(panel, current, max, connected, isHost);
  installCopyFeedback(card);

  const exit = [...(panel?.querySelectorAll('button') || [])].find(button => /退出房间|退出中/.test(button.textContent || ''));
  if (exit) setAttributeIfChanged(exit, 'title', '退出当前房间并返回开始页');
}

function scan() {
  document.querySelectorAll(ROOM_SELECTOR).forEach(enhanceWaitingRoom);
}

export function installWaitingRoomExperience() {
  scan();
  let scheduled = false;
  const scheduleScan = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      scan();
    });
  };
  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'aria-busy'] });
  window.addEventListener('henan50k-connection-change', scheduleScan);
  return () => {
    observer.disconnect();
    window.removeEventListener('henan50k-connection-change', scheduleScan);
  };
}
