const { detectPattern, CARD_ORDER } = require('./game-logic');
const leadStrategy = require('./bot-ai-lead-strategy');
const preservation = require('./bot-ai-bomb-preservation');

const EXACT_ROUTE_CARD_LIMIT = 10;

function rankStrength(rank) {
  return Math.max(0, CARD_ORDER.indexOf(rank));
}

function cardsFromMask(cards, mask) {
  const selected = [];
  for (let index = 0; index < cards.length; index++) {
    if (mask & (1 << index)) selected.push(cards[index]);
  }
  return selected;
}

function exactRouteResilience(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return 0;
  if (cards.length > EXACT_ROUTE_CARD_LIMIT) return null;

  const fullMask = (1 << cards.length) - 1;
  const legalMoves = [];
  for (let mask = 1; mask <= fullMask; mask++) {
    const move = cardsFromMask(cards, mask);
    const pattern = detectPattern(move);
    if (!pattern) continue;
    legalMoves.push({
      mask,
      control: rankStrength(pattern.rank || move[0].rank),
    });
  }

  const turnMemo = new Map([[0, 0]]);
  function minimumTurns(mask) {
    if (turnMemo.has(mask)) return turnMemo.get(mask);
    let best = Infinity;
    for (const move of legalMoves) {
      if ((move.mask & mask) !== move.mask) continue;
      const remainder = minimumTurns(mask ^ move.mask);
      if (Number.isFinite(remainder)) best = Math.min(best, 1 + remainder);
    }
    turnMemo.set(mask, best);
    return best;
  }

  const resilienceMemo = new Map([[0, CARD_ORDER.length]]);
  function resilience(mask) {
    if (resilienceMemo.has(mask)) return resilienceMemo.get(mask);
    const turns = minimumTurns(mask);
    let best = -1;
    for (const move of legalMoves) {
      if ((move.mask & mask) !== move.mask) continue;
      const remainingMask = mask ^ move.mask;
      if (minimumTurns(remainingMask) !== turns - 1) continue;
      best = Math.max(best, Math.min(move.control, resilience(remainingMask)));
    }
    resilienceMemo.set(mask, Math.max(0, best));
    return resilienceMemo.get(mask);
  }

  return resilience(fullMask);
}

function groupByRank(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
  }
  return groups;
}

function combinations(cards, count) {
  const results = [];
  const picked = [];
  function visit(start) {
    if (picked.length === count) {
      results.push([...picked]);
      return;
    }
    const needed = count - picked.length;
    for (let index = start; index <= cards.length - needed; index++) {
      picked.push(cards[index]);
      visit(index + 1);
      picked.pop();
    }
  }
  visit(0);
  return results;
}

function enumerateNormalLeads(hand) {
  const candidates = [];
  for (const group of groupByRank(hand).values()) {
    candidates.push([group[0]]);
    for (let count = 2; count <= Math.min(7, group.length); count++) {
      for (const cards of combinations(group, count)) {
        const pattern = detectPattern(cards);
        if (pattern && pattern.type !== 'bomb') candidates.push(cards);
      }
    }
  }
  return candidates;
}

function compareDamage(a, b) {
  return a.bombsBroken - b.bombsBroken
    || b.preservedBombStrength - a.preservedBombStrength
    || b.preservedBombs - a.preservedBombs
    || a.protectedCardsUsed - b.protectedCardsUsed;
}

function optimizeResilientLead({ hand, chosenCards, context = {} }) {
  if (!Array.isArray(hand) || !Array.isArray(chosenCards) || chosenCards.length === 0) return chosenCards;
  if (chosenCards.length === hand.length) return chosenCards;
  if (context.threatSource === 'none') return chosenCards;

  const chosenRemaining = leadStrategy.remainingProfile(hand, chosenCards);
  if (chosenRemaining.turns < 2 || chosenRemaining.turns > 2) return chosenCards;

  const bombs = preservation.findBombs(hand);
  const chosenDamage = preservation.damageProfile(chosenCards, bombs);
  const chosenResilience = exactRouteResilience(chosenRemaining.remaining);
  if (chosenResilience === null) return chosenCards;

  const candidates = enumerateNormalLeads(hand)
    .map(cards => ({
      cards,
      remaining: leadStrategy.remainingProfile(hand, cards),
      damage: preservation.damageProfile(cards, bombs),
    }))
    .filter(candidate => candidate.remaining.turns === chosenRemaining.turns)
    .filter(candidate => compareDamage(candidate.damage, chosenDamage) <= 0)
    .map(candidate => ({
      ...candidate,
      resilience: exactRouteResilience(candidate.remaining.remaining),
    }))
    .filter(candidate => candidate.resilience !== null);

  if (!candidates.length) return chosenCards;

  candidates.sort((a, b) => compareDamage(a.damage, b.damage)
    || b.resilience - a.resilience
    || a.remaining.finalPoints - b.remaining.finalPoints
    || b.remaining.finalControl - a.remaining.finalControl
    || a.remaining.remainingPoints - b.remaining.remainingPoints);

  const best = candidates[0];
  if (compareDamage(best.damage, chosenDamage) < 0) return best.cards;
  if (best.resilience > chosenResilience) return best.cards;
  return chosenCards;
}

function chooseBotMove(hand, lastPlay, context = {}) {
  const chosenCards = leadStrategy.chooseBotMove(hand, lastPlay, context);
  if (lastPlay || !chosenCards) return chosenCards;
  return optimizeResilientLead({ hand, chosenCards, context });
}

module.exports = {
  chooseBotMove,
  optimizeResilientLead,
  exactRouteResilience,
};
