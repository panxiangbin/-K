export const SERVER_REJECTION_EVENT = 'henan50k-server-rejection';

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

export function normalizeServerError(message) {
  const raw = String(message || '').trim();
  if (!raw) return '操作没有成功，请等待状态更新后重试。';
  return LEGACY_MESSAGES.get(raw) || raw;
}

export function isTableActionRejection(message) {
  const text = normalizeServerError(message);
  return TABLE_REJECTION_MARKERS.some((marker) => text.includes(marker));
}

export function publishServerRejection(message, target = globalThis) {
  const text = normalizeServerError(message);
  if (typeof target?.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    target.dispatchEvent(new CustomEvent(SERVER_REJECTION_EVENT, {
      detail: { text, tableAction: isTableActionRejection(text) },
    }));
  }
  return text;
}
