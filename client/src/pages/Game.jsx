import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import GameTable from '../components/GameTable';
import { useSocket } from '../hooks/useSocket';
import { resolveRoomIdentity } from '../utils/roomIdentity';

export default function Game() {
  const { roomId: roomIdParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const identity = useMemo(
    () => resolveRoomIdentity(roomIdParam, location.state),
    [roomIdParam, location.state]
  );
  const { roomId, playerId } = identity;

  const { lobbyState, gameSnapshot, connected, error: socketError, socket } =
    useSocket(roomId || null, playerId || null);

  useEffect(() => {
    if (!roomIdParam || !playerId) {
      navigate('/', { replace: true });
    }
  }, [roomIdParam, playerId, navigate]);

  useEffect(() => {
    if (lobbyState?.state === 'waiting') {
      navigate(`/lobby/${roomId}`, {
        replace: true,
        state: { playerId },
      });
    }
  }, [lobbyState?.state, roomId, playerId, navigate]);

  const handleLeave = () => {
    if (!socket?.connected) {
      navigate('/', { replace: true });
      return;
    }
    socket.emit('leave_game', {}, () => {
      navigate('/', { replace: true });
    });
  };

  if (!roomId || !playerId) {
    return null;
  }

  return (
    <div className="game-page">
      <h1>Game</h1>
      <p>
        Status: {connected ? 'Connected' : 'Connecting…'}
        {socketError && <span style={{ color: 'red' }}> ({socketError})</span>}
      </p>
      {lobbyState?.state === 'playing' && (
        <>
          {gameSnapshot ? (
            <GameTable gameSnapshot={gameSnapshot} myPlayerId={playerId} socket={socket} />
          ) : (
            <>
              <p>
                <strong>Game in progress</strong> — waiting for server…
              </p>
              {lobbyState?.players?.length > 0 && (
                <ul className="players-roster">
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
                      {p.playerId === playerId ? ' (You)' : ''}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
      <button type="button" onClick={handleLeave}>
        Leave
      </button>
    </div>
  );
}
