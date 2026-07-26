import {
  GLOBAL_STATUS_CHANNELS,
  GLOBAL_STATUS_PRIORITY,
  publishGlobalStatus,
} from './global-status-priority';

export const SERVER_REJECTION_EVENT = 'henan50k-server-rejection';
export const SERVER_ERROR_BANNER_ID = 'henan50k-server-error-feedback';
export const SERVER_ERROR_DEDUPE_MS = 1800;

const LEGACY_MESSAGES = new Map([
  ['房间不存在', '房间不存在或已经关闭，请检查房间号后重新加入。'],
  ['房间已满', '房间人数已满，请加入其他房间。'],
  ['还没轮到你', '还没轮到你，请等待当前玩家完成操作。'],
  ['非法牌型', '所选牌型不合法。只能出单张、对子、三张、四至七张同点牌或合法炸弹。'],
  ['不够大', '所选牌压不过上一手。请换同类型、同张数的更大牌，或使用合法炸弹。'],
  ['先手不能过牌', '你是本轮先手，必须出牌，不能过牌。'],
  ['你有能压的牌，必须出！', '你有合法更大牌，必须压牌，不能直接过牌。'],
  ['牌不在手中', '手牌状态已经变化，已为你同步最新手牌，请重新选择。'],
]);

const TABLE_REJECTION_MARKERS = [
  '还没轮到你',
  '牌型不合法',
  '压不过上一手',
  '手牌状态已经变化',
  '先手',
  '必须压牌',
  '对局尚未开始',
];

const LONG_ERROR_MARKERS = [
  '牌型不合法',
  '压不过上一手',
  '必须压牌',
  '房间不存在',
  '房间人数已满',
  '连接',
  '对局',
];

let lastPublished = { key: '', at: 0 };
let bannerTimer = null;

export function normalizeServerError(message) {
  const raw = String(message || '').trim();
  if (!raw) return '操作没有成功，请等待状态更新后重试。';
  return LEGACY_MESSAGES.get(raw) || raw;
}

export function isTableActionRejection(message) {
  const text = normalizeServerError(message);
  return TABLE_REJECTION_MARKERS.some((marker) => text.includes(marker));
}

export function getServerErrorDuration(message) {
  const text = normalizeServerError(message);
  if (LONG_ERROR_MARKERS.some((marker) => text.includes(marker))) return 6500;
  return text.length >= 28 ? 5200 : 3800;
}

export function getServerErrorKey(message) {
  return normalizeServerError(message).replace(/^[⚠️\s]+/u, '').replace(/\s+/g, ' ').trim();
}

export function shouldPublishServerError(message, now = Date.now()) {
  const key = getServerErrorKey(message);
  if (key === lastPublished.key && now - lastPublished.at < SERVER_ERROR_DEDUPE_MS) return false;
  lastPublished = { key, at: now };
  return true;
}

export function resetServerErrorDedupe() {
  lastPublished = { key: '', at: 0 };
}

function showPersistentServerError(text, duration, target) {
  const doc = target?.document;
  if (!doc?.body || typeof doc.createElement !== 'function') return;

  let banner = doc.getElementById(SERVER_ERROR_BANNER_ID);
  if (!banner) {
    banner = doc.createElement('div');
    banner.id = SERVER_ERROR_BANNER_ID;
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'assertive');
    banner.setAttribute('aria-atomic', 'true');
    Object.assign(banner.style, {
      position: 'fixed',
      left: '50%',
      top: 'max(64px, env(safe-area-inset-top))',
      transform: 'translateX(-50%)',
      zIndex: '2100',
      width: 'min(560px, calc(100vw - 24px))',
      boxSizing: 'border-box',
      padding: '11px 16px',
      borderRadius: '16px',
      border: '1px solid rgba(248, 113, 113, .58)',
      background: 'rgba(127, 29, 29, .97)',
      color: '#fee2e2',
      boxShadow: '0 12px 32px rgba(0, 0, 0, .38)',
      fontSize: '14px',
      fontWeight: '750',
      lineHeight: '1.55',
      textAlign: 'center',
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      pointerEvents: 'none',
    });
    doc.body.appendChild(banner);
  }

  banner.textContent = text;
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    banner.remove();
    bannerTimer = null;
  }, duration);
}

export function publishServerRejection(message, target = globalThis, now = Date.now()) {
  const text = normalizeServerError(message);
  const duration = getServerErrorDuration(text);
  const tableAction = isTableActionRejection(text);
  const publish = shouldPublishServerError(text, now);

  if (publish) {
    publishGlobalStatus(
      GLOBAL_STATUS_CHANNELS.SERVER_ERROR,
      null,
      { priority: GLOBAL_STATUS_PRIORITY.SERVER_ERROR, duration, visible: false },
      target,
    );
    showPersistentServerError(text, duration, target);
    if (typeof target?.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      target.dispatchEvent(new CustomEvent(SERVER_REJECTION_EVENT, {
        detail: { text, tableAction, duration, dedupeKey: getServerErrorKey(text) },
      }));
    }
  }

  return text;
}
