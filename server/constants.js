const ROOM_STATES = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  ROUND_OVER: 'round_over',
  GAME_OVER: 'game_over',
};

/** Turn / round flow inside an active mahjong hand */
const GAME_PHASES = {
  DRAW: 'draw',
  DISCARD: 'discard',
  CLAIM: 'claim',
};

/** Status of the in-room game session (stored on room.game) */
const GAME_SESSION_STATES = {
  PLAYING: 'playing',
  ROUND_OVER: 'round_over',
};

/** How long to keep a player in the room after their socket drops (refresh / flaky network) before treating them as gone */
const DISCONNECT_GRACE_MS = 10_000;

/** After a discard, time window for claims before turn passes to next draw */
const CLAIM_TIMEOUT_MS = 8000;

/** Meld kinds from discard (project terms; wire + state use these strings) */
const MELD_TYPES = {
  TRIPPS: 'tripps',
  QUADS: 'quads',
  STRAIGHT: 'straight',
};

/** Socket / UI presence for a seat (roster row still in match) */
const PLAYER_PRESENCE = {
  ACTIVE: 'active',
  AWAY: 'away',
};

/**
 * When true, `buildWall()` uses a deterministic preset from `testWallPresets.js` instead of shuffling.
 * Flip to `true` only for local claim testing; keep `false` for real play.
 */
const TEST_WALL_MODE = true;

/** Which fixed wall to use when TEST_WALL_MODE is true (see server/testWallPresets.js). */
const TEST_WALL_PRESET = /** @type {'claim_tripps' | 'claim_straight' | 'claim_quads'} */ ('claim_tripps');

module.exports = {
  ROOM_STATES,
  GAME_PHASES,
  GAME_SESSION_STATES,
  DISCONNECT_GRACE_MS,
  CLAIM_TIMEOUT_MS,
  MELD_TYPES,
  PLAYER_PRESENCE,
  TEST_WALL_MODE,
  TEST_WALL_PRESET,
};
