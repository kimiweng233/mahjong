import { loadMahjongSession } from './mahjongSession';

/**
 * Resolve room id from the URL and playerId / joinCode from navigation state,
 * with sessionStorage fallback when stored.roomId matches the URL room id.
 *
 * @param {string | undefined} roomIdFromUrl - from useParams().roomId
 * @param {{ playerId?: string, joinCode?: string } | null | undefined} locationState - from useLocation().state
 * @returns {{ roomId: string, playerId: string | null, joinCode: string }}
 */
export function resolveRoomIdentity(roomIdFromUrl, locationState) {
  const fromState = locationState || {};
  const stored = loadMahjongSession();
  const roomId = roomIdFromUrl || '';
  let playerId = fromState.playerId;
  let joinCode = fromState.joinCode ?? '';

  // URL matches saved session: fill missing fields so refresh / reconnect keeps identity.
  if (stored?.roomId === roomId) {
    playerId = playerId || stored.playerId;
    joinCode = joinCode || stored.joinCode || '';
  }

  return { roomId, playerId: playerId || null, joinCode };
}
