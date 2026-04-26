/**
 * API route handlers. Response shapes are defined in definitions.js
 * and built via apiResponses.js factories or returned from rooms.js.
 */
const express = require('express');
const cors = require('cors');
const { createRoom, joinRoom, getRoom } = require('./rooms');
const { errorResponse } = require('./apiResponses');

function createApiApp() {
  const app = express();

  app.use(cors({ origin: 'http://localhost:5173' }));
  app.use(express.json());

  app.get('/', (req, res) => {
    res.send('Mahjong server running');
  });

  app.post('/rooms', (req, res) => {
    const playerName = req.body?.playerName ?? 'Player';
    const payload = createRoom(playerName);
    res.json(payload);
  });

  app.post('/rooms/join', (req, res) => {
    const { joinCode, playerName } = req.body ?? {};
    if (!joinCode || typeof joinCode !== 'string') {
      return res.status(400).json(errorResponse('joinCode is required'));
    }
    const result = joinRoom(joinCode.trim().toUpperCase(), playerName ?? 'Player');
    if (result.error) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  app.get('/rooms/:roomId', (req, res) => {
    const payload = getRoom(req.params.roomId);
    if (!payload) {
      return res.status(404).json(errorResponse('Room not found'));
    }
    res.json(payload);
  });

  return app;
}

module.exports = { createApiApp };
