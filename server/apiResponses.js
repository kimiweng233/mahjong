/**
 * API response factory functions.
 * All return types are defined in definitions.js.
 */

/**
 * @param {string} roomId
 * @param {string} joinCode
 * @param {string} playerId
 * @returns {import('./definitions').CreateRoomResponse}
 */
function createRoomResponse(roomId, joinCode, playerId) {
  return { roomId, joinCode, playerId };
}

/**
 * @param {string} roomId
 * @param {string} playerId
 * @param {number} seatIndex
 * @returns {import('./definitions').JoinRoomResponse}
 */
function joinRoomResponse(roomId, playerId, seatIndex) {
  return { roomId, playerId, seatIndex };
}

/**
 * @param {string} roomId
 * @param {string} joinCode
 * @param {import('./definitions').Player[]} players
 * @param {string} state
 * @param {string} [ownerPlayerId]
 * @returns {import('./definitions').RoomResponse}
 */
function roomResponse(roomId, joinCode, players, state, ownerPlayerId) {
  return { roomId, joinCode, players, state, ownerPlayerId: ownerPlayerId ?? '' };
}

/**
 * @param {string} message
 * @returns {import('./definitions').ErrorResponse}
 */
function errorResponse(message) {
  return { error: message };
}

module.exports = {
  createRoomResponse,
  joinRoomResponse,
  roomResponse,
  errorResponse,
};
