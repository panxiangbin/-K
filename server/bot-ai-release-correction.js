const { detectPattern, comparePatterns, CARD_ORDER } = require('./game-logic');

function rankStrength(rank) {
  return Math.max(0, CARD_ORDER.indexOf(rank));
}

function groupByRank(cards) {
  const groups = new Map();
  for (const card of Array.isArray(cards) ? cards : []) {
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

function damageTools() {
  const preservation = require('./bot-ai-bomb-preservation');
  return {
    findBombs: preservation.findBombs,
    damageProfile: preservation.damageProfile,
  };
}

function compareDamage(a, b) {
  return a.bombsBroken - b.bombsBroken
    || b.preservedBombs - a.preservedBombs
    || a.protectedCardsUsed - b.protectedCardsUsed
    || b.preservedBombStrength - a.preservedBombStrength;
}

function remainingProfile(hand, playedCards) {
  const used = new Set(playedCards.map(card => card.id));
  const groups = [...groupByRank(hand.filter(card => !used.has(card.id))).values()];
  const controlGroups = groups.filter(group => group.length >= 2).sort((a, b) => {
    const rankDiff = rankStrength(b[0].rank) - rankStrength(a[0].rank);
    return rankDiff || b.length - a.length;
  });
  return {
    groups: groups.length,
    singletons: groups.filter(group => group.length === 1).length,
    controlRank: controlGroups[0] ? rankStrength(controlGroups[0][0].rank) : -1,
    controlSize: controlGroups[0]?.length || 0,
  };
}

function currentThreatCards(context = {}) {
  for (const value of [context.nextOpponentCards, context.minOpponentCards, context.globalMinOpponentCards]) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return Infinity;
}

function preferCompleteLead(hand, chosenCards, context = {}) {
  if (!Array.isArray(chosenCards) || chosenCards.length === 0 || chosenCards.length === hand.length) return chosenCards;
  const chosenPattern = detectPattern(chosenCards);
  if (!chosenPattern || chosenPattern.type === 'bomb') return chosenCards;

  const { findBombs, damageProfile } = damageTools();
  const bombs = findBombs(hand);
  const chosenDamage = damageProfile(chosenCards, bombs);
  const threatCards = currentThreatCards(context);
  const candidates = [];

  for (const group of groupByRank(hand).values()) {
    if (group.length < 2 || group.length > 7) continue;
    const pattern = detectPattern(group);
    if (!pattern || pattern.type === 'bomb') continue;
    if (threatCards >= 1 && threatCards <= 3 && group.length === threatCards) continue;
    const damage = damageProfile(group, bombs);
    if (compareDamage(damage, chosenDamage) > 0) continue;
    candidates.push({
      cards: group,
      pattern,
      damage,
      remaining: remainingProfile(hand, group),
    });
  }

  if (!candidates.length) return chosenCards;
  const chosenRemaining = remainingProfile(hand, chosenCards);
  candidates.sort((a, b) => compareDamage(a.damage, b.damage)
    || a.remaining.groups - b.remaining.groups
    || a.remaining.singletons - b.remaining.singletons
    || b.remaining.controlRank - a.remaining.controlRank
    || b.remaining.controlSize - a.remaining.controlSize
    || b.cards.length - a.cards.length
    || rankStrength(a.pattern.rank) - rankStrength(b.pattern.rank));

  const best = candidates[0];
  if (best.remaining.groups > chosenRemaining.groups) return chosenCards;
  return best.cards;
}

function chooseMinimumDamageFollow(hand, lastPlay, chosenCards) {
  if (!lastPlay || !Array.isArray(chosenCards) || chosenCards.length === 0) return chosenCards;
  const chosenPattern = detectPattern(chosenCards);
  if (!chosenPattern || chosenPattern.type === 'bomb') return chosenCards;

  const { findBombs, damageProfile } = damageTools();
  const bombs = findBombs(hand);
  const chosenDamage = damageProfile(chosenCards, bombs);
  const requiredCount = chosenCards.length;
  const candidates = [];

  for (const group of groupByRank(hand).values()) {
    if (group.length < requiredCount) continue;
    for (const cards of combinations(group, requiredCount)) {
      const pattern = detectPattern(cards);
      if (!pattern || pattern.type === 'bomb' || pattern.type !== lastPlay.type) continue;
      if (!comparePatterns(pattern, lastPlay)) continue;
      const damage = damageProfile(cards, bombs);
      if (compareDamage(damage, chosenDamage) > 0) continue;
      candidates.push({ cards, pattern, damage });
    }
  }

  if (!candidates.length) return chosenCards;
  candidates.sort((a, b) => a.damage.bombsBroken - b.damage.bombsBroken
    || b.damage.preservedBombs - a.damage.preservedBombs
    || a.damage.protectedCardsUsed - b.damage.protectedCardsUsed
    // 损伤相同先用最小合法点数，避免从10无谓抬到K。
    || rankStrength(a.pattern.rank) - rankStrength(b.pattern.rank)
    || b.damage.preservedBombStrength - a.damage.preservedBombStrength
    || a.cards.map(card => card.id).sort().join('|').localeCompare(b.cards.map(card => card.id).sort().join('|')));
  return candidates[0].cards;
}

function correctBotMove(hand, lastPlay, chosenCards, context = {}) {
  if (!Array.isArray(hand) || !Array.isArray(chosenCards) || chosenCards.length === 0) return chosenCards;
  return lastPlay
    ? chooseMinimumDamageFollow(hand, lastPlay, chosenCards)
    : preferCompleteLead(hand, chosenCards, context);
}

function wrapChooseBotMove(baseChoose) {
  if (typeof baseChoose !== 'function') throw new TypeError('baseChoose must be a function');
  return function chooseBotMoveWithReleaseCorrection(hand, lastPlay, context = {}) {
    const chosen = baseChoose(hand, lastPlay, context);
    return correctBotMove(hand, lastPlay, chosen, context);
  };
}

function wrapChooseWithBase(baseChooseWithBase) {
  if (typeof baseChooseWithBase !== 'function') throw new TypeError('baseChooseWithBase must be a function');
  return function chooseWithBaseReleaseCorrection(hand, lastPlay, baseChoose, context = {}) {
    const chosen = baseChooseWithBase(hand, lastPlay, baseChoose, context);
    return correctBotMove(hand, lastPlay, chosen, context);
  };
}

module.exports = {
  correctBotMove,
  preferCompleteLead,
  chooseMinimumDamageFollow,
  wrapChooseBotMove,
  wrapChooseWithBase,
};
