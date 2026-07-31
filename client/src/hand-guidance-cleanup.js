const SLIDE_GUIDANCE_PATTERNS = [
  /左右滑动查看全部手牌/,
  /滑动查看全部手牌/,
  /横向滑动多选/,
];

function normalizeText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

export function cleanHandGuidanceText(value = '') {
  const text = normalizeText(value);
  if (!SLIDE_GUIDANCE_PATTERNS.some(pattern => pattern.test(text))) return text;
  return '请选择要出的牌';
}

export function scrubHandGuidance(root = document) {
  let changed = false;

  root.querySelectorAll?.('.game-hand-surface, [data-hand-interaction="true"]').forEach(surface => {
    if (surface.hasAttribute('aria-description')) {
      surface.removeAttribute('aria-description');
      changed = true;
    }
  });

  root.querySelectorAll?.('.game-hand-selection-status > div').forEach(status => {
    const before = normalizeText(status.textContent);
    const after = cleanHandGuidanceText(before);
    if (after !== before) {
      status.textContent = after;
      changed = true;
    }
  });

  return changed;
}

export function installHandGuidanceCleanup(root = document) {
  let queued = false;
  const scan = () => {
    queued = false;
    scrubHandGuidance(root);
  };
  const queueScan = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(scan);
  };

  scan();
  const observer = new MutationObserver(queueScan);
  observer.observe(root.documentElement || root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-description'],
  });

  return () => observer.disconnect();
}
