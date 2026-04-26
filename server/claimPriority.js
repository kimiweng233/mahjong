/**
 * Phase 6.4: resolve competing claims on the same discard.
 * Order: meld strength (quads > tripps > straight), then counter-clockwise distance
 * from discarder (smaller distance wins ties — next seat first).
 * Win is not modeled here (Phase 7).
 */

const { MELD_TYPES } = require('./constants');

/** Lower number = resolves first (stronger claim). */
const MELD_PRIORITY = {
  [MELD_TYPES.QUADS]: 0,
  [MELD_TYPES.TRIPPS]: 1,
  [MELD_TYPES.STRAIGHT]: 2,
};

/**
 * @param {string} meldType
 * @returns {number}
 */
function meldPriorityRank(meldType) {
  const p = MELD_PRIORITY[meldType];
  return p === undefined ? 99 : p;
}

/**
 * Steps CCW from discarder: 1 = next player, 2, 3 (discarder excluded).
 * @param {number} fromSeat
 * @param {number} seat
 */
function ccwDistanceFromDiscarder(fromSeat, seat) {
  return (seat - fromSeat + 4) % 4;
}

/**
 * True if (seatA, typeA) wins over (seatB, typeB) for resolution order.
 * @param {number} fromSeat
 * @param {number} seatA
 * @param {string} typeA
 * @param {number} seatB
 * @param {string} typeB
 */
function claimPairBeats(fromSeat, seatA, typeA, seatB, typeB) {
  const pa = meldPriorityRank(typeA);
  const pb = meldPriorityRank(typeB);
  if (pa !== pb) return pa < pb;
  const da = ccwDistanceFromDiscarder(fromSeat, seatA);
  const db = ccwDistanceFromDiscarder(fromSeat, seatB);
  return da < db;
}

/**
 * Returns an error message if this claim is superseded by another seat's option
 * (or the same seat's higher meld tier, e.g. quads before tripps).
 * @param {import('./definitions').RoundState} round
 * @param {number} seat
 * @param {string} claimType
 * @returns {string | null}
 */
function getClaimPriorityBlockReason(round, seat, claimType) {
  const ld = round.lastDiscard;
  if (!ld) return null;
  const fromSeat = ld.fromSeat;
  const optsBy = round.claimOptionsBySeat;
  if (!optsBy) return null;

  for (let s = 0; s < 4; s += 1) {
    if (s === fromSeat) continue;
    const list = optsBy[s] ?? optsBy[String(s)] ?? [];
    if (!Array.isArray(list)) continue;
    for (const t of list) {
      if (s === seat && t === claimType) continue;
      if (claimPairBeats(fromSeat, s, t, seat, claimType)) {
        if (s === seat) {
          return 'Declare the higher meld for this discard (quads before tripps).';
        }
        return 'Another seat has a higher-priority claim on this discard; wait for it to resolve or time out.';
      }
    }
  }
  return null;
}

module.exports = {
  MELD_PRIORITY,
  meldPriorityRank,
  ccwDistanceFromDiscarder,
  claimPairBeats,
  getClaimPriorityBlockReason,
};
