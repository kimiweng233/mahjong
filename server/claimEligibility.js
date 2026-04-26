/**
 * Phase 6.2: which claim types each seat may declare on the current discard.
 * Phase 6.4: competing claims are ordered in `claimPriority.js` (quads > tripps > straight,
 * then CCW distance from discarder). Win is deferred (Phase 7); not included here yet.
 *
 * Claim type strings on the wire: quads, tripps, straight (win in Phase 7).
 */

const { GAME_PHASES } = require('./constants');

/** Priority order for listing / future resolution (win first when added). */
const CLAIM_TYPE_ORDER = ['win', 'quads', 'tripps', 'straight'];

/**
 * @param {string} tileId
 * @returns {{ suit: string, rank: number } | null}
 */
function parseSuitRank(tileId) {
  const m = /^(bamboo|dot|character)_([1-9])$/.exec(tileId);
  if (!m) return null;
  return { suit: m[1], rank: Number(m[2]) };
}

/**
 * @param {string[]} hand
 * @param {string} tileId
 * @returns {number}
 */
function countMatchingInHand(hand, tileId) {
  let n = 0;
  for (const t of hand) {
    if (t === tileId) n += 1;
  }
  return n;
}

/**
 * Exposed quads on discard: 3 copies of the same tile already in hand.
 * @param {string[]} hand
 * @param {string} discardedTileId
 */
function canQuadsFromDiscard(hand, discardedTileId) {
  return countMatchingInHand(hand, discardedTileId) >= 3;
}

/**
 * Tripps on discard: 2 copies in hand (quads when 3+).
 * @param {string[]} hand
 * @param {string} discardedTileId
 */
function canTrippsFromDiscard(hand, discardedTileId) {
  const c = countMatchingInHand(hand, discardedTileId);
  return c >= 2 && c < 3;
}

/**
 * Straight only on numbered suits; next seat in turn order from discarder only.
 * @param {string[]} hand
 * @param {string} discardedTileId
 */
function canStraightFromDiscard(hand, discardedTileId) {
  const pr = parseSuitRank(discardedTileId);
  if (!pr) return false;
  const { suit, rank } = pr;
  const has = (r) => r >= 1 && r <= 9 && hand.includes(`${suit}_${r}`);
  const triples = [
    [rank - 2, rank - 1],
    [rank - 1, rank + 1],
    [rank + 1, rank + 2],
  ];
  return triples.some(([a, b]) => has(a) && has(b));
}

/**
 * @param {import('./definitions').RoundState} round
 * @returns {Record<number, string[]> | null}
 */
function computeClaimOptionsBySeat(round) {
  if (round.phase !== GAME_PHASES.CLAIM || !round.lastDiscard) return null;

  const { tileId, fromSeat } = round.lastDiscard;
  const straightSeat = (fromSeat + 1) % 4;

  /** @type {Record<number, string[]>} */
  const raw = {};

  for (let seat = 0; seat < 4; seat += 1) {
    if (seat === fromSeat) continue;

    const hand = round.hands[seat];
    const types = [];

    if (canQuadsFromDiscard(hand, tileId)) types.push('quads');
    else if (canTrippsFromDiscard(hand, tileId)) types.push('tripps');

    if (seat === straightSeat && canStraightFromDiscard(hand, tileId)) {
      types.push('straight');
    }

    if (types.length) {
      raw[seat] = [...types].sort(
        (a, b) => CLAIM_TYPE_ORDER.indexOf(a) - CLAIM_TYPE_ORDER.indexOf(b)
      );
    }
  }

  return Object.keys(raw).length ? raw : {};
}

/**
 * Valid (handTileA, handTileB) pairs that complete a straight with the discarded suit tile.
 * @param {string[]} hand
 * @param {string} discardedTileId
 * @returns {[string, string][]}
 */
function listStraightHandTilePairsForDiscard(hand, discardedTileId) {
  const pr = parseSuitRank(discardedTileId);
  if (!pr) return [];
  const { suit, rank } = pr;
  const id = (r) => `${suit}_${r}`;
  const has = (r) => r >= 1 && r <= 9 && hand.includes(id(r));
  /** @type {[string, string][]} */
  const pairs = [];
  if (has(rank - 2) && has(rank - 1)) pairs.push([id(rank - 2), id(rank - 1)]);
  if (has(rank - 1) && has(rank + 1)) pairs.push([id(rank - 1), id(rank + 1)]);
  if (has(rank + 1) && has(rank + 2)) pairs.push([id(rank + 1), id(rank + 2)]);
  return pairs;
}

module.exports = {
  computeClaimOptionsBySeat,
  parseSuitRank,
  canQuadsFromDiscard,
  canTrippsFromDiscard,
  canStraightFromDiscard,
  listStraightHandTilePairsForDiscard,
  CLAIM_TYPE_ORDER,
};
