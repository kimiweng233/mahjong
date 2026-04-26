const crypto = require('crypto');
const { ROOM_STATES, GAME_PHASES } = require('./constants');
const {
  createRoomResponse,
  joinRoomResponse,
  roomResponse,
  errorResponse,
} = require('./apiResponses');
const { createPlayer, buildRoom } = require('./definitions');
const { buildWall, deal } = require('./tiles');
const { createRoundState, createGameState } = require('./gameState');

// Exclude ambiguous: 0/O, 1/I/L. Uppercase alphanumeric only.
const JOIN_CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const JOIN_CODE_LENGTH = 6;

const rooms = new Map();
const joinCodeToRoom = new Map();

function generateJoinCode() {
  let code;
  let attempts = 0;
  const maxAttempts = 100;
  do {
    code = '';
    for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
      code += JOIN_CODE_CHARS[crypto.randomInt(0, JOIN_CODE_CHARS.length)];
    }
    attempts++;
    if (attempts >= maxAttempts) throw new Error('Could not generate unique join code');
  } while (joinCodeToRoom.has(code));
  return code;
}

/**
 * @param {string} [playerName]
 * @returns {import('./definitions').CreateRoomResponse}
 */
function createRoom(playerName = 'Player') {
  const roomId = crypto.randomUUID();
  const joinCode = generateJoinCode();
  const playerId = crypto.randomUUID();
  const room = buildRoom(
    roomId,
    joinCode,
    [createPlayer(playerId, playerName, 0)],
    ROOM_STATES.WAITING,
    new Date().toISOString(),
    playerId
  );
  rooms.set(roomId, room);
  joinCodeToRoom.set(joinCode, roomId);
  return createRoomResponse(roomId, joinCode, playerId);
}

/**
 * @param {string} joinCode
 * @param {string} [playerName]
 * @returns {import('./definitions').JoinRoomResponse | import('./definitions').ErrorResponse}
 */
function joinRoom(joinCode, playerName = 'Player') {
  const roomId = joinCodeToRoom.get(joinCode);
  if (!roomId) return errorResponse('Room not found');
  const room = rooms.get(roomId);
  if (!room) return errorResponse('Room not found');
  if (room.players.length >= 4) return errorResponse('Room is full');
  if (room.state !== ROOM_STATES.WAITING) return errorResponse('Game already started');
  const playerId = crypto.randomUUID();
  const seatIndex = room.players.length;
  room.players.push(createPlayer(playerId, playerName, seatIndex));
  return joinRoomResponse(roomId, playerId, seatIndex);
}

/**
 * @param {string} roomId
 * @returns {import('./definitions').RoomResponse | null}
 */
function getRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  return roomResponse(room.roomId, room.joinCode, room.players, room.state, room.ownerPlayerId);
}

/**
 * Remove a player from a room. Reassigns seat indices. If room becomes empty, deletes the room.
 * @param {string} roomId
 * @param {string} playerId
 * @returns {boolean} true if player was removed, false if room or player not found
 */
function removePlayerFromRoom(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return false;
  const index = room.players.findIndex((p) => p.playerId === playerId);
  if (index === -1) return false;
  const wasOwner = room.ownerPlayerId === playerId;
  room.players.splice(index, 1);
  room.players.forEach((p, i) => {
    p.seatIndex = i;
  });
  if (room.players.length > 0 && wasOwner) {
    const newOwnerIndex = crypto.randomInt(0, room.players.length);
    room.ownerPlayerId = room.players[newOwnerIndex].playerId;
  }
  if (room.players.length === 0) {
    joinCodeToRoom.delete(room.joinCode);
    rooms.delete(roomId);
  }
  return true;
}

/**
 * Build wall, deal, and attach game state. Sets room.state to PLAYING.
 * Only the room owner may start; requires exactly 4 players and WAITING lobby.
 * @param {string} roomId
 * @param {string} requesterPlayerId - must be ownerPlayerId
 * @returns {{ ok: true } | { error: string }}
 */
function startGame(roomId, requesterPlayerId) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Room not found' };
  if (room.players.length !== 4) return { error: 'Need 4 players to start' };
  if (room.state !== ROOM_STATES.WAITING) return { error: 'Game already started' };
  if (room.game != null) return { error: 'Game already in progress' };
  if (room.ownerPlayerId !== requesterPlayerId) {
    return { error: 'Only the room owner can start the game' };
  }

  const wall = buildWall();
  const dealt = deal(wall);
  const roundState = createRoundState({
    hands: dealt.hands,
    wall: dealt.wall,
    wallIndex: dealt.wallIndex,
  });
  room.game = createGameState(roundState);
  // Dealer (East, seat 0) has 14 tiles — opens by discarding (no draw first).
  room.game.round.phase = GAME_PHASES.DISCARD;
  room.game.round.currentTurn = 0;
  room.state = ROOM_STATES.PLAYING;
  return { ok: true };
}

module.exports = {
  rooms,
  joinCodeToRoom,
  createRoom,
  joinRoom,
  getRoom,
  removePlayerFromRoom,
  startGame,
};
