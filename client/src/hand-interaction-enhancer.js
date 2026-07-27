const CARD_SELECTOR = '[data-card-id]';

export function getHandDensity(cardCount = 0) {
  if (cardCount > 18) return 'dense';
  if (cardCount > 10) return 'compact';
  return 'comfortable';
}

export function cardAccessibleLabel(cardNode, index = 0) {
  const text = String(cardNode?.textContent || '').replace(/\s+/g, ' ').trim();
  return text ? `第${index + 1}张牌，${text}` : `第${index + 1}张牌`;
}

function isCardSelected(cardNode) {
  return Boolean(
    cardNode?.querySelector?.('[style*="translateY(var(--card-selected-offset"]') ||
    String(cardNode?.style?.filter || '').includes('drop-shadow')
  );
}

export function syncCardAccessibility(cardNode, index = 0, total = 1, tabbable = false) {
  if (!(cardNode instanceof HTMLElement)) return;
  const selected = isCardSelected(cardNode);
  cardNode.setAttribute('role', 'button');
  cardNode.setAttribute('tabindex', tabbable ? '0' : '-1');
  cardNode.setAttribute('aria-pressed', selected ? 'true' : 'false');
  cardNode.setAttribute('aria-posinset', String(index + 1));
  cardNode.setAttribute('aria-setsize', String(total));
  cardNode.dataset.cardPosition = index === 0 ? 'first' : index === total - 1 ? 'last' : 'middle';
  cardNode.setAttribute('aria-label', `${cardAccessibleLabel(cardNode, index)}，${selected ? '已选中' : '未选中'}`);
}

function prefersReducedMotion() {
  return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function setRovingFocus(cards, target) {
  cards.forEach(card => card.setAttribute('tabindex', card === target ? '0' : '-1'));
  target?.focus?.({ preventScroll: true });
  target?.scrollIntoView?.({
    block: 'nearest',
    inline: 'center',
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
}

export function enhanceHand(root = document) {
  const cards = [...root.querySelectorAll(CARD_SELECTOR)];
  if (!cards.length) return 0;
  const hand = cards[0].parentElement?.parentElement;
  const activeCard = cards.find(card => card === root.activeElement);
  const firstSelected = cards.find(isCardSelected);
  const tabbableCard = activeCard || firstSelected || cards[0];
  const selectedCount = cards.filter(isCardSelected).length;

  if (hand instanceof HTMLElement) {
    hand.setAttribute('data-hand-interaction', 'true');
    hand.setAttribute('data-hand-density', getHandDensity(cards.length));
    hand.setAttribute('data-hand-count', String(cards.length));
    hand.setAttribute('data-selected-count', String(selectedCount));
    hand.setAttribute('role', 'group');
    hand.setAttribute('aria-label', `你的手牌，共${cards.length}张，已选${selectedCount}张。可点击、回车或空格选择，方向键移动焦点。`);
  }

  cards.forEach((card, index) => syncCardAccessibility(card, index, cards.length, card === tabbableCard));
  return cards.length;
}

function handleCardKeydown(event) {
  const card = event.target?.closest?.(CARD_SELECTOR);
  if (!card) return;
  const cards = [...document.querySelectorAll(CARD_SELECTOR)];
  const index = cards.indexOf(card);
  if (index < 0) return;

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    card.click();
    queueMicrotask(() => enhanceHand(document));
    return;
  }

  let targetIndex = null;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') targetIndex = Math.max(0, index - 1);
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') targetIndex = Math.min(cards.length - 1, index + 1);
  if (event.key === 'Home') targetIndex = 0;
  if (event.key === 'End') targetIndex = cards.length - 1;
  if (targetIndex === null) return;

  event.preventDefault();
  setRovingFocus(cards, cards[targetIndex]);
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
