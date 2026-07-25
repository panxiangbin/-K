const { detectPattern, CARD_ORDER, calcPileScore } = require('./game-logic');
const handStructureAi = require('./bot-ai-hand-structure');
const preservation = require('./bot-ai-bomb-preservation');

const SCORE_RANKS = new Set(['5', '10', 'K']);

function rankStrength(rank) {
  return Math.max(0, CARD_ORDER.indexOf(rank));
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

function leadThreatLevel(context = {}) {
  const pileScore = Number(context.pileScore) || 0;
  const nextCards = Number(context.nextOpponentCards);
  const tableCards = Number(context.globalMinOpponentCards ?? context.minOpponentCards);
  const source = context.threatSource || 'next';

  if (Number.isFinite(nextCards) && nextCards <= 1) return 3;
  if (Number.isFinite(nextCards) && nextCards <= 3) return pileScore >= 20 ? 2 : 1;
  if (source === 'table' && Number.isFinite(tableCards) && tableCards <= 1 && pileScore >= 30) return 2;
  if (source === 'table' && Number.isFinite(tableCards) && tableCards <= 2 && pileScore >= 20) return 1;
  return 0;
}

function leadShapeRisk(cardCount, context = {}, threat = leadThreatLevel(context)) {
  const nextCards = Number(context.nextOpponentCards);
  const source = context.threatSource || 'next';
  if (source !== 'next' || !Number.isFinite(nextCards)) return 0;

  if (nextCards <= 1 && cardCount === 1) return 3600;
  if (nextCards === 2 && cardCount === 2) return threat >= 2 ? 2800 : 1500;
  if (nextCards === 3 && cardCount === 3) return threat >= 2 ? 2400 : 1250;
  return 0;
}

function remainingProfile(hand, playedCards) {
  const playedIds = new Set(playedCards.map(card => card.id));
  const remaining = hand.filter(card => !playedIds.has(card.id));
  const groups = [...groupByRank(remaining).entries()];
  let singletons = 0;
  let scoreSingletons = 0;
  let scoreGroups = 0;
  let controlFloor = CARD_ORDER.length;
  let controlCeiling = 0;

  for (const [rank, cards] of groups) {
    const strength = rankStrength(rank);
    controlFloor = Math.min(controlFloor, strength);
    controlCeiling = Math.max(controlCeiling, strength);
    if (cards.length === 1) {
      singletons += 1;
      if (SCORE_RANKS.has(rank)) scoreSingletons += 1;
    }
    if (SCORE_RANKS.has(rank)) scoreGroups += 1;
  }

  return {
    remaining,
    turns: groups.length,
    singletons,
    scoreSingletons,
    scoreGroups,
    remainingPoints: calcPileScore(remaining),
    controlFloor: groups.length ? controlFloor : 0,
    controlCeiling,
  };
}

function compareDamage(a, b) {
  return a.bombsBroken - b.bombsBroken
    || b.preservedBombStrength - a.preservedBombStrength
    || b.preservedBombs - a.preservedBombs
    || a.protectedCardsUsed - b.protectedCardsUsed;
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

function scoreLeadCandidate(candidate, context, threat) {
  const { cards, pattern, remaining } = candidate;
  let score = 0;

  score += remaining.turns * 420;
  score += remaining.scoreSingletons * 900;
  score += remaining.singletons * 260;
  score += remaining.remainingPoints * (remaining.turns <= 3 ? 20 : 3);
  score += rankStrength(pattern.rank || cards[0].rank) * 8;
  score -= cards.length * 85;
  score += leadShapeRisk(cards.length, context, threat);

  if (threat >= 3) {
    if (cards.length !== 1) score -= Math.min(cards.length, 4) * 260;
    score -= remaining.controlFloor * 45;
    score -= remaining.controlCeiling * 12;
  } else if (threat >= 2) {
    score -= remaining.controlFloor * 24;
  } else if (threat === 1) {
    score -= remaining.controlFloor * 8;
  }

  return score;
}

function optimizeLeadMove({ hand, chosenCards, context = {} }) {
  if (!Array.isArray(hand) || !Array.isArray(chosenCards) || chosenCards.length === 0) return chosenCards;
  if (chosenCards.length === hand.length) return chosenCards;

  const hasOpponent = Number.isFinite(Number(context.nextOpponentCards))
    || Number.isFinite(Number(context.globalMinOpponentCards))
    || Number.isFinite(Number(context.minOpponentCards));
  if (!hasOpponent || context.threatSource === 'none') return chosenCards;

  const threat = leadThreatLevel(context);
  const chosenProfile = remainingProfile(hand, chosenCards);
  const shortEndgame = chosenProfile.turns <= 3 || hand.length <= 7;
  if (threat === 0 && !shortEndgame) return chosenCards;

  const bombs = preservation.findBombs(hand);
  const chosenDamage = preservation.damageProfile(chosenCards, bombs);
  const candidates = enumerateNormalLeads(hand)
    .map(cards => ({
      cards,
      pattern: detectPattern(cards),
      damage: preservation.damageProfile(cards, bombs),
      remaining: remainingProfile(hand, cards),
    }))
    .filter(candidate => compareDamage(candidate.damage, chosenDamage) <= 0);

  if (!candidates.length) return chosenCards;

  candidates.sort((a, b) => compareDamage(a.damage, b.damage)
    || scoreLeadCandidate(a, context, threat) - scoreLeadCandidate(b, context, threat)
    || rankStrength(a.pattern.rank || a.cards[0].rank) - rankStrength(b.pattern.rank || b.cards[0].rank));

  const best = candidates[0];
  const chosen = {
    cards: chosenCards,
    pattern: detectPattern(chosenCards),
    damage: chosenDamage,
    remaining: chosenProfile,
  };

  const damageDifference = compareDamage(best.damage, chosen.damage);
  if (damageDifference < 0) return best.cards;
  if (damageDifference > 0) return chosenCards;
  return scoreLeadCandidate(best, context, threat) < scoreLeadCandidate(chosen, context, threat)
    ? best.cards
    : chosenCards;
}

function chooseBotMove(hand, lastPlay, context = {}) {
  const chosenCards = handStructureAi.chooseBotMove(hand, lastPlay, context);
  if (lastPlay || !chosenCards) return chosenCards;
  return optimizeLeadMove({ hand, chosenCards, context });
}

module.exports = {
  chooseBotMove,
  optimizeLeadMove,
  leadThreatLevel,
  leadShapeRisk,
  remainingProfile,
};