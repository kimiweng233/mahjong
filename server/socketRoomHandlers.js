const { DISCONNECT_GRACE_MS, ROOM_STATES, PLAYER_PRESENCE } = require('./constants');
const { getRoom, removePlayerFromRoom, rooms } = require('./rooms');
const { buildStateSnapshotForPlayer } = require('./gameSnapshot');

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const pendingDisconnectTimers = new Map();

function disconnectTimerKey(roomId, playerId) {
  return `${roomId}:${playerId}`;
}

/**
 * Cancel a scheduled removal-on-disconnect. Call when the player re-joins or is removed explicitly.
 * @returns {boolean} true if a pending grace timer was cleared (reconnect within grace window)
 */
function clearPendingDisconnect(roomId, playerId) {
  const key = disconnectTimerKey(roomId, playerId);
  const id = pendingDisconnectTimers.get(key);
  if (id != null) {
    clearTimeout(id);
    pendingDisconnectTimers.delete(key);
    return true;
  }
  return false;
}

/**
 * After socket loss, remove the player from the room only after the grace period unless they rejoin.
 * @param {import('socket.io').Server} io
 * @param {string} roomId
 * @param {string} playerId
 */
function scheduleDisconnectRemoval(io, roomId, playerId) {
  const key = disconnectTimerKey(roomId, playerId);
  const existing = pendingDisconnectTimers.get(key);
  if (existing != null) clearTimeout(existing);

  pendingDisconnectTimers.set(
    key,
    setTimeout(() => {
      pendingDisconnectTimers.delete(key);
      removePlayerAndBroadcast(io, roomId, playerId);
    }, DISCONNECT_GRACE_MS)
  );
}

/**
 * Sends the current lobby state (players, joinCode, state, ownerPlayerId) to every client in the room.
 * @param {import('socket.io').Server} io
 * @param {string} roomId
 */
function broadcastLobbyState(io, roomId) {
  const lobbyState = getRoom(roomId);
  if (!lobbyState) return;
  io.to(roomId).emit('lobby_state', {
    players: lobbyState.players,
    joinCode: lobbyState.joinCode,
    state: lobbyState.state,
    ownerPlayerId: lobbyState.ownerPlayerId,
  });
}

/**
 * Send each connected client a personalized state_update (own hand visible, others masked).
 * @param {import('socket.io').Server} io
 * @param {string} roomId
 */
function emitStateUpdatesToRoom(io, roomId) {
  const room = rooms.get(roomId);
  if (!room || !room.game) return;
  const roomSockets = io.sockets.adapter.rooms.get(roomId);
  if (!roomSockets) return;
  for (const socketId of roomSockets) {
    const sock = io.sockets.sockets.get(socketId);
    if (!sock?.playerId) continue;
    const snapshot = buildStateSnapshotForPlayer(room, sock.playerId);
    if (snapshot) sock.emit('state_update', snapshot);
  }
}

/**
 * Removes the player from the room and broadcasts to remaining clients.
 * @param {import('socket.io').Server} io
 * @param {string} roomId
 * @param {string} playerId
 * @returns {boolean}
 */
function removePlayerAndBroadcast(io, roomId, playerId) {
  clearPendingDisconnect(roomId, playerId);
  const success = removePlayerFromRoom(roomId, playerId);
  if (!success) {
    console.error('Failed to remove player from room:', roomId, playerId);
    return false;
  }
  broadcastLobbyState(io, roomId);
  return true;
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {{ roomId?: string, playerId?: string }} payload
 * @param {(arg: { ok?: boolean, error?: string }) => void} [callback]
 */
function handleJoinRoom(io, socket, payload, callback) {
  const { roomId, playerId } = payload || {};
  const ack = typeof callback === 'function' ? callback : () => {};

  if (!roomId || !playerId) {
    ack({ error: 'roomId and playerId are required' });
    return;
  }
  const room = getRoom(roomId);
  if (!room) {
    ack({ error: 'Room not found' });
    return;
  }
  const player = room.players.find((p) => p.playerId === playerId);
  if (!player) {
    ack({ error: 'Player not in this room' });
    return;
  }

  clearPendingDisconnect(roomId, playerId);

  player.presence = PLAYER_PRESENCE.ACTIVE;

  socket.roomId = roomId;
  socket.playerId = playerId;
  socket.join(roomId);
  console.log('join_room:', roomId, playerId);

  broadcastLobbyState(io, roomId);
  const fullRoom = rooms.get(roomId);
  if (fullRoom?.game) {
    emitStateUpdatesToRoom(io, roomId);
  }
  ack({ ok: true });
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @returns {'noop' | 'failed' | 'ok'}
 */
function handleLeaveRoom(io, socket) {
  const roomId = socket.roomId;
  const playerId = socket.playerId;
  if (!roomId || !playerId) return 'noop';

  if (!removePlayerAndBroadcast(io, roomId, playerId)) {
    console.error('Failed to remove player from room:', roomId, playerId);
    return 'failed';
  }

  socket.leave(roomId);
  socket.roomId = null;
  socket.playerId = null;
  return 'ok';
}

/**
 * Leave the socket room without removing the player from the room roster (e.g. left game UI, will rejoin).
 * Clears disconnect grace so a later socket drop does not remove them.
 * While a match is playing, marks presence away and rebroadcasts lobby + game snapshots.
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function handleLeaveGame(io, socket) {
  const roomId = socket.roomId;
  const playerId = socket.playerId;
  if (!roomId || !playerId) return;

  clearPendingDisconnect(roomId, playerId);

  const fullRoom = rooms.get(roomId);
  if (fullRoom?.state === ROOM_STATES.PLAYING) {
    const p = fullRoom.players.find((pl) => pl.playerId === playerId);
    if (p) p.presence = PLAYER_PRESENCE.AWAY;
  }

  socket.leave(roomId);
  socket.roomId = null;
  socket.playerId = null;

  if (fullRoom) {
    broadcastLobbyState(io, roomId);
    if (fullRoom.game && fullRoom.state === ROOM_STATES.PLAYING) {
      emitStateUpdatesToRoom(io, roomId);
    }
  }
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function handleDisconnect(io, socket) {
  console.log('Client disconnected:', socket.id);
  const roomId = socket.roomId;
  const playerId = socket.playerId;
  if (!roomId || !playerId) return;

  const room = rooms.get(roomId);
  if (room?.state === ROOM_STATES.PLAYING) {
    const p = room.players.find((pl) => pl.playerId === playerId);
    if (p) p.presence = PLAYER_PRESENCE.AWAY;
    broadcastLobbyState(io, roomId);
    if (room.game) emitStateUpdatesToRoom(io, roomId);
    return;
  }

  scheduleDisconnectRemoval(io, roomId, playerId);
}

/**
 * @param {import('socket.io').Server} io
 * @param {string} roomId
 * @param {string} targetPlayerId
 * @returns {import('socket.io').Socket | null}
 */
function findSocketByPlayer(io, roomId, targetPlayerId) {
  const room = io.sockets.adapter.rooms.get(roomId);
  if (!room) return null;
  for (const socketId of room) {
    const s = io.sockets.sockets.get(socketId);
    if (s && s.playerId === targetPlayerId) return s;
  }
  return null;
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {{ targetPlayerId?: string }} payload
 * @param {(arg: { ok?: boolean, error?: string }) => void} [callback]
 */
function handleKickPlayer(io, socket, payload, callback) {
  const ack = typeof callback === 'function' ? callback : () => {};
  const roomId = socket.roomId;
  const playerId = socket.playerId;
  const targetPlayerId = payload?.targetPlayerId;

  if (!roomId || !playerId || !targetPlayerId) {
    ack({ error: 'Missing room, player, or target' });
    return;
  }
  if (targetPlayerId === playerId) {
    ack({ error: 'Cannot kick yourself' });
    return;
  }

  const room = getRoom(roomId);
  if (!room) {
    ack({ error: 'Room not found' });
    return;
  }
  if (room.ownerPlayerId !== playerId) {
    ack({ error: 'Only the room owner can kick players' });
    return;
  }
  if (room.state !== ROOM_STATES.WAITING) {
    ack({ error: 'Cannot kick players while a game is in progress' });
    return;
  }
  if (!room.players.some((p) => p.playerId === targetPlayerId)) {
    ack({ error: 'Player not in room' });
    return;
  }

  const kickedSocket = findSocketByPlayer(io, roomId, targetPlayerId);
  if (!removePlayerAndBroadcast(io, roomId, targetPlayerId)) {
    ack({ error: 'Failed to kick player' });
    return;
  }
  if (kickedSocket) {
    kickedSocket.leave(roomId);
    kickedSocket.roomId = null;
    kickedSocket.playerId = null;
    kickedSocket.emit('kicked');
  }
  ack({ ok: true });
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerRoomSocketHandlers(io, socket) {
  socket.on('join_room', (payload, callback) => {
    handleJoinRoom(io, socket, payload, callback);
  });

  socket.on('leave_room', (_payload, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    const result = handleLeaveRoom(io, socket);
    if (result === 'failed') ack({ error: 'Failed to leave room' });
    else ack({ ok: true });
  });

  socket.on('leave_game', (_payload, callback) => {
    handleLeaveGame(io, socket);
    if (typeof callback === 'function') callback({ ok: true });
  });

  socket.on('disconnect', () => {
    handleDisconnect(io, socket);
  });

  socket.on('kick_player', (payload, callback) => {
    handleKickPlayer(io, socket, payload, callback);
  });
}

module.exports = {
  registerRoomSocketHandlers,
  broadcastLobbyState,
  emitStateUpdatesToRoom,
  clearPendingDisconnect,
};
