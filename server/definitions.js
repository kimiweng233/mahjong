/**
 * Central definitions for domain objects and API interfaces.
 * Add new interfaces here whenever we introduce a new shape; use the
 * factory functions below (or in apiResponses.js) to build instances.
 */

/**
 * A player in a room (domain and API shape).
 * @typedef {Object} Player
 * @property {string} playerId
 * @property {string} name
 * @property {number} seatIndex
 * @property {'active'|'away'} [presence] - away = soft-left or disconnected mid-game; still in roster
 */

/**
 * Last tile discarded before claim window (if any).
 * @typedef {Object} LastDiscard
 * @property {string} tileId - canonical id from server/tiles (e.g. bamboo_5, wind_E)
 * @property {number} fromSeat
 */

/**
 * Exposed meld on the table (from a discard claim).
 * @typedef {Object} OpenMeld
 * @property {'tripps'|'quads'|'straight'} type
 * @property {number} seat - meld owner
 * @property {string[]} tiles - tile ids in the meld (includes the claimed discard)
 */

/**
 * One round of play: wall, hands, discards, turn, phase.
 * @typedef {Object} RoundState
 * @property {string[][]} hands - four hands, each an array of tile ids
 * @property {string[][]} discards - four piles of discarded tile ids
 * @property {string[]} wall - remaining wall (same array reference as dealt into)
 * @property {number} wallIndex - index of next draw from wall
 * @property {number} [deadWallStartIndex] - start index of dead wall segment (optional until quads flow)
 * @property {number | null} currentTurn - seat 0..3 for draw/discard; null during claim window
 * @property {string} phase - see GAME_PHASES (e.g. draw, discard, claim)
 * @property {LastDiscard | null} lastDiscard
 * @property {number | null} [nextPlayerAfterClaim] - seat that will draw if no claim (set in claim phase)
 * @property {number | null} [claimDeadlineAt] - epoch ms when claim window ends
 * @property {Record<number, string[]> | null} [claimOptionsBySeat] - during claim phase, **server**: full seat -> allowed claim types (quads, tripps, straight); win in Phase 7. **state_update snapshots**: viewer seat only (see gameSnapshot.js).
 * @property {OpenMeld[]} [openMelds] - exposed melds from claims this round
 */

/**
 * In-memory game attached to a room while playing (room.game).
 * @typedef {Object} GameState
 * @property {string} state - GAME_SESSION_STATES.playing | round_over
 * @property {number} roundIndex
 * @property {[number, number, number, number]} scores
 * @property {RoundState} round
 */

/**
 * Internal room object stored in memory.
 * @typedef {Object} Room
 * @property {string} roomId
 * @property {string} joinCode
 * @property {Player[]} players
 * @property {string} state
 * @property {string} createdAt
 * @property {string} ownerPlayerId
 * @property {GameState | null} [game] - set when a match is in progress
 */

/**
 * API response when creating a room.
 * @typedef {Object} CreateRoomResponse
 * @property {string} roomId
 * @property {string} joinCode
 * @property {string} playerId
 */

/**
 * API response when joining a room.
 * @typedef {Object} JoinRoomResponse
 * @property {string} roomId
 * @property {string} playerId
 * @property {number} seatIndex
 */

/**
 * API response for room details (lobby view).
 * @typedef {Object} RoomResponse
 * @property {string} roomId
 * @property {string} joinCode
 * @property {Player[]} players
 * @property {string} state
 * @property {string} ownerPlayerId
 */

/**
 * API error response.
 * @typedef {Object} ErrorResponse
 * @property {string} error
 */

/**
 * @param {string} playerId
 * @param {string} name
 * @param {number} seatIndex
 * @returns {Player}
 */
function createPlayer(playerId, name, seatIndex) {
  return { playerId, name, seatIndex, presence: 'active' };
}

/**
 * @param {string} roomId
 * @param {string} joinCode
 * @param {Player[]} players
 * @param {string} state
 * @param {string} createdAt
 * @param {string} ownerPlayerId
 * @param {GameState | null} [game]
 * @returns {Room}
 */
function buildRoom(roomId, joinCode, players, state, createdAt, ownerPlayerId, game = null) {
  return { roomId, joinCode, players, state, createdAt, ownerPlayerId, game };
}

module.exports = {
  createPlayer,
  buildRoom,
};
