const http = require('http');
const { Server } = require('socket.io');
const { createApiApp } = require('./api');
const { attachSocketHandlers } = require('./socket');

const PORT = process.env.PORT || 3001;

// REST API Handling
const app = createApiApp();
const httpServer = http.createServer(app);

// Websocket Handling
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5173' },
});
attachSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
