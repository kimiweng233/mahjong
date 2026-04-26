const { GAME_PHASES, CLAIM_TIMEOUT_MS, MELD_TYPES } = require('./constants');
const {
  computeClaimOptionsBySeat,
  parseSuitRank,
  listStraightHandTilePairsForDiscard,
} = require('./claimEligibility');
const { isValidTileId } = require('./tiles');
const { getClaimPriorityBlockReason } = require('./claimPriority');

/**
 * @param {import('./definitions').Room} room
 * @param {string} playerId
 * @returns {number}
 */
function seatForPlayer(room, playerId) {
  return room.players.findIndex((p) => p.playerId === playerId);
}

/**
 * Clear claim-window fields (after a claim resolves or window ends).
 * @param {import('./definitions').RoundState} round
 */
function endClaimWindowState(round) {
  round.lastDiscard = null;
  round.nextPlayerAfterClaim = null;
  round.claimDeadlineAt = null;
  round.claimOptionsBySeat = null;
}

/**
 * @param {string[]} hand
 * @param {string} tileId
 * @param {number} n
 * @returns {boolean}
 */
function removeNTilesFromHand(hand, tileId, n) {
  let removed = 0;
  while (removed < n) {
    const i = hand.indexOf(tileId);
    if (i === -1) return false;
    hand.splice(i, 1);
    removed += 1;
  }
  return true;
}

/**
 * @param {import('./definitions').RoundState} round
 * @returns {{ ok: true } | { error: string }}
 */
function assertLastDiscardOnTable(round) {
  const ld = round.lastDiscard;
  if (!ld) return { error: 'No last discard' };
  const pile = round.discards[ld.fromSeat];
  if (!pile?.length || pile[pile.length - 1] !== ld.tileId) {
    return { error: 'Discard pile inconsistent' };
  }
  return { ok: true };
}

/**
 * @param {import('./definitions').RoundState} round
 */
function popLastDiscardTile(round) {
  const { fromSeat } = round.lastDiscard;
  round.discards[fromSeat].pop();
}

/**
 * @param {string} discardTileId
 * @param {string} a
 * @param {string} b
 * @returns {string[]}
 */
function orderedStraightTiles(discardTileId, a, b) {
  const tiles = [discardTileId, a, b];
  tiles.sort((x, y) => {
    const px = parseSuitRank(x);
    const py = parseSuitRank(y);
    if (!px || !py) return 0;
    return px.rank - py.rank;
  });
  return tiles;
}

/**
 * @param {string[]} hand
 * @param {string} discardTileId
 * @param {unknown} handTileIds
 * @returns {[string, string] | null}
 */
function normalizeStraightHandPair(hand, discardTileId, handTileIds) {
  if (!Array.isArray(handTileIds) || handTileIds.length !== 2) return null;
  const [x, y] = handTileIds;
  if (typeof x !== 'string' || typeof y !== 'string') return null;
  if (!isValidTileId(x) || !isValidTileId(y)) return null;
  const allowed = listStraightHandTilePairsForDiscard(hand, discardTileId);
  const sx = x <= y ? [x, y] : [y, x];
  for (const p of allowed) {
    const sp = p[0] <= p[1] ? [p[0], p[1]] : [p[1], p[0]];
    if (sp[0] === sx[0] && sp[1] === sx[1]) return [p[0], p[1]];
  }
  return null;
}

/**
 * @param {import('./definitions').Room} room
 * @param {string} playerId
 * @returns {{ ok: true } | { error: string }}
 */
function tryDraw(room, playerId) {
  const game = room.game;
  if (!game?.round) return { error: 'No active round' };
  const round = game.round;
  if (round.phase !== GAME_PHASES.DRAW) return { error: 'Cannot draw now' };
  if (round.currentTurn === null || round.currentTurn === undefined) {
    return { error: 'No active turn' };
  }
  const seat = seatForPlayer(room, playerId);
  if (seat === -1) return { error: 'Not in room' };
  if (seat !== round.currentTurn) return { error: 'Not your turn' };
  if (round.wallIndex >= round.wall.length) return { error: 'Wall is empty' };

  const tile = round.wall[round.wallIndex];
  round.wallIndex += 1;
  round.hands[seat].push(tile);
  round.phase = GAME_PHASES.DISCARD;
  return { ok: true };
}

/**
 * @param {import('./definitions').Room} room
 * @param {string} playerId
 * @param {string} tileId
 * @returns {{ ok: true } | { error: string }}
 */
function tryDiscard(room, playerId, tileId) {
  const game = room.game;
  if (!game?.round) return { error: 'No active round' };
  const round = game.round;
  if (round.phase !== GAME_PHASES.DISCARD) return { error: 'Cannot discard now' };
  if (round.currentTurn === null || round.currentTurn === undefined) {
    return { error: 'No active turn' };
  }
  const seat = seatForPlayer(room, playerId);
  if (seat === -1) return { error: 'Not in room' };
  if (seat !== round.currentTurn) return { error: 'Not your turn' };

  const hand = round.hands[seat];
  const idx = hand.indexOf(tileId);
  if (idx === -1) return { error: 'Tile not in hand' };

  hand.splice(idx, 1);
  round.discards[seat].push(tileId);
  round.lastDiscard = { tileId, fromSeat: seat };
  round.nextPlayerAfterClaim = (seat + 1) % 4;
  round.phase = GAME_PHASES.CLAIM;
  round.currentTurn = null;
  round.claimDeadlineAt = Date.now() + CLAIM_TIMEOUT_MS;
  round.claimOptionsBySeat = computeClaimOptionsBySeat(round);

  return { ok: true };
}

/**
 * No claim before timeout — advance to next player's draw (Phase 5).
 * @param {import('./definitions').Room} room
 */
function applyNoClaim(room) {
  const round = room.game.round;
  if (!round || round.phase !== GAME_PHASES.CLAIM) return;
  const nextSeat = round.nextPlayerAfterClaim;
  if (nextSeat === null || nextSeat === undefined) return;

  round.currentTurn = nextSeat;
  round.phase = GAME_PHASES.DRAW;
  endClaimWindowState(round);
}

/**
 * @param {import('./definitions').Room} room
 * @param {string} playerId
 * @returns {{ ok: true } | { error: string }}
 */
function tryClaimTripps(room, playerId) {
  const game = room.game;
  if (!game?.round) return { error: 'No active round' };
  const round = game.round;
  if (round.phase !== GAME_PHASES.CLAIM) return { error: 'Not in claim window' };
  const seat = seatForPlayer(room, playerId);
  if (seat === -1) return { error: 'Not in room' };
  const opts = round.claimOptionsBySeat?.[seat] ?? round.claimOptionsBySeat?.[String(seat)];
  if (!Array.isArray(opts) || !opts.includes(MELD_TYPES.TRIPPS)) {
    return { error: 'Cannot declare tripps' };
  }
  const trippsBlock = getClaimPriorityBlockReason(round, seat, MELD_TYPES.TRIPPS);
  if (trippsBlock) return { error: trippsBlock };

  const top = assertLastDiscardOnTable(round);
  if (top.error) return { error: top.error };

  const tileId = round.lastDiscard.tileId;
  const hand = round.hands[seat];
  if (!removeNTilesFromHand(hand, tileId, 2)) return { error: 'Hand missing tiles for tripps' };
  popLastDiscardTile(round);

  if (!round.openMelds) round.openMelds = [];
  round.openMelds.push({ type: MELD_TYPES.TRIPPS, seat, tiles: [tileId, tileId, tileId] });
  endClaimWindowState(round);
  round.currentTurn = seat;
  round.phase = GAME_PHASES.DISCARD;
  return { ok: true };
}

/**
 * @param {import('./definitions').Room} room
 * @param {string} playerId
 * @returns {{ ok: true } | { error: string }}
 */
function tryClaimQuads(room, playerId) {
  const game = room.game;
  if (!game?.round) return { error: 'No active round' };
  const round = game.round;
  if (round.phase !== GAME_PHASES.CLAIM) return { error: 'Not in claim window' };
  const seat = seatForPlayer(room, playerId);
  if (seat === -1) return { error: 'Not in room' };
  const opts = round.claimOptionsBySeat?.[seat] ?? round.claimOptionsBySeat?.[String(seat)];
  if (!Array.isArray(opts) || !opts.includes(MELD_TYPES.QUADS)) {
    return { error: 'Cannot declare quads' };
  }
  const quadsBlock = getClaimPriorityBlockReason(round, seat, MELD_TYPES.QUADS);
  if (quadsBlock) return { error: quadsBlock };

  if (round.wallIndex >= round.wall.length) return { error: 'Wall is empty (no replacement tile)' };

  const top = assertLastDiscardOnTable(round);
  if (top.error) return { error: top.error };

  const tileId = round.lastDiscard.tileId;
  const hand = round.hands[seat];
  if (!removeNTilesFromHand(hand, tileId, 3)) return { error: 'Hand missing tiles for quads' };
  popLastDiscardTile(round);

  if (!round.openMelds) round.openMelds = [];
  round.openMelds.push({
    type: MELD_TYPES.QUADS,
    seat,
    tiles: [tileId, tileId, tileId, tileId],
  });

  const bonus = round.wall[round.wallIndex];
  round.wallIndex += 1;
  hand.push(bonus);

  endClaimWindowState(round);
  round.currentTurn = seat;
  round.phase = GAME_PHASES.DISCARD;
  return { ok: true };
}

/**
 * @param {import('./definitions').Room} room
 * @param {string} playerId
 * @param {unknown} handTileIds
 * @returns {{ ok: true } | { error: string }}
 */
function tryClaimStraight(room, playerId, handTileIds) {
  const game = room.game;
  if (!game?.round) return { error: 'No active round' };
  const round = game.round;
  if (round.phase !== GAME_PHASES.CLAIM) return { error: 'Not in claim window' };
  const seat = seatForPlayer(room, playerId);
  if (seat === -1) return { error: 'Not in room' };
  const opts = round.claimOptionsBySeat?.[seat] ?? round.claimOptionsBySeat?.[String(seat)];
  if (!Array.isArray(opts) || !opts.includes(MELD_TYPES.STRAIGHT)) {
    return { error: 'Cannot declare straight' };
  }
  const ld = round.lastDiscard;
  const straightSeat = (ld.fromSeat + 1) % 4;
  if (seat !== straightSeat) return { error: 'Only the next seat may declare straight' };

  const straightBlock = getClaimPriorityBlockReason(round, seat, MELD_TYPES.STRAIGHT);
  if (straightBlock) return { error: straightBlock };

  const top = assertLastDiscardOnTable(round);
  if (top.error) return { error: top.error };

  const discardId = ld.tileId;
  const hand = round.hands[seat];
  const pair = normalizeStraightHandPair(hand, discardId, handTileIds);
  if (!pair) return { error: 'Invalid straight tiles' };

  const [t1, t2] = pair;
  const i1 = hand.indexOf(t1);
  if (i1 === -1) return { error: 'Hand missing straight tile' };
  hand.splice(i1, 1);
  const i2 = hand.indexOf(t2);
  if (i2 === -1) return { error: 'Hand missing straight tile' };
  hand.splice(i2, 1);

  popLastDiscardTile(round);

  if (!round.openMelds) round.openMelds = [];
  round.openMelds.push({
    type: MELD_TYPES.STRAIGHT,
    seat,
    tiles: orderedStraightTiles(discardId, t1, t2),
  });

  endClaimWindowState(round);
  round.currentTurn = seat;
  round.phase = GAME_PHASES.DISCARD;
  return { ok: true };
}

module.exports = {
  tryDraw,
  tryDiscard,
  applyNoClaim,
  tryClaimTripps,
  tryClaimQuads,
  tryClaimStraight,
  seatForPlayer,
};
