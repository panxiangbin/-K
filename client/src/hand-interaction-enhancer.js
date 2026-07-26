const CARD_SELECTOR = '[data-card-id]';
const HAND_SELECTOR = '[data-hand-interaction]';

export function cardAccessibleLabel(cardNode, index = 0) {
  const text = String(cardNode?.textContent || '').replace(/\s+/g, ' ').trim();
  return text ? `第${index + 1}张牌，${text}` : `第${index + 1}张牌`;
}

export function syncCardAccessibility(cardNode, index = 0) {
  if (!(cardNode instanceof HTMLElement)) return;
  const selected = Boolean(cardNode.querySelector('[style*="translateY(var(--card-selected-offset"]')) ||
    String(cardNode.style.filter || '').includes('drop-shadow'));
  cardNode.setAttribute('role', 'button');
  cardNode.setAttribute('tabindex', '0');
  cardNode.setAttribute('aria-pressed', selected ? 'true' : 'false');
  cardNode.setAttribute('aria-label', `${cardAccessibleLabel(cardNode, index)}，${selected ? '已选中' : '未选中'}`);
}

export function enhanceHand(root = document) {
  const cards = [...root.querySelectorAll(CARD_SELECTOR)];
  if (!cards.length) return 0;
  const hand = cards[0].parentElement?.parentElement;
  if (hand instanceof HTMLElement) {
    hand.setAttribute('data-hand-interaction', 'true');
    hand.setAttribute('role', 'group');
    hand.setAttribute('aria-label', `你的手牌，共${cards.length}张。可点击、回车或空格选择。`);
  }
  cards.forEach(syncCardAccessibility);
  return cards.length;
}

function handleCardKeydown(event) {
  const card = event.target?.closest?.(CARD_SELECTOR);
  if (!card || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  card.click();
  queueMicrotask(() => enhanceHand(document));
}

export function installHandInteractionEnhancer(root = document) {
  if (globalThis.__henan50kHandInteractionCleanup) return globalThis.__henan50kHandInteractionCleanup;
  const refresh = () => enhanceHand(root);
  root.addEventListener('keydown', handleCardKeydown);
  const observer = new MutationObserver(refresh);
  observer.observe(root.documentElement || root.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  refresh();
  const cleanup = () => {
    observer.disconnect();
    root.removeEventListener('keydown', handleCardKeydown);
    delete globalThis.__henan50kHandInteractionCleanup;
  };
  globalThis.__henan50kHandInteractionCleanup = cleanup;
  return cleanup;
}
