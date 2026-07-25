const SCORE_RANKS = new Set(['5', '10', 'K']);
const CARD_ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '小王', '大王'];

function groupByRank(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
  }
  return groups;
}

function getCombinations(cards, count) {
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

function remainingStructure(hand, playedCards) {
  const playedIds = new Set(playedCards.map(card => card.id));
  const originalGroups = groupByRank(hand);
  const remaining = hand.filter(card => !playedIds.has(card.id));
  const remainingGroups = groupByRank(remaining);
  const groups = [...remainingGroups.entries()];
  let singletons = 0;
  let scoreSingletons = 0;
  let estimatedHands = 0;
  let groupedCards = 0;
  let splitGroups = 0;
  let largestGroup = 0;

  for (const [rank, cards] of groups) {
    const count = cards.length;
    const originalCount = originalGroups.get(rank)?.length || count;
    if (count < originalCount) splitGroups += 1;
    largestGroup = Math.max(largestGroup, count);

    if (count === 1) {
      singletons += 1;
      if (SCORE_RANKS.has(rank)) scoreSingletons += 1;
    } else {
      groupedCards += count;
    }
    estimatedHands += count === 8 ? 1 : Math.ceil(count / 7);
  }

  return {
    scoreSingletons,
    singletons,
    estimatedHands,
    splitGroups,
    largestGroup,
    groupedCards,
  };
}

function compareDamage(a, b) {
  return a.bombsBroken - b.bombsBroken
    || b.preservedBombStrength - a.preservedBombStrength
    || b.preservedBombs - a.preservedBombs
    || a.protectedCardsUsed - b.protectedCardsUsed;
}

function compareStructure(a, b) {
  return a.scoreSingletons - b.scoreSingletons
    || a.singletons - b.singletons
    || a.estimatedHands - b.estimatedHands
    || a.splitGroups - b.splitGroups
    || b.largestGroup - a.largestGroup
    || b.groupedCards - a.groupedCards;
}

function rankStrength(rank) {
  return Math.max(0, CARD_ORDER.indexOf(rank));
}

function optimizeNormalFollowStructure({
  hand,
  lastPlay,
  chosenCards,
  detectPattern,
  comparePatterns,
  findBombs,
  damageProfile,
}) {
  if (!lastPlay || lastPlay.type === 'bomb') return chosenCards;
  if (!Array.isArray(chosenCards) || chosenCards.length === 0 || chosenCards.length === hand.length) {
    return chosenCards;
  }

  const chosenPattern = detectPattern(chosenCards);
  if (!chosenPattern || chosenPattern.type === 'bomb' || chosenPattern.type !== lastPlay.type) {
    return chosenCards;
  }

  const bombs = findBombs(hand);
  const candidates = [];
  for (const group of groupByRank(hand).values()) {
    if (group.length < chosenCards.length) continue;
    for (const cards of getCombinations(group, chosenCards.length)) {
      const pattern = detectPattern(cards);
      if (!pattern || pattern.type !== chosenPattern.type || !comparePatterns(pattern, lastPlay)) continue;
      candidates.push({
        cards,
        pattern,
        damage: damageProfile(cards, bombs),
        structure: remainingStructure(hand, cards),
      });
    }
  }

  if (!candidates.length) return chosenCards;

  candidates.sort((a, b) => compareDamage(a.damage, b.damage)
    || compareStructure(a.structure, b.structure)
    || rankStrength(a.pattern.rank) - rankStrength(b.pattern.rank)
    || a.cards.map(card => card.id).sort().join('|').localeCompare(b.cards.map(card => card.id).sort().join('|')));

  const best = candidates[0];
  const chosenDamage = damageProfile(chosenCards, bombs);
  const damageComparison = compareDamage(best.damage, chosenDamage);
  if (damageComparison > 0) return chosenCards;
  if (damageComparison < 0) return best.cards;

  const chosenStructure = remainingStructure(hand, chosenCards);
  return compareStructure(best.structure, chosenStructure) < 0 ? best.cards : chosenCards;
}

function chooseBotMove(hand, lastPlay, context) {
  const preservation = require('./bot-ai-bomb-preservation');
  const { detectPattern, comparePatterns } = require('./game-logic');
  const chosenCards = preservation.chooseBotMove(hand, lastPlay, context);
  return optimizeNormalFollowStructure({
    hand,
    lastPlay,
    chosenCards,
    detectPattern,
    comparePatterns,
    findBombs: preservation.findBombs,
    damageProfile: preservation.damageProfile,
  });
}

module.exports = {
  chooseBotMove,
  optimizeNormalFollowStructure,
  remainingStructure,
  compareStructure,
};
