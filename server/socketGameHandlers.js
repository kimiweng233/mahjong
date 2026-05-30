const { CLAIM_TIMEOUT_MS, GAME_PHASES } = require('./constants');
const { startGame, rooms } = require('./rooms');
const {
  tryDraw,
  tryDiscard,
  applyNoClaim,
  tryClaimTripps,
  tryClaimQuads,
  tryClaimStraight,
} = require('./gameActions');
const { isValidTileId } = require('./tiles');
const { broadcastLobbyState, emitStateUpdatesToRoom } = require('./socketRoomHandlers');

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const claimPhaseTimers = new Map();

function clearClaimPhaseTimer(roomId) {
  const id = claimPhaseTimers.get(roomId);
  if (id != null) {
    clearTimeout(id);
    claimPhaseTimers.delete(roomId);
  }
}

/**
 * After a discard, Phase 5: if no claim within CLAIM_TIMEOUT_MS, pass turn to next player.
 * @param {import('socket.io').Server} io
 * @param {string} roomId
 */
function scheduleClaimPhaseTimeout(io, roomId) {
  clearClaimPhaseTimer(roomId);
  const t = setTimeout(() => {
    claimPhaseTimers.delete(roomId);
    const room = rooms.get(roomId);
    if (!room?.game?.round) return;
    if (room.game.round.phase !== GAME_PHASES.CLAIM) return;
    applyNoClaim(room);
    emitStateUpdatesToRoom(io, roomId);
  }, CLAIM_TIMEOUT_MS);
  claimPhaseTimers.set(roomId, t);
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {(arg: { ok?: boolean, error?: string }) => void} [callback]
 */
function handleStartGame(io, socket, callback) {
  const ack = typeof callback === 'function' ? callback : () => {};
  const roomId = socket.roomId;
  const playerId = socket.playerId;
  if (!roomId || !playerId) {
    ack({ error: 'Not in a room' });
    return;
  }
  const result = startGame(roomId, playerId);
  if (result.error) {
    ack({ error: result.error });
    return;
  }
  io.to(roomId).emit('game_start', { roomId });
  broadcastLobbyState(io, roomId);
  emitStateUpdatesToRoom(io, roomId);
  ack({ ok: true });
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {(arg: { ok?: boolean, error?: string }) => void} [callback]
 */
function handleDraw(io, socket, callback) {
  const ack = typeof callback === 'function' ? callback : () => {};
  const roomId = socket.roomId;
  const playerId = socket.playerId;
  if (!roomId || !playerId) {
    ack({ error: 'Not in a room' });
    return;
  }
  const room = rooms.get(roomId);
  if (!room?.game) {
    ack({ error: 'No game in progress' });
    return;
  }
  const result = tryDraw(room, playerId);
  if (result.error) {
    ack({ error: result.error });
    return;
  }
  emitStateUpdatesToRoom(io, roomId);
  ack({ ok: true });
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {{ tileId?: string }} payload
 * @param {(arg: { ok?: boolean, error?: string }) => void} [callback]
 */
function handleDiscard(io, socket, payload, callback) {
  const ack = typeof callback === 'function' ? callback : () => {};
  const roomId = socket.roomId;
  const playerId = socket.playerId;
  const tileId = payload?.tileId;
  if (!roomId || !playerId) {
    ack({ error: 'Not in a room' });
    return;
  }
  if (!isValidTileId(tileId)) {
    ack({ error: 'tileId is required and must be a valid tile' });
    return;
  }
  const room = rooms.get(roomId);
  if (!room?.game) {
    ack({ error: 'No game in progress' });
    return;
  }
  const result = tryDiscard(room, playerId, tileId);
  if (result.error) {
    ack({ error: result.error });
    return;
  }
  emitStateUpdatesToRoom(io, roomId);
  scheduleClaimPhaseTimeout(io, roomId);
  ack({ ok: true });
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {(arg: { ok?: boolean, error?: string }) => void} [callback]
 */
function handleClaimTripps(io, socket, callback) {
  const ack = typeof callback === 'function' ? callback : () => {};
  const roomId = socket.roomId;
  const playerId = socket.playerId;
  if (!roomId || !playerId) {
    ack({ error: 'Not in a room' });
    return;
  }
  const room = rooms.get(roomId);
  if (!room?.game) {
    ack({ error: 'No game in progress' });
    return;
  }
  const result = tryClaimTripps(room, playerId);
  if (result.error) {
    ack({ error: result.error });
    return;
  }
  clearClaimPhaseTimer(roomId);
  emitStateUpdatesToRoom(io, roomId);
  ack({ ok: true });
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {(arg: { ok?: boolean, error?: string }) => void} [callback]
 */
function handleClaimQuads(io, socket, callback) {
  const ack = typeof callback === 'function' ? callback : () => {};
  const roomId = socket.roomId;
  const playerId = socket.playerId;
  if (!roomId || !playerId) {
    ack({ error: 'Not in a room' });
    return;
  }
  const room = rooms.get(roomId);
  if (!room?.game) {
    ack({ error: 'No game in progress' });
    return;
  }
  const result = tryClaimQuads(room, playerId);
  if (result.error) {
    ack({ error: result.error });
    return;
  }
  clearClaimPhaseTimer(roomId);
  emitStateUpdatesToRoom(io, roomId);
  ack({ ok: true });
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {{ handTileIds?: unknown }} payload
 * @param {(arg: { ok?: boolean, error?: string }) => void} [callback]
 */
function handleClaimStraight(io, socket, payload, callback) {
  const ack = typeof callback === 'function' ? callback : () => {};
  const roomId = socket.roomId;
  const playerId = socket.playerId;
  if (!roomId || !playerId) {
    ack({ error: 'Not in a room' });
    return;
  }
  const room = rooms.get(roomId);
  if (!room?.game) {
    ack({ error: 'No game in progress' });
    return;
  }
  const result = tryClaimStraight(room, playerId, payload?.handTileIds);
  if (result.error) {
    ack({ error: result.error });
    return;
  }
  clearClaimPhaseTimer(roomId);
  emitStateUpdatesToRoom(io, roomId);
  ack({ ok: true });
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerGameSocketHandlers(io, socket) {
  socket.on('ping_rtt', (_payload, callback) => {
    if (typeof callback === 'function') callback({});
  });

  socket.on('start_game', (payload, callback) => {
    handleStartGame(io, socket, callback);
  });

  socket.on('draw', (payload, callback) => {
    handleDraw(io, socket, callback);
  });

  socket.on('discard', (payload, callback) => {
    handleDiscard(io, socket, payload, callback);
  });

  socket.on('claim_tripps', (payload, callback) => {
    handleClaimTripps(io, socket, callback);
  });

  socket.on('claim_quads', (payload, callback) => {
    handleClaimQuads(io, socket, callback);
  });

  socket.on('claim_straight', (payload, callback) => {
    handleClaimStraight(io, socket, payload, callback);
  });
}

module.exports = {
  registerGameSocketHandlers,
  emitStateUpdatesToRoom,
};
