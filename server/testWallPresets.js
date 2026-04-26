/**
 * Deterministic walls for manual / automated claim testing.
 * Toggle via constants.js TEST_WALL_MODE (never use in production).
 */

/**
 * Count occurrences per tile id.
 * @param {string[]} ids
 * @returns {Map<string, number>}
 */
function tally(ids) {
  const m = new Map();
  for (const id of ids) {
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}

/**
 * Remove one copy of id from tally; throws if missing.
 * @param {Map<string, number>} counts
 * @param {string} id
 */
function takeOne(counts, id) {
  const n = counts.get(id) ?? 0;
  if (n < 1) throw new Error(`test wall: tile ${id} over-allocated`);
  if (n === 1) counts.delete(id);
  else counts.set(id, n - 1);
}

/**
 * Remaining tiles as a stable sorted list (deterministic fill order).
 * @param {Map<string, number>} counts
 * @returns {string[]}
 */
function multisetToSortedList(counts) {
  const out = [];
  const keys = [...counts.keys()].sort();
  for (const k of keys) {
    let n = counts.get(k) ?? 0;
    while (n-- > 0) out.push(k);
  }
  return out;
}

/**
 * Build a full wall: fixed index assignments + fill gaps from remaining multiset.
 * @param {string[]} fullSet - must be length 144 (e.g. TILES)
 * @param {Record<number, string>} fixed - wall index -> tile id
 * @returns {string[]}
 */
function buildWallFromFixed(fullSet, fixed) {
  const counts = tally(fullSet);
  for (const idx of Object.keys(fixed)) {
    const i = Number(idx);
    if (!Number.isInteger(i) || i < 0 || i > 143) {
      throw new Error(`test wall: bad index ${idx}`);
    }
    takeOne(counts, fixed[i]);
  }
  const pool = multisetToSortedList(counts);
  const wall = new Array(144);
  for (const [idxStr, tileId] of Object.entries(fixed)) {
    wall[Number(idxStr)] = tileId;
  }
  let pi = 0;
  for (let i = 0; i < 144; i += 1) {
    if (wall[i] !== undefined) continue;
    if (pi >= pool.length) throw new Error('test wall: pool exhausted');
    wall[i] = pool[pi];
    pi += 1;
  }
  if (pi !== pool.length) throw new Error('test wall: pool leftover');
  return wall;
}

/**
 * Presets tuned for deal() in tiles.js (seat 0 dealer 14 tiles).
 * After deal, wallIndex is 53; remaining wall[53..143] is stock.
 *
 * claim_tripps — Seat 1 can tripps if seat 0 discards bamboo_5 (two copies at wall slots dealt to seat 1 in round 0).
 * claim_straight — Seat 1 can straight on bamboo_5 (bamboo_4 + bamboo_6 in first four dealt to seat 1).
 * claim_quads — Seat 1 can quads (three bamboo_5 in first four to seat 1; fourth is dealer discard).
 *
 * @param {string[]} fullSet
 * @param {'claim_tripps' | 'claim_straight' | 'claim_quads'} preset
 * @returns {string[]}
 */
function buildTestWall(fullSet, preset) {
  if (fullSet.length !== 144) throw new Error('test wall: expected 144 tile multiset');

  /** @type {Record<number, string>} */
  let fixed;

  switch (preset) {
    case 'claim_tripps':
      fixed = {
        4: 'bamboo_5',
        5: 'bamboo_5',
        52: 'bamboo_5',
        100: 'bamboo_5',
      };
      break;
    case 'claim_straight':
      // bamboo_4 + bamboo_6 go to seat 1 (wall slots 4–5); dealer’s 14th tile is 52 (bamboo_5 to discard).
      // Other bamboo_5 copies sit in stock only (indices ≥ 53) so no extra 5s in dealt hands.
      fixed = {
        4: 'bamboo_4',
        5: 'bamboo_6',
        52: 'bamboo_5',
        53: 'bamboo_5',
        54: 'bamboo_5',
        55: 'bamboo_5',
      };
      break;
    case 'claim_quads':
      fixed = {
        4: 'bamboo_5',
        5: 'bamboo_5',
        6: 'bamboo_5',
        52: 'bamboo_5',
      };
      break;
    default:
      throw new Error(`test wall: unknown preset ${preset}`);
  }

  return buildWallFromFixed(fullSet, fixed);
}

module.exports = {
  buildTestWall,
  buildWallFromFixed,
};
