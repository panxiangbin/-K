const ROOM_PATTERN = /房间\s*([^\s·]+)/;

export function extractTableRoomId(text = '') {
  const match = String(text).match(ROOM_PATTERN);
  return match?.[1]?.trim() || '';
}

export function getTableRoomCopyState({ roomId = '', copying = false, outcome = 'idle', solo = false } = {}) {
  if (solo || !roomId) {
    return { visible: false, disabled: true, label: '', announcement: '' };
  }
  if (copying) {
    return { visible: true, disabled: true, label: '复制中…', announcement: '正在复制房间号' };
  }
  if (outcome === 'success') {
    return { visible: true, disabled: false, label: '已复制', announcement: `房间号${roomId}已复制` };
  }
  if (outcome === 'error') {
    return { visible: true, disabled: false, label: '重试复制', announcement: '复制失败，请长按房间号手动复制' };
  }
  return { visible: true, disabled: false, label: '复制', announcement: `复制房间号${roomId}` };
}

export async function copyTableRoomId(roomId, clipboard = globalThis.navigator?.clipboard) {
  const text = String(roomId || '').trim();
  if (!text) return false;
  try {
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return true;
    }
    if (typeof document === 'undefined') return false;
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand?.('copy') === true;
    input.remove();
    return ok;
  } catch {
    return false;
  }
}

function applyHeaderClasses(header) {
  if (!header || header.children.length < 3) return null;
  header.classList.add('game-table-header');
  header.children[0]?.classList.add('game-table-header__actions');
  header.children[1]?.classList.add('game-table-header__room');
  header.children[2]?.classList.add('game-table-header__turn');
  return header.children[1];
}

function enhanceHeader(root) {
  const topAction = root.querySelector?.('.top-action');
  const header = topAction?.parentElement?.parentElement;
  const room = applyHeaderClasses(header);
  if (!room || room.querySelector('.game-table-room-copy')) return;

  const text = room.textContent || '';
  const solo = text.includes('人单机');
  const roomId = extractTableRoomId(text);
  const initial = getTableRoomCopyState({ roomId, solo });
  if (!initial.visible) return;

  const status = document.createElement('span');
  status.className = 'game-table-room-copy-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'game-table-room-copy';
  button.textContent = initial.label;
  button.setAttribute('aria-label', initial.announcement);

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    let state = getTableRoomCopyState({ roomId, copying: true });
    button.disabled = state.disabled;
    button.textContent = state.label;
    status.textContent = state.announcement;

    const copied = await copyTableRoomId(roomId);
    state = getTableRoomCopyState({ roomId, outcome: copied ? 'success' : 'error' });
    button.disabled = state.disabled;
    button.textContent = state.label;
    button.setAttribute('aria-label', state.announcement);
    status.textContent = state.announcement;

    if (copied) {
      setTimeout(() => {
        if (!button.isConnected) return;
        const idle = getTableRoomCopyState({ roomId });
        button.textContent = idle.label;
        button.setAttribute('aria-label', idle.announcement);
      }, 1800);
    }
  });

  room.append(' ');
  room.appendChild(button);
  room.appendChild(status);
}

function resolveRoot(root) {
  if (root) return root;
  const documentObject = globalThis.document;
  if (!documentObject || typeof documentObject.getElementById !== 'function') return null;
  return documentObject.getElementById('root');
}

export function installGameTableHeaderEnhancer(root = null) {
  const resolvedRoot = resolveRoot(root);
  if (!resolvedRoot || typeof MutationObserver === 'undefined') return () => {};
  const run = () => enhanceHeader(resolvedRoot);
  const observer = new MutationObserver(run);
  observer.observe(resolvedRoot, { childList: true, subtree: true });
  run();
  return () => observer.disconnect();
}
