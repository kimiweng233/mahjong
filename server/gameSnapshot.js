const { GAME_PHASES } = require('./constants');
const { listStraightHandTilePairsForDiscard } = require('./claimEligibility');

/**
 * Build a per-player view of game state (other players' hands hidden).
 * @param {import('./definitions').Room} room - internal room with .game set
 * @param {string} viewerPlayerId
 * @returns {object | null}
 */
function buildStateSnapshotForPlayer(room, viewerPlayerId) {
  const game = room.game;
  if (!game || !game.round) return null;

  const seatIndex = room.players.findIndex((p) => p.playerId === viewerPlayerId);
  if (seatIndex === -1) return null;

  const round = game.round;
  const hands = round.hands.map((hand, seat) =>
    seat === seatIndex ? [...hand] : { count: hand.length }
  );

  const wallTilesRemaining = round.wall.length - round.wallIndex;
  const discardCounts = round.discards.map((pile) => pile.length);

  /** Full seat map on `round`; each client only receives their own entry (privacy). */
  const allClaimOpts = round.claimOptionsBySeat;
  let claimOptionsBySeat = null;
  if (allClaimOpts != null && typeof allClaimOpts === 'object') {
    const mine = allClaimOpts[seatIndex] ?? allClaimOpts[String(seatIndex)];
    const list = Array.isArray(mine) ? [...mine] : [];
    claimOptionsBySeat = { [seatIndex]: list };
  }

  const myClaimList = claimOptionsBySeat?.[seatIndex] ?? claimOptionsBySeat?.[String(seatIndex)] ?? [];
  const claimStraightPairs =
    round.phase === GAME_PHASES.CLAIM &&
    round.lastDiscard &&
    Array.isArray(myClaimList) &&
    myClaimList.includes('straight')
      ? listStraightHandTilePairsForDiscard(round.hands[seatIndex], round.lastDiscard.tileId).map(
          (pair) => ({ handTileIds: [...pair] })
        )
      : null;

  return {
    roomId: room.roomId,
    roundIndex: game.roundIndex,
    scores: [...game.scores],
    gameSessionState: game.state,
    players: room.players.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      seatIndex: p.seatIndex,
      presence: p.presence ?? 'active',
    })),
    round: {
      hands,
      discards: round.discards.map((pile) => [...pile]),
      discardCounts,
      wallTilesRemaining,
      currentTurn: round.currentTurn,
      phase: round.phase,
      lastDiscard: round.lastDiscard ? { ...round.lastDiscard } : null,
      nextPlayerAfterClaim:
        round.nextPlayerAfterClaim !== undefined ? round.nextPlayerAfterClaim : null,
      claimDeadlineAt:
        round.claimDeadlineAt !== undefined ? round.claimDeadlineAt : null,
      claimOptionsBySeat,
      claimStraightPairs,
      openMelds: (round.openMelds ?? []).map((m) => ({
        type: m.type,
        seat: m.seat,
        tiles: [...m.tiles],
      })),
      yourSeatIndex: seatIndex,
    },
  };
}

module.exports = { buildStateSnapshotForPlayer };
