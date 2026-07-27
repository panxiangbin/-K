const ROOM_SELECTOR = '.waiting-room-card';
const ENHANCED_CLASS = 'waiting-room-card--enhanced';

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

function readPlayerCount(card) {
  const text = card.querySelector('.waiting-room-count')?.textContent || '';
  const match = text.match(/(?:玩家\s*)?(\d+)\s*\/\s*(\d+)|已到\s*(\d+)\s*人\s*·\s*共\s*(\d+)/);
  if (!match) return { current: 0, max: 0 };
  return {
    current: Number(match[1] || match[3]),
    max: Number(match[2] || match[4]),
  };
}

function isHostView(card) {
  const panel = card.closest('.lobby-panel');
  return [...(panel?.querySelectorAll('button') || [])].some(button => /开始游戏|开始中/.test(button.textContent || ''));
}

function buildSignature(card, current, max, connected, isHost) {
  const players = [...card.querySelectorAll('.waiting-player:not(.waiting-player--empty)')]
    .map(player => `${player.querySelector('.waiting-player-name')?.textContent || ''}:${player.querySelector('.waiting-player-status')?.textContent || ''}`)
    .join('|');
  return `${current}:${max}:${connected ? 1 : 0}:${isHost ? 1 : 0}:${players}`;
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

  const copy = card.querySelector('.waiting-room-copy');
  if (copy) {
    copy.setAttribute('aria-label', '复制房间号');
    copy.setAttribute('title', '复制房间号，发给亲友加入');
  }

  const panel = card.closest('.lobby-panel');
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
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('henan50k-connection-change', scheduleScan);
  return () => {
    observer.disconnect();
    window.removeEventListener('henan50k-connection-change', scheduleScan);
  };
}
