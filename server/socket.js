const { registerRoomSocketHandlers } = require('./socketRoomHandlers');
const { registerGameSocketHandlers } = require('./socketGameHandlers');

/**
 * Attach Socket.io event handlers for lobby/room and in-game actions.
 * @param {import('socket.io').Server} io
 */
function attachSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    registerRoomSocketHandlers(io, socket);
    registerGameSocketHandlers(io, socket);
  });
}

module.exports = { attachSocketHandlers };
