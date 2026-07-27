const SETTLEMENT_SELECTOR = '.settlement-page';

function textOf(node) {
  return (node?.textContent || '').replace(/\s+/g, ' ').trim();
}

function classifyResult(page) {
  const summary = page.querySelector('#settlement-result-summary');
  const text = textOf(summary);
  const won = text.includes('达标') && !text.includes('未达标');
  page.dataset.result = won ? 'win' : 'loss';
  return won;
}

function enhanceTopActions(page) {
  const nav = page.querySelector('.settlement-top-actions');
  if (!nav) return;
  nav.classList.add('settlement-experience-actions');
  nav.querySelectorAll('button').forEach((button) => {
    button.classList.add('settlement-experience-action');
    button.removeAttribute('style');
  });
}

function enhanceHero(page, won) {
  const hero = page.querySelector('.settlement-hero');
  if (!hero) return;
  hero.classList.add('settlement-experience-hero');
  hero.setAttribute('aria-label', won ? '本局胜负结果' : '本局未达标结果');

  const score = hero.querySelector('.settlement-leader-score');
  if (score) score.classList.add('settlement-experience-score');

  const room = hero.querySelector('.settlement-room-copy');
  if (room) room.classList.add('settlement-experience-room');
}

function enhanceScoreCards(page) {
  const cards = [...page.querySelectorAll('.settlement-score-card')];
  cards.forEach((card, index) => {
    card.classList.add('settlement-experience-card');
    card.dataset.rank = String(index + 1);
    card.removeAttribute('style');

    const detail = card.querySelector('.settlement-score-detail');
    if (detail) detail.classList.add('settlement-experience-detail');

    const label = card.getAttribute('aria-label') || '';
    card.dataset.outcome = label.includes('达标获胜') ? 'qualified' : 'unqualified';
    if (label.includes('这是你')) card.dataset.self = 'true';
  });
}

function enhanceHistory(page) {
  const history = page.querySelector('.settlement-history');
  if (!history) return;
  history.classList.add('settlement-experience-history');
  history.removeAttribute('style');
}

function enhanceNextRound(page) {
  const area = page.querySelector('.settlement-next-round');
  if (!area) return;
  area.classList.add('settlement-experience-next');

  const button = area.querySelector('.settlement-next-button');
  if (button) {
    button.classList.add('settlement-experience-primary');
    button.removeAttribute('style');
    button.setAttribute('aria-label', `${textOf(button)}，开始下一局`);
  }

  const status = area.querySelector('#settlement-action-status');
  if (status) {
    status.classList.add('settlement-experience-status');
    status.removeAttribute('style');
  }
}

function enhanceSettlement(page) {
  if (!page || page.dataset.settlementExperience === 'ready') return;
  page.dataset.settlementExperience = 'ready';
  page.classList.add('settlement-experience');
  page.removeAttribute('style');

  const won = classifyResult(page);
  enhanceTopActions(page);
  enhanceHero(page, won);
  enhanceScoreCards(page);
  enhanceHistory(page);
  enhanceNextRound(page);
}

export function installSettlementExperience() {
  let queued = false;
  const scan = () => {
    queued = false;
    document.querySelectorAll(SETTLEMENT_SELECTOR).forEach(enhanceSettlement);
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(scan);
  };

  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => observer.disconnect();
}
