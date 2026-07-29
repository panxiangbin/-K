'use strict';

function isJokerCard(card) {
  return card?.suit === 'joker' || card?.rank === '小王' || card?.rank === '大王';
}

function isForbiddenJokerPair(cards) {
  return Array.isArray(cards) && cards.length === 2 && cards.some(isJokerCard);
}

function installJokerPairRule(gameLogic) {
  if (!gameLogic || typeof gameLogic.detectPattern !== 'function') {
    throw new TypeError('gameLogic.detectPattern is required');
  }
  if (gameLogic.detectPattern.__forbidsJokerPairs === true) return gameLogic.detectPattern;

  const originalDetectPattern = gameLogic.detectPattern;
  function detectPatternWithoutJokerPairs(cards) {
    if (isForbiddenJokerPair(cards)) return null;
    return originalDetectPattern(cards);
  }
  Object.defineProperty(detectPatternWithoutJokerPairs, '__forbidsJokerPairs', { value: true });
  gameLogic.detectPattern = detectPatternWithoutJokerPairs;
  return detectPatternWithoutJokerPairs;
}

module.exports = { installJokerPairRule, isForbiddenJokerPair, isJokerCard };
