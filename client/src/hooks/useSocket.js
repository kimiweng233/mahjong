import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL;

/**
 * Connect to socket and join room when roomId and playerId are set.
 * @param {string | null} roomId
 * @param {string | null} playerId
 * @returns {{ socket: import('socket.io-client').Socket | null, lobbyState: { players: Array<{ playerId: string, name: string, seatIndex: number }>, joinCode: string, state: string } | null, gameSnapshot: object | null, connected: boolean, error: string | null }}
 */
export function useSocket(roomId, playerId) {
  const [socket, setSocket] = useState(null);
  const [lobbyState, setLobbyState] = useState(null);
  const [gameSnapshot, setGameSnapshot] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!roomId || !playerId) {
      setSocket(null);
      setLobbyState(null);
      setGameSnapshot(null);
      setConnected(false);
      setError(null);
      return;
    }

    const s = io(API_URL, { autoConnect: true });
    setSocket(s);

    s.on('connect', () => {
      setConnected(true);
      setError(null);
      s.emit('join_room', { roomId, playerId }, (ack) => {
        if (ack && ack.error) {
          setError(ack.error);
        }
      });
    });

    s.on('disconnect', () => {
      setConnected(false);
    });

    s.on('lobby_state', (payload) => {
      setLobbyState(payload);
      if (payload?.state === 'waiting') {
        setGameSnapshot(null);
      }
    });

    const onStateUpdate = (payload) => {
      setGameSnapshot(payload);
    };
    s.on('state_update', onStateUpdate);
    s.on('state_snapshot', onStateUpdate);

    return () => {
      s.off('connect');
      s.off('disconnect');
      s.off('lobby_state');
      s.off('state_update', onStateUpdate);
      s.off('state_snapshot', onStateUpdate);
      s.disconnect();
      setSocket(null);
      setConnected(false);
      setLobbyState(null);
      setGameSnapshot(null);
      setError(null);
    };
  }, [roomId, playerId]);

  return {
    socket,
    lobbyState,
    gameSnapshot,
    connected,
    error,
  };
}
