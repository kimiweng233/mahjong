import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlreadyInSameRoomError, createRoom, joinRoom } from '../api/rooms';
import { saveMahjongSession } from '../utils/mahjongSession';

export default function Home() {
  const navigate = useNavigate();
  const [createJoinError, setCreateJoinError] = useState(null);
  const [playerName, setPlayerName] = useState('Player');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinNameInput, setJoinNameInput] = useState('Player');

  async function handleCreateRoom() {
    setCreateJoinError(null);
    try {
      const data = await createRoom(playerName);
      saveMahjongSession({
        roomId: data.roomId,
        playerId: data.playerId,
        joinCode: data.joinCode,
      });
      navigate(`/lobby/${data.roomId}`, {
        state: { playerId: data.playerId, joinCode: data.joinCode },
        replace: false,
      });
    } catch (err) {
      setCreateJoinError(err.message);
    }
  }

  async function handleJoinRoom(e) {
    e?.preventDefault();
    setCreateJoinError(null);
    if (!joinCodeInput.trim()) {
      setCreateJoinError('Enter a join code');
      return;
    }
    try {
      const normalizedJoinCode = joinCodeInput.trim().toUpperCase();
      const data = await joinRoom(normalizedJoinCode, joinNameInput || 'Player');
      saveMahjongSession({
        roomId: data.roomId,
        playerId: data.playerId,
        joinCode: normalizedJoinCode,
      });
      navigate(`/lobby/${data.roomId}`, {
        state: { playerId: data.playerId, joinCode: normalizedJoinCode },
        replace: false,
      });
    } catch (err) {
      if (err instanceof AlreadyInSameRoomError) {
        const path =
          err.roomState === 'waiting'
            ? `/lobby/${err.roomId}`
            : `/game/${err.roomId}`;
        navigate(path, {
          state: { playerId: err.playerId, joinCode: err.joinCode ?? '' },
        });
        return;
      }
      setCreateJoinError(err.message);
    }
  }

  return (
    <div className="home">
      <h1>Mahjong</h1>
      <div className="card">
        <h2>Join room</h2>
        <form onSubmit={handleJoinRoom}>
          <input
            type="text"
            placeholder="Join code"
            value={joinCodeInput}
            onChange={(e) => setJoinCodeInput(e.target.value)}
          />
          <input
            type="text"
            placeholder="Your name"
            value={joinNameInput}
            onChange={(e) => setJoinNameInput(e.target.value)}
          />
          <button type="submit">Join</button>
        </form>
      </div>
      <div className="card">
        <h2>Create room</h2>
        <input
          type="text"
          placeholder="Your name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
        <button type="button" onClick={handleCreateRoom}>
          Create room
        </button>
      </div>
      {createJoinError && <p style={{ color: 'red' }}>{createJoinError}</p>}
    </div>
  );
}
