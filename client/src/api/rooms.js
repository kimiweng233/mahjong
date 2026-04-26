import { clearMahjongSession, loadMahjongSession } from '../utils/mahjongSession';

const API_URL = import.meta.env.VITE_API_URL;

/** Thrown when session says user is already in the room for this join code; includes ids for client redirect. */
export class AlreadyInSameRoomError extends Error {
  /**
   * @param {string} roomId
   * @param {string} playerId
   * @param {string} joinCode
   * @param {string} roomState Server room `state` (e.g. `waiting` vs `playing`).
   */
  constructor(roomId, playerId, joinCode, roomState) {
    super(
      'You are already in this room. Open your lobby from the URL or session.'
    );
    this.name = 'AlreadyInSameRoomError';
    this.code = 'ALREADY_IN_SAME_ROOM';
    this.roomId = roomId;
    this.playerId = playerId;
    this.joinCode = joinCode;
    this.roomState = roomState;
  }
}

export async function createRoom(playerName = 'Player') {
  const res = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || res.statusText);
  }
  return res.json();
}

export async function joinRoom(joinCode, playerName = 'Player') {
  const normalizedCode = joinCode.trim().toUpperCase();
  const stored = loadMahjongSession();
  if (stored?.roomId && stored?.playerId) {
    const existing = await getRoom(stored.roomId);
    const stillInGame = existing?.players?.some(
      (p) => p.playerId === stored.playerId
    );
    if (!stillInGame) {
      clearMahjongSession();
    } else if (existing.joinCode === normalizedCode) {
      throw new AlreadyInSameRoomError(
        stored.roomId,
        stored.playerId,
        existing.joinCode,
        existing.state ?? 'waiting'
      );
    } else {
      throw new Error(
        'You cannot join a new room while still in a game.'
      );
    }
  }

  const res = await fetch(`${API_URL}/rooms/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joinCode: normalizedCode, playerName }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || res.statusText);
  }
  return res.json();
}

export async function getRoom(roomId) {
  const res = await fetch(`${API_URL}/rooms/${roomId}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(res.statusText);
  }
  return res.json();
}
