const SESSION_KEY = 'mahjong_session';

/**
 * @returns {{ roomId: string, playerId: string, joinCode: string } | null}
 */
export function loadMahjongSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.roomId || !data?.playerId) return null;
    return {
      roomId: data.roomId,
      playerId: data.playerId,
      joinCode: typeof data.joinCode === 'string' ? data.joinCode : '',
    };
  } catch {
    return null;
  }
}

/**
 * @param {{ roomId: string, playerId: string, joinCode?: string }} session
 * If `joinCode` is omitted and `roomId` matches the previous save, the previous join code is kept (e.g. Game only persists room + player).
 */
export function saveMahjongSession(session) {
  try {
    const prev = loadMahjongSession();
    const { roomId, playerId } = session;
    const joinCode =
      session.joinCode !== undefined
        ? session.joinCode
        : prev?.roomId === roomId
          ? prev?.joinCode ?? ''
          : '';
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        roomId,
        playerId,
        joinCode,
      })
    );
  } catch {
    // ignore quota / private mode
  }
}

export function clearMahjongSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
