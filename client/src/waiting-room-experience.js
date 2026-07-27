const ROOM_SELECTOR = '.waiting-room-card';
const ENHANCED_CLASS = 'waiting-room-card--enhanced';
const START_BUTTON_PATTERN = /开始游戏|开始中/;

export function getWaitingRoomProgress({ current = 0, max = 0, isHost = false, connected = true } = {}) {
  const safeCurrent = Math.max(0, Number(current) || 0);
  const safeMax = Math.max(safeCurrent, Number(max) || 0);
  const remaining = Math.max(0, safeMax - safeCurrent);

  if (!connected) {
    return {
      tone: 'recovering',
      title: '正在恢复房间连接',
      detail: '连接恢复后，座位和开始状态会自动同步。',
      remaining,
    };
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
  if (!isHost) {
    return {
      state: 'guest',
      title: '等待房主开始',
      detail: '人员到齐后，房主开始游戏，你会自动进入牌桌。',
    };
  }
  if (!connected) {
    return {
      state: 'recovering',
      title: '暂时不能开始',
      detail: '正在恢复服务器连接，连接成功后会自动更新开始状态。',
    };
  }
  if (busy) {
    return {
      state: 'busy',
      title: '正在开始游戏',
      detail: '请求已经发出，请勿重复点击。',
    };
  }
  const remaining = Math.max(0, (Number(max) || 0) - (Number(current) || 0));
  if (remaining > 0) {
    return {
      state: 'waiting',
      title: `还需${remaining}位玩家`,
      detail: '人员到齐后，“开始游戏”按钮会自动可用。',
    };
  }
  return {
    state: 'ready',
    title: '可以开始游戏',
    detail: '确认所有玩家都在房间内，再点击开始。',
  };
}

function readPlayerCount(card) {
  const text = card.querySelector('.waiting-room-count')?.textContent || '';
  const match = text.match(/(?:玩家\s*)?(\d+)\s*\/\s*(\d+)|已到\s*(\d+)\s*人\s*·\s*共\s*(\d+)/);
  if (!match) return { current: 0, max: 0 };
  return {
    current: Number(match[1] || match[3]),
    max: Number(match[2] || match[4]),
  };
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
  player.dataset.connectionState = state;
  if (state === 'offline') player.setAttribute('aria-label', `${player.querySelector('.waiting-player-name')?.textContent || '玩家'}，当前离线`);
  if (state === 'recovering') player.setAttribute('aria-label', `${player.querySelector('.waiting-player-name')?.textContent || '玩家'}，正在恢复连接`);
  return state;
}

function buildSignature(card, current, max, connected, isHost) {
  const players = [...card.querySelectorAll('.waiting-player:not(.waiting-player--empty)')]
    .map(player => `${player.querySelector('.waiting-player-name')?.textContent || ''}:${player.querySelector('.waiting-player-status')?.textContent || ''}`)
    .join('|');
  const panel = card.closest('.lobby-panel');
  const start = findStartButton(panel);
  return `${current}:${max}:${connected ? 1 : 0}:${isHost ? 1 : 0}:${start?.disabled ? 1 : 0}:${start?.textContent || ''}:${players}`;
}

function buildSeatGrid(card, current, max) {
  let grid = card.querySelector('.waiting-seat-grid');
  const players = [...card.querySelectorAll('.waiting-player:not(.waiting-player--empty)')];
  if (!grid) {
    grid = document.createElement('div');
    grid.className = 'waiting-seat-grid';
    grid.setAttribute('aria-label', '房间座位');
    const count = card.querySelector('.waiting-room-count');
    count?.insertAdjacentElement('afterend', grid);
  }

  grid.replaceChildren();
  players.forEach((player, index) => {
    player.querySelectorAll(':scope > .waiting-seat-number').forEach(node => node.remove());
    player.dataset.seat = String(index + 1);
    normalizePlayerState(player);
    const seat = document.createElement('span');
    seat.className = 'waiting-seat-number';
    seat.setAttribute('aria-hidden', 'true');
    seat.textContent = `${index + 1}号位`;
    player.prepend(seat);
    grid.appendChild(player);
  });

  for (let index = players.length; index < max; index++) {
    const empty = document.createElement('div');
    empty.className = 'waiting-player waiting-player--empty';
    empty.setAttribute('aria-label', `${index + 1}号位，等待玩家加入`);
    empty.innerHTML = `<span class="waiting-seat-number" aria-hidden="true">${index + 1}号位</span><span class="waiting-player-avatar waiting-player-avatar--empty" aria-hidden="true">+</span><span class="waiting-player-name">等待加入</span><span class="waiting-player-status waiting">空座位</span>`;
    grid.appendChild(empty);
  }
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
  status.dataset.tone = guidance.tone;
  status.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = guidance.title;
  const detail = document.createElement('span');
  detail.textContent = guidance.detail;
  status.append(title, detail);

  const count = card.querySelector('.waiting-room-count');
  if (count) {
    count.textContent = `已到 ${current} 人 · 共 ${max} 个座位`;
    count.setAttribute('aria-label', `当前已有${current}位玩家，共${max}个座位`);
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
  hint.dataset.state = action.state;
  hint.innerHTML = `<strong>${action.title}</strong><span>${action.detail}</span>`;
  if (start) {
    start.setAttribute('aria-describedby', hint.id);
    start.setAttribute('title', action.detail);
    start.dataset.readiness = action.state;
    if (busy) start.setAttribute('aria-busy', 'true');
    else start.removeAttribute('aria-busy');
  }
}

function installCopyFeedback(card) {
  const copy = card.querySelector('.waiting-room-copy');
  if (!copy) return;
  copy.setAttribute('aria-label', '复制房间号');
  copy.setAttribute('title', '复制房间号，发给亲友加入');
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
    feedback.textContent = '正在复制房间号…';
    window.setTimeout(() => {
      const text = copy.textContent || '';
      const failed = /失败|不支持/.test(text);
      feedback.dataset.tone = failed ? 'error' : 'success';
      feedback.textContent = failed ? '复制失败，请长按房间号手动复制。' : '房间号已复制，可以发给亲友了。';
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
  buildSeatGrid(card, current, max);
  updateGuidance(card, current, max, connected, isHost);

  const panel = card.closest('.lobby-panel');
  updateStartAction(panel, current, max, connected, isHost);
  installCopyFeedback(card);

  const exit = [...(panel?.querySelectorAll('button') || [])].find(button => /退出房间|退出中/.test(button.textContent || ''));
  if (exit) exit.setAttribute('title', '退出当前房间并返回开始页');
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
