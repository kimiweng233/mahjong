const { GAME_PHASES, GAME_SESSION_STATES } = require('./constants');

/**
 * Build round state after a deal (or when resuming). Hands and wall come from tiles.deal().
 * @param {Object} params
 * @param {string[][]} params.hands - four hands from deal
 * @param {string[]} params.wall - wall array (same reference as returned from deal)
 * @param {number} params.wallIndex - next draw index
 * @param {number} [params.deadWallStartIndex] - optional; set when dead wall is configured
 * @returns {import('./definitions').RoundState}
 */
function createRoundState({ hands, wall, wallIndex, deadWallStartIndex }) {
  return {
    hands,
    discards: [[], [], [], []],
    wall,
    wallIndex,
    ...(deadWallStartIndex !== undefined ? { deadWallStartIndex } : {}),
    currentTurn: 0,
    phase: GAME_PHASES.DRAW,
    lastDiscard: null,
    nextPlayerAfterClaim: null,
    claimDeadlineAt: null,
    claimOptionsBySeat: null,
    openMelds: [],
  };
}

/**
 * Wrap a round in the top-level game session (scores, round index).
 * @param {import('./definitions').RoundState} roundState
 * @returns {import('./definitions').GameState}
 */
function createGameState(roundState) {
  return {
    state: GAME_SESSION_STATES.PLAYING,
    roundIndex: 0,
    scores: [0, 0, 0, 0],
    round: roundState,
  };
}

module.exports = {
  createRoundState,
  createGameState,
};
