const crypto = require('crypto');
const { TEST_WALL_MODE, TEST_WALL_PRESET } = require('./constants');
const { buildTestWall } = require('./testWallPresets');

const SUITS = ['bamboo', 'dot', 'character'];
const WINDS = ['E', 'S', 'W', 'N'];
const DRAGONS = ['R', 'G', 'B'];
/** Plum, orchid, chrysanthemum, bamboo (one each) */
const FLOWERS = [1, 2, 3, 4];
/** Spring, summer, autumn, winter (one each) */
const SEASONS = [1, 2, 3, 4];

/**
 * Full Hong Kong mahjong set with flowers and seasons: 144 tiles.
 * 3 suits × 9 ranks × 4 + 4 winds × 4 + 3 dragons × 4 (136)
 * + 4 flowers + 4 seasons (8).
 * @type {string[]}
 */
const TILES = (() => {
  const tiles = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let c = 0; c < 4; c++) {
        tiles.push(`${suit}_${rank}`);
      }
    }
  }
  for (const w of WINDS) {
    for (let c = 0; c < 4; c++) {
      tiles.push(`wind_${w}`);
    }
  }
  for (const d of DRAGONS) {
    for (let c = 0; c < 4; c++) {
      tiles.push(`dragon_${d}`);
    }
  }
  for (const n of FLOWERS) {
    tiles.push(`flower_${n}`);
  }
  for (const n of SEASONS) {
    tiles.push(`season_${n}`);
  }
  return tiles;
})();

/** @type {ReadonlySet<string>} */
const VALID_TILE_IDS = new Set(TILES);

/**
 * @param {unknown} id
 * @returns {id is string}
 */
function isValidTileId(id) {
  return typeof id === 'string' && VALID_TILE_IDS.has(id);
}

/**
 * Fisher–Yates shuffle using crypto.randomInt for uniform distribution.
 * @param {string[]} array
 * @returns {string[]} new shuffled array (does not mutate input)
 */
function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a wall from the full tile set (shuffled, or deterministic when TEST_WALL_MODE is on).
 * @returns {string[]} wall of 144 tile ids, wallIndex starts at 0 when dealing
 */
function buildWall() {
  if (TEST_WALL_MODE) {
    return buildTestWall(TILES, TEST_WALL_PRESET);
  }
  return shuffle(TILES);
}

/**
 * Deal hands from the wall. Seat 0 is East (dealer): 14 tiles; others 13 each.
 * Dealing: 3 rounds of 4 tiles per seat (East→South→West→North order),
 * then 1 tile per seat, then East takes 1 more tile (dealer bonus).
 *
 * @param {string[]} wall - shuffled wall (not mutated; a copy is used internally for slicing)
 * @returns {{ hands: string[][], wall: string[], wallIndex: number }}
 */
function deal(wall) {
  const wallCopy = [...wall];
  let wallIndex = 0;
  const hands = [[], [], [], []];

  for (let round = 0; round < 3; round++) {
    for (let seat = 0; seat < 4; seat++) {
      for (let k = 0; k < 4; k++) {
        hands[seat].push(wallCopy[wallIndex++]);
      }
    }
  }

  for (let seat = 0; seat < 4; seat++) {
    hands[seat].push(wallCopy[wallIndex++]);
  }

  hands[0].push(wallCopy[wallIndex++]);

  return {
    hands,
    wall: wallCopy,
    wallIndex,
  };
}

module.exports = {
  TILES,
  VALID_TILE_IDS,
  isValidTileId,
  SUITS,
  WINDS,
  DRAGONS,
  FLOWERS,
  SEASONS,
  buildWall,
  deal,
  shuffle,
};
