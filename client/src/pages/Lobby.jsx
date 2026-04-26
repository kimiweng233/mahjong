import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { clearMahjongSession, saveMahjongSession } from '../utils/mahjongSession';
import { resolveRoomIdentity } from '../utils/roomIdentity';

export default function Lobby() {
  const { roomId: roomIdParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const identity = useMemo(
    () => resolveRoomIdentity(roomIdParam, location.state),
    [roomIdParam, location.state]
  );
  const { roomId, playerId, joinCode: joinCodeFromIdentity } = identity;

  const { lobbyState, connected, error: socketError, socket } = useSocket(
    roomId || null,
    playerId || null
  );
  const [startGameError, setStartGameError] = useState(null);

  const displayJoinCode = lobbyState?.joinCode ?? joinCodeFromIdentity ?? '';

  useEffect(() => {
    if (!roomIdParam || !playerId) {
      navigate('/', { replace: true });
      return;
    }
    saveMahjongSession({ roomId: roomIdParam, playerId, joinCode: displayJoinCode });
  }, [roomIdParam, playerId, displayJoinCode, navigate]);

  useEffect(() => {
    if (!socket) return;
    const onKicked = () => {
      clearMahjongSession();
      navigate('/', { replace: true });
    };
    socket.on('kicked', onKicked);
    return () => socket.off('kicked', onKicked);
  }, [socket, navigate]);

  useEffect(() => {
    if (lobbyState?.state === 'playing' && roomId && playerId) {
      navigate(`/game/${roomId}`, {
        replace: true,
        state: { playerId, joinCode: displayJoinCode },
      });
    }
  }, [lobbyState?.state, roomId, playerId, displayJoinCode, navigate]);

  const handleLeave = () => {
    if (!socket?.connected) {
      clearMahjongSession();
      navigate('/', { replace: true });
      return;
    }
    socket.emit('leave_room', {}, (ack) => {
      if (ack?.error) {
        console.error(ack.error);
        return;
      }
      clearMahjongSession();
      navigate('/', { replace: true });
    });
  };

  const isOwner = lobbyState?.ownerPlayerId === playerId;
  const canStartGame =
    isOwner &&
    lobbyState?.players.length === 4 &&
    lobbyState?.state === 'waiting';

  const handleKick = (targetPlayerId) => {
    socket?.emit('kick_player', { targetPlayerId }, (ack) => {
      if (ack?.error) console.error(ack.error);
    });
  };

  const handleStartGame = () => {
    setStartGameError(null);
    socket?.emit('start_game', {}, (ack) => {
      if (ack?.error) setStartGameError(ack.error);
    });
  };

  if (!roomId || !playerId) {
    return null;
  }

  return (
    <div className="lobby">
      <h1>Lobby</h1>
      <p>
        <strong>Join code:</strong> {displayJoinCode || '…'}
        {displayJoinCode && (
          <button
            type="button"
            className="copy-btn"
            onClick={() => navigator.clipboard.writeText(displayJoinCode)}
          >
            Copy
          </button>
        )}
      </p>
      <p>
        Status: {connected ? 'Connected' : 'Connecting…'}
        {socketError && <span style={{ color: 'red' }}> ({socketError})</span>}
      </p>
      {lobbyState?.ownerPlayerId && (
        <p>
          <strong>Room owner:</strong>{' '}
          {lobbyState.players.find((p) => p.playerId === lobbyState.ownerPlayerId)?.name ?? '—'}
        </p>
      )}
      {canStartGame && (
        <p>
          <button type="button" onClick={handleStartGame}>
            Start game
          </button>
        </p>
      )}
      {startGameError && <p style={{ color: 'red' }}>{startGameError}</p>}
      {lobbyState && (
        <div className="players">
          <h2>Players ({lobbyState.players.length}/4)</h2>
          <ul>
            {lobbyState.players.map((p) => (
              <li key={p.playerId}>
                Seat {p.seatIndex + 1}: {p.name}
                {p.presence === 'away' && (
                  <span
                    className="player-presence-away"
                    title="Disconnected — may rejoin"
                    aria-label="Disconnected"
                  />
                )}
                {p.playerId === lobbyState.ownerPlayerId && ' (Owner)'}
                {p.playerId === playerId && ' (You)'}
                {isOwner &&
                  p.playerId !== playerId &&
                  lobbyState?.state === 'waiting' && (
                  <button
                    type="button"
                    className="kick-btn"
                    onClick={() => handleKick(p.playerId)}
                  >
                    Kick
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" onClick={handleLeave}>
        Leave
      </button>
    </div>
  );
}
