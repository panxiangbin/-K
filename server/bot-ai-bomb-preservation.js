const { detectPattern, comparePatterns } = require('./game-logic');
const baseBotAi = require('./bot-ai');

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

function damageProfile(cards, bombs) {
  const playedIds = new Set(cards.map(card => card.id));
  let bombsBroken = 0;
  let protectedCardsUsed = 0;
  const protectedIds = new Set();

  for (const bomb of bombs) {
    const bombIds = bomb.map(card => card.id);
    const hitCount = bombIds.filter(id => playedIds.has(id)).length;
    if (hitCount > 0 && hitCount < bombIds.length) bombsBroken += 1;
    for (const id of bombIds) protectedIds.add(id);
  }

  for (const card of cards) {
    if (protectedIds.has(card.id)) protectedCardsUsed += 1;
  }

  return { bombsBroken, protectedCardsUsed };
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

  alternatives.sort((a, b) => {
    return a.damage.bombsBroken - b.damage.bombsBroken
      || a.damage.protectedCardsUsed - b.damage.protectedCardsUsed
      || a.cards.map(card => card.id).sort().join('|').localeCompare(b.cards.map(card => card.id).sort().join('|'));
  });

  const best = alternatives[0];
  const originalDamage = damageProfile(chosenCards, bombs);
  if (best.damage.bombsBroken < originalDamage.bombsBroken) return best.cards;
  if (best.damage.bombsBroken === originalDamage.bombsBroken
      && best.damage.protectedCardsUsed < originalDamage.protectedCardsUsed) return best.cards;
  return chosenCards;
}

function chooseWithBase(baseChoose, hand, lastPlay, context) {
  const chosenCards = baseChoose(hand, lastPlay, context);
  return optimizeWithinChosenGroup(hand, lastPlay, chosenCards);
}

function chooseBotMove(hand, lastPlay, context) {
  return chooseWithBase(baseBotAi.chooseBotMove, hand, lastPlay, context);
}

module.exports = {
  chooseBotMove,
  chooseWithBase,
  optimizeWithinChosenGroup,
  findBombs,
  damageProfile,
};
