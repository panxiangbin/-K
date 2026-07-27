const CONNECTION_EVENT = 'henan50k-connection-change';
const GUIDANCE_ID = 'lobby-action-guidance';
const CHOICE_GUIDANCE_ID = 'lobby-choice-guidance';

function findButtonByText(root, text) {
  return [...root.querySelectorAll('button')].find(button => button.textContent.includes(text)) || null;
}

function ensureStatusElement(parent, id, className) {
  let element = parent.querySelector(`#${id}`);
  if (!element) {
    element = document.createElement('p');
    element.id = id;
    element.className = className;
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.setAttribute('aria-atomic', 'true');
    parent.appendChild(element);
  }
  return element;
}

function describeButton(button, id) {
  if (!button) return;
  const existing = (button.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  if (!existing.includes(id)) existing.push(id);
  button.setAttribute('aria-describedby', existing.join(' '));
}

export function installLobbyActionGuidance() {
  let connected = Boolean(window.__henan50kConnected);
  let scheduled = false;

  function update() {
    scheduled = false;
    const panel = document.querySelector('.lobby-panel');
    if (!panel) return;

    const homeGrid = panel.querySelector('.lobby-action-grid');
    const nameInput = panel.querySelector('#player-name');
    if (homeGrid && nameInput) {
      const guidance = ensureStatusElement(homeGrid.parentElement, GUIDANCE_ID, 'lobby-action-guidance');
      const hasName = Boolean(nameInput.value.trim());
      if (!connected) {
        guidance.textContent = '联网入口正在等待服务器连接；你可以先填写昵称，连接后即可创建或加入房间。';
        guidance.dataset.tone = 'waiting';
      } else if (!hasName) {
        guidance.textContent = '创建或加入房间前需要填写昵称；单机练习不需要昵称。';
        guidance.dataset.tone = 'hint';
      } else {
        guidance.textContent = '联网功能已可用，可以创建房间或输入房间号加入。';
        guidance.dataset.tone = 'ready';
      }
      describeButton(findButtonByText(homeGrid, '创建房间'), GUIDANCE_ID);
      describeButton(findButtonByText(homeGrid, '加入房间'), GUIDANCE_ID);
    }

    const choiceGrid = panel.querySelector('.lobby-choice-grid');
    if (choiceGrid) {
      const guidance = ensureStatusElement(choiceGrid.parentElement, CHOICE_GUIDANCE_ID, 'lobby-choice-guidance');
      const disabledChoices = [...choiceGrid.querySelectorAll('button:disabled')];
      if (!connected && disabledChoices.length) {
        guidance.textContent = '服务器尚未连接，返回开始页等待连接，或稍后重新尝试。';
        guidance.dataset.tone = 'waiting';
      } else if (disabledChoices.length) {
        guidance.textContent = '请求正在处理中，请稍候。';
        guidance.dataset.tone = 'busy';
      } else {
        guidance.textContent = '';
        guidance.removeAttribute('data-tone');
      }
      [...choiceGrid.querySelectorAll('button')].forEach(button => describeButton(button, CHOICE_GUIDANCE_ID));
    }

    const backButton = panel.querySelector('.lobby-back-button');
    if (backButton) {
      backButton.setAttribute('aria-label', '返回开始页');
      backButton.setAttribute('title', '返回开始页');
    }
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(update);
  }

  const observer = new MutationObserver(scheduleUpdate);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-busy'] });
  document.addEventListener('input', scheduleUpdate, true);
  window.addEventListener(CONNECTION_EVENT, event => {
    connected = Boolean(event.detail?.connected);
    scheduleUpdate();
  });
  scheduleUpdate();
}
