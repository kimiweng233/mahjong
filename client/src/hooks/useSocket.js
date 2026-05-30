import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { oneWayMsFromRtt, RTT_PING_INTERVAL_MS, smoothRttMs } from '../utils/socketRtt';

const API_URL = import.meta.env.VITE_API_URL;

/**
 * @param {import('socket.io-client').Socket} socket
 * @param {(sampleMs: number) => void} recordRtt
 */
function pingRtt(socket, recordRtt) {
  if (!socket.connected) return;
  const t0 = performance.now();
  socket.emit('ping_rtt', {}, () => {
    recordRtt(performance.now() - t0);
  });
}

/**
 * Connect to socket and join room when roomId and playerId are set.
 * @param {string | null} roomId
 * @param {string | null} playerId
 */
export function useSocket(roomId, playerId) {
  const [socket, setSocket] = useState(null);
  const [lobbyState, setLobbyState] = useState(null);
  const [gameSnapshot, setGameSnapshot] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  const rttMsRef = useRef(null);
  const socketRef = useRef(null);

  const recordRtt = useCallback((sampleMs) => {
    rttMsRef.current = smoothRttMs(rttMsRef.current, sampleMs);
  }, []);

  const getOneWayMs = useCallback(() => oneWayMsFromRtt(rttMsRef.current), []);

  const emitWithRtt = useCallback((event, payload, callback) => {
    const s = socketRef.current;
    if (!s?.connected) return;
    let data = payload;
    let cb = callback;
    if (typeof payload === 'function') {
      cb = payload;
      data = {};
    }
    const t0 = performance.now();
    s.emit(event, data, (ack) => {
      recordRtt(performance.now() - t0);
      cb?.(ack);
    });
  }, [recordRtt]);

  useEffect(() => {
    if (!roomId || !playerId) {
      setSocket(null);
      setLobbyState(null);
      setGameSnapshot(null);
      setConnected(false);
      setError(null);
      rttMsRef.current = null;
      socketRef.current = null;
      return;
    }

    const s = io(API_URL, { autoConnect: true });
    socketRef.current = s;
    setSocket(s);

    let prevPhase = null;
    let pingIntervalId = null;

    s.on('connect', () => {
      setConnected(true);
      setError(null);
      const joinT0 = performance.now();
      s.emit('join_room', { roomId, playerId }, (ack) => {
        recordRtt(performance.now() - joinT0);
        if (ack && ack.error) {
          setError(ack.error);
        }
      });
      pingRtt(s, recordRtt);
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
      const phase = payload?.round?.phase;
      if (phase === 'claim' && prevPhase !== 'claim') {
        pingRtt(s, recordRtt);
      }
      prevPhase = phase ?? null;
      setGameSnapshot(payload);
    };
    s.on('state_update', onStateUpdate);
    s.on('state_snapshot', onStateUpdate);

    pingIntervalId = setInterval(() => pingRtt(s, recordRtt), RTT_PING_INTERVAL_MS);

    return () => {
      if (pingIntervalId != null) clearInterval(pingIntervalId);
      s.off('connect');
      s.off('disconnect');
      s.off('lobby_state');
      s.off('state_update', onStateUpdate);
      s.off('state_snapshot', onStateUpdate);
      s.disconnect();
      socketRef.current = null;
      rttMsRef.current = null;
      setSocket(null);
      setConnected(false);
      setLobbyState(null);
      setGameSnapshot(null);
      setError(null);
    };
  }, [roomId, playerId, recordRtt]);

  return {
    socket,
    emitWithRtt,
    getOneWayMs,
    lobbyState,
    gameSnapshot,
    connected,
    error,
  };
}
