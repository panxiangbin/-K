const { detectPattern, CARD_ORDER, calcPileScore } = require('./game-logic');
const handStructureAi = require('./bot-ai-hand-structure');
const preservation = require('./bot-ai-bomb-preservation');

const SCORE_RANKS = new Set(['5', '10', 'K']);
const EXACT_FINISH_CARD_LIMIT = 10;

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

function cardsFromMask(cards, mask) {
  const selected = [];
  for (let index = 0; index < cards.length; index++) {
    if (mask & (1 << index)) selected.push(cards[index]);
  }
  return selected;
}

function exactFinishProfile(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return { turns: 0, finalPoints: 0, finalControl: 0, finalSize: 0 };
  }
  if (cards.length > EXACT_FINISH_CARD_LIMIT) return null;

  const fullMask = (1 << cards.length) - 1;
  const legalMoves = [];
  for (let mask = 1; mask <= fullMask; mask++) {
    const move = cardsFromMask(cards, mask);
    const pattern = detectPattern(move);
    if (!pattern) continue;
    legalMoves.push({
      mask,
      points: calcPileScore(move),
      control: rankStrength(pattern.rank || move[0].rank),
      size: move.length,
    });
  }

  const memo = new Map([[0, 0]]);
  function solve(mask) {
    if (memo.has(mask)) return memo.get(mask);
    let best = Infinity;
    for (const move of legalMoves) {
      if ((move.mask & mask) !== move.mask) continue;
      const remainingTurns = solve(mask ^ move.mask);
      if (Number.isFinite(remainingTurns)) best = Math.min(best, 1 + remainingTurns);
    }
    memo.set(mask, best);
    return best;
  }

  const turns = solve(fullMask);
  if (!Number.isFinite(turns)) return null;

  const possibleFinalMoves = legalMoves.filter(move => {
    if ((move.mask & fullMask) !== move.mask) return false;
    return solve(fullMask ^ move.mask) === turns - 1;
  });
  possibleFinalMoves.sort((a, b) => a.points - b.points
    || b.control - a.control
    || b.size - a.size);
  const finalMove = possibleFinalMoves[0] || { points: 0, control: 0, size: 0 };

  return {
    turns,
    finalPoints: finalMove.points,
    finalControl: finalMove.control,
    finalSize: finalMove.size,
  };
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

  const exactFinish = exactFinishProfile(remaining);
  return {
    remaining,
    turns: exactFinish?.turns ?? groups.length,
    finalPoints: exactFinish?.finalPoints ?? 0,
    finalControl: exactFinish?.finalControl ?? controlCeiling,
    finalSize: exactFinish?.finalSize ?? 0,
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

function restrictToSafeFinishRoute(candidates) {
  if (!Array.isArray(candidates) || candidates.length < 2) return candidates;

  const safest = [...candidates].sort((a, b) => compareDamage(a.damage, b.damage))[0];
  const equallySafe = candidates.filter(candidate => compareDamage(candidate.damage, safest.damage) === 0);
  const minimumRemainingTurns = Math.min(...equallySafe.map(candidate => candidate.remaining.turns));

  // The current play plus at most two remaining legal plays is a concrete 2–3 move finish route.
  // Once such a route exists, shape blocking may choose among those routes but may not
  // stretch the hand into extra turns.
  if (minimumRemainingTurns > 2) return candidates;
  return equallySafe.filter(candidate => candidate.remaining.turns === minimumRemainingTurns);
}

function scoreLeadCandidate(candidate, context, threat) {
  const { cards, pattern, remaining } = candidate;
  let score = 0;

  score += remaining.turns * 420;
  score += remaining.scoreSingletons * 900;
  score += remaining.singletons * 260;
  score += remaining.remainingPoints * (remaining.turns <= 3 ? 20 : 3);
  score += remaining.finalPoints * (remaining.turns <= 2 ? 32 : 6);
  score -= remaining.finalSize * (remaining.turns <= 2 ? 35 : 8);
  score += rankStrength(pattern.rank || cards[0].rank) * 8;
  score -= cards.length * 85;
  score += leadShapeRisk(cards.length, context, threat);

  if (threat >= 3) {
    if (cards.length !== 1) score -= Math.min(cards.length, 4) * 260;
    score -= remaining.controlFloor * 45;
    score -= remaining.controlCeiling * 12;
    if (remaining.turns <= 2) score -= remaining.finalControl * 30;
  } else if (threat >= 2) {
    score -= remaining.controlFloor * 24;
    if (remaining.turns <= 2) score -= remaining.finalControl * 16;
  } else if (threat === 1) {
    score -= remaining.controlFloor * 8;
    if (remaining.turns <= 2) score -= remaining.finalControl * 6;
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
  const candidates = restrictToSafeFinishRoute(enumerateNormalLeads(hand)
    .map(cards => ({
      cards,
      pattern: detectPattern(cards),
      damage: preservation.damageProfile(cards, bombs),
      remaining: remainingProfile(hand, cards),
    }))
    .filter(candidate => compareDamage(candidate.damage, chosenDamage) <= 0));

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

  if (best.remaining.turns < chosen.remaining.turns && best.remaining.turns <= 2) return best.cards;
  if (chosen.remaining.turns < best.remaining.turns && chosen.remaining.turns <= 2) return chosenCards;

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
  exactFinishProfile,
  remainingProfile,
  restrictToSafeFinishRoute,
};
