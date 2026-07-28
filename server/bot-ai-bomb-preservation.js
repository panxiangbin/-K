const { detectPattern, comparePatterns } = require('./game-logic');
const baseBotAi = require('./bot-ai');

const CARD_ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '小王', '大王'];
const BOMB_LEVEL = { '50K': 1, color4: 2, same8: 3, joker4: 4 };
const SUIT_ORDER = { '♠': 4, '♥': 3, '♣': 2, '♦': 1 };
const NORMAL_PATTERN_LENGTH = {
  single: 1,
  pair: 2,
  triple: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
};

function isBlack(suit) {
  return suit === '♠' || suit === '♣';
}

function isRed(suit) {
  return suit === '♥' || suit === '♦';
}

function groupByRank(hand) {
  const groups = new Map();
  for (const card of hand) {
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

function findBombs(hand) {
  const bombs = [];
  const groups = groupByRank(hand);

  for (const group of groups.values()) {
    if (group.length >= 8) bombs.push(group.slice(0, 8));

    const blacks = group.filter(card => isBlack(card.suit));
    const reds = group.filter(card => isRed(card.suit));
    if (blacks.length >= 4) bombs.push(blacks.slice(0, 4));
    if (reds.length >= 4) bombs.push(reds.slice(0, 4));
  }

  for (const suit of ['♠', '♥', '♣', '♦']) {
    const fives = hand.filter(card => card.rank === '5' && card.suit === suit);
    const tens = hand.filter(card => card.rank === '10' && card.suit === suit);
    const kings = hand.filter(card => card.rank === 'K' && card.suit === suit);
    const count = Math.min(fives.length, tens.length, kings.length);
    for (let index = 0; index < count; index++) {
      bombs.push([fives[index], tens[index], kings[index]]);
    }
  }

  const small = hand.filter(card => card.rank === '小王');
  const big = hand.filter(card => card.rank === '大王');
  if (small.length >= 2 && big.length >= 2) {
    bombs.push([small[0], small[1], big[0], big[1]]);
  }

  return bombs;
}

function rankStrength(rank) {
  return Math.max(0, CARD_ORDER.indexOf(rank));
}

function suitPreservationCost(cards) {
  return cards.reduce((total, card) => total + (SUIT_ORDER[card.suit] || 0), 0);
}

function bombStrength(bomb) {
  const pattern = detectPattern(bomb);
  if (!pattern || pattern.type !== 'bomb') return 0;

  const level = BOMB_LEVEL[pattern.bombType] || 0;
  if (pattern.bombType === 'joker4') return level * 10000;
  if (pattern.bombType === 'same8') return level * 10000 + rankStrength(pattern.rank) * 10;
  if (pattern.bombType === 'color4') {
    const colorStrength = pattern.color === 'black' ? 2 : 1;
    return level * 10000 + rankStrength(pattern.rank) * 10 + colorStrength;
  }
  if (pattern.bombType === '50K') {
    return level * 10000 + (SUIT_ORDER[pattern.suit] || 0);
  }
  return level * 10000;
}

function damageProfile(cards, bombs) {
  const playedIds = new Set(cards.map(card => card.id));
  let bombsBroken = 0;
  let protectedCardsUsed = 0;
  let preservedBombStrength = 0;
  let preservedBombs = 0;
  const protectedIds = new Set();

  for (const bomb of bombs) {
    const bombIds = bomb.map(card => card.id);
    const hitCount = bombIds.filter(id => playedIds.has(id)).length;
    if (hitCount > 0 && hitCount < bombIds.length) bombsBroken += 1;
    if (hitCount === 0) {
      preservedBombs += 1;
      preservedBombStrength += bombStrength(bomb);
    }
    for (const id of bombIds) protectedIds.add(id);
  }

  for (const card of cards) {
    if (protectedIds.has(card.id)) protectedCardsUsed += 1;
  }

  return { bombsBroken, protectedCardsUsed, preservedBombStrength, preservedBombs };
}

function isLessDamaging(candidate, original) {
  if (candidate.bombsBroken !== original.bombsBroken) {
    return candidate.bombsBroken < original.bombsBroken;
  }
  if (candidate.preservedBombStrength !== original.preservedBombStrength) {
    return candidate.preservedBombStrength > original.preservedBombStrength;
  }
  if (candidate.preservedBombs !== original.preservedBombs) {
    return candidate.preservedBombs > original.preservedBombs;
  }
  return candidate.protectedCardsUsed < original.protectedCardsUsed;
}

function sortByDamage(a, b) {
  return a.damage.bombsBroken - b.damage.bombsBroken
    || rankStrength(a.pattern.rank) - rankStrength(b.pattern.rank)
    || b.damage.preservedBombStrength - a.damage.preservedBombStrength
    || b.damage.preservedBombs - a.damage.preservedBombs
    || a.damage.protectedCardsUsed - b.damage.protectedCardsUsed
    || suitPreservationCost(a.cards) - suitPreservationCost(b.cards)
    || a.cards.map(card => card.id).sort().join('|').localeCompare(b.cards.map(card => card.id).sort().join('|'));
}

function getComparableAlternatives(hand, chosenPattern, cardCount, lastPlay, bombs) {
  const alternatives = [];
  for (const group of groupByRank(hand).values()) {
    if (group.length < cardCount) continue;
    for (const cards of getCombinations(group, cardCount)) {
      const pattern = detectPattern(cards);
      if (!pattern || pattern.type !== chosenPattern.type) continue;
      if (!comparePatterns(pattern, lastPlay)) continue;
      alternatives.push({ cards, pattern, damage: damageProfile(cards, bombs) });
    }
  }
  return alternatives;
}

function getLegalNormalAlternatives(hand, lastPlay, bombs = findBombs(hand)) {
  if (!lastPlay || lastPlay.type === 'bomb') return [];
  const cardCount = NORMAL_PATTERN_LENGTH[lastPlay.type];
  if (!cardCount) return [];

  const alternatives = [];
  for (const group of groupByRank(hand).values()) {
    if (group.length < cardCount) continue;
    for (const cards of getCombinations(group, cardCount)) {
      const pattern = detectPattern(cards);
      if (!pattern || pattern.type !== lastPlay.type) continue;
      if (!comparePatterns(pattern, lastPlay)) continue;
      alternatives.push({ cards, pattern, damage: damageProfile(cards, bombs) });
    }
  }
  return alternatives;
}

function getLegalBombAlternatives(hand, lastPlay, bombs = findBombs(hand)) {
  return bombs
    .map(cards => ({ cards, pattern: detectPattern(cards) }))
    .filter(candidate => candidate.pattern?.type === 'bomb')
    .filter(candidate => comparePatterns(candidate.pattern, lastPlay))
    .map(candidate => ({ ...candidate, damage: damageProfile(candidate.cards, bombs) }));
}

function sortBombsByMinimumStrength(a, b) {
  return bombStrength(a.cards) - bombStrength(b.cards)
    || sortByDamage(a, b);
}

function chooseRequiredFollowMove(hand, lastPlay, chosenCards) {
  if (!lastPlay || !Array.isArray(chosenCards) || chosenCards.length === hand.length) {
    return chosenCards;
  }

  const bombs = findBombs(hand);
  if (lastPlay.type !== 'bomb') {
    const normalAlternatives = getLegalNormalAlternatives(hand, lastPlay, bombs);
    if (normalAlternatives.length) {
      normalAlternatives.sort(sortByDamage);
      return normalAlternatives[0].cards;
    }
  }

  const bombAlternatives = getLegalBombAlternatives(hand, lastPlay, bombs);
  if (!bombAlternatives.length) return chosenCards;
  bombAlternatives.sort(sortBombsByMinimumStrength);
  return bombAlternatives[0].cards;
}

function optimizeAcrossChosenPattern(hand, lastPlay, chosenCards) {
  if (!Array.isArray(chosenCards) || chosenCards.length === 0) return chosenCards;

  const chosenPattern = detectPattern(chosenCards);
  if (!chosenPattern || chosenPattern.type === 'bomb') return chosenCards;
  if (!chosenCards.every(card => card.rank === chosenCards[0].rank)) return chosenCards;

  const bombs = findBombs(hand);
  if (!bombs.length) return chosenCards;

  const alternatives = getComparableAlternatives(
    hand,
    chosenPattern,
    chosenCards.length,
    lastPlay,
    bombs,
  );
  if (!alternatives.length) return chosenCards;

  alternatives.sort(sortByDamage);
  const best = alternatives[0];
  const originalDamage = damageProfile(chosenCards, bombs);
  return isLessDamaging(best.damage, originalDamage) ? best.cards : chosenCards;
}

function optimizeWithinChosenGroup(hand, lastPlay, chosenCards) {
  if (!Array.isArray(chosenCards) || chosenCards.length === 0) return chosenCards;

  const chosenPattern = detectPattern(chosenCards);
  if (!chosenPattern || chosenPattern.type === 'bomb') return chosenCards;
  if (!chosenCards.every(card => card.rank === chosenCards[0].rank)) return chosenCards;

  const sameRankCards = hand.filter(card => card.rank === chosenCards[0].rank);
  if (sameRankCards.length <= chosenCards.length) return chosenCards;

  const bombs = findBombs(hand);
  if (!bombs.length) return chosenCards;

  const alternatives = getCombinations(sameRankCards, chosenCards.length)
    .map(cards => ({ cards, pattern: detectPattern(cards) }))
    .filter(candidate => candidate.pattern && candidate.pattern.type === chosenPattern.type)
    .filter(candidate => comparePatterns(candidate.pattern, lastPlay))
    .map(candidate => ({ ...candidate, damage: damageProfile(candidate.cards, bombs) }));

  if (!alternatives.length) return chosenCards;

  alternatives.sort(sortByDamage);

  const best = alternatives[0];
  const originalDamage = damageProfile(chosenCards, bombs);
  return isLessDamaging(best.damage, originalDamage) ? best.cards : chosenCards;
}

function chooseWithBase(baseChoose, hand, lastPlay, context) {
  const chosenCards = baseChoose(hand, lastPlay, context);
  const requiredFollowMove = chooseRequiredFollowMove(hand, lastPlay, chosenCards);
  const sameRankOptimized = optimizeWithinChosenGroup(hand, lastPlay, requiredFollowMove);
  return optimizeAcrossChosenPattern(hand, lastPlay, sameRankOptimized);
}

function chooseBotMove(hand, lastPlay, context) {
  return chooseWithBase(baseBotAi.chooseBotMove, hand, lastPlay, context);
}

module.exports = {
  chooseBotMove,
  chooseWithBase,
  chooseRequiredFollowMove,
  optimizeWithinChosenGroup,
  optimizeAcrossChosenPattern,
  getComparableAlternatives,
  getLegalNormalAlternatives,
  getLegalBombAlternatives,
  findBombs,
  bombStrength,
  damageProfile,
  isLessDamaging,
};
