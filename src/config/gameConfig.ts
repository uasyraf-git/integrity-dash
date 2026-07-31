import { ObstacleBehavior, ObstacleTypeId } from '../obstacles/ObstacleType';

/**
 * Central gameplay tuning values.
 *
 * Sourced from the Integrity Dash Master Design Document (Gameplay Blueprint v1.0), except
 * where the Sprint 1 acceptance criteria mandate a specific placeholder value (lane positions,
 * jump duration, slide duration, Integrity Meter starting value). Those mandated values are
 * called out inline below and may be revisited once Sprint 2 gameplay tuning begins.
 */

/** X position of each lane, left to right. Sprint 1 mandated value (not the MDD's ±2.4). */
export const LANE_POSITIONS = [-3, 0, 3] as const;
export const LANE_WIDTH = 3;
export const TRACK_WIDTH = 8.0;
export const CENTER_LANE_INDEX = 1;

/** Lane changes ease over this duration and accept a new input once this far through. */
export const LANE_TRANSITION_DURATION = 0.18;
export const LANE_INPUT_ACCEPT_PROGRESS = 0.7;

/** Sprint 1 mandated value (locked, do not change without explicit instruction). */
export const INITIAL_SPEED = 10;
/** Sprint 2A hard cap - speed must not exceed this value this sprint. */
export const MAX_SPEED = 13;

export interface DifficultyStage {
  /** Elapsed active-gameplay-time (seconds) at which this stage begins. */
  timeThreshold: number;
  speed: number;
  spawnInterval: number;
  twoLanePatternsAllowed: boolean;
}

/**
 * Four Sprint 2A difficulty stages. Elapsed time only counts while PLAYING (paused and
 * Game Over time are excluded), so speed/spawn cadence step up discretely rather than
 * on a continuous curve. Restarting always re-enters Stage 1.
 */
export const DIFFICULTY_STAGES: ReadonlyArray<DifficultyStage> = [
  { timeThreshold: 0, speed: 10, spawnInterval: 2.0, twoLanePatternsAllowed: false },
  { timeThreshold: 30, speed: 11, spawnInterval: 1.8, twoLanePatternsAllowed: true },
  { timeThreshold: 60, speed: 12, spawnInterval: 1.6, twoLanePatternsAllowed: true },
  { timeThreshold: 90, speed: 13, spawnInterval: 1.4, twoLanePatternsAllowed: true },
];

export function getDifficultyStage(elapsedActiveTime: number): DifficultyStage {
  let stage = DIFFICULTY_STAGES[0];
  for (const candidate of DIFFICULTY_STAGES) {
    if (elapsedActiveTime >= candidate.timeThreshold) stage = candidate;
  }
  return stage;
}

export const JUMP_HEIGHT = 2.2;
/** Sprint 1 mandated value (not the MDD's 0.85s). Peak lands at half the duration. */
export const JUMP_DURATION = 0.75;
export const JUMP_TIME_TO_PEAK = 0.375;
export const JUMP_INPUT_BUFFER = 0.12;

/** Sprint 1 mandated value (not the MDD's 0.75s). */
export const SLIDE_DURATION = 0.65;
export const STANDING_HEIGHT = 1.8;
export const SLIDING_HEIGHT = 0.8;

/** Sprint 1 mandated value (not the MDD's 75%). */
export const INTEGRITY_METER_START = 100;
export const INTEGRITY_METER_MAX = 100;
export const INTEGRITY_METER_MIN = 0;
/** At or below this percentage the meter shows its critical (most urgent) presentation. */
export const INTEGRITY_METER_CRITICAL_THRESHOLD = 20;
/** At or below this percentage (and above the critical threshold) the meter shows a warning. */
export const INTEGRITY_METER_WARNING_THRESHOLD = 50;

/** Integrity lost per valid obstacle collision. */
export const OBSTACLE_DAMAGE = 10;
/** Invincibility window granted after a hit, during which further damage is ignored. */
export const INVINCIBILITY_DURATION = 1.0;

/** Score points awarded per second of forward travel. */
export const SCORE_PER_SECOND = 10;

export const CAMERA_DISTANCE = 6.5;
export const CAMERA_HEIGHT = 3.4;
export const CAMERA_TILT_DEGREES = 10;
/** Exponential-smoothing time constant for camera follow, in seconds. */
export const CAMERA_FOLLOW_DAMPING = 0.15;
export const CAMERA_FOV_BASE = 60;
export const CAMERA_FOV_MAX_BOOST = 4;

export const SEGMENT_LENGTH = 24;
export const SEGMENT_COUNT = 6;
export const PILLAR_INTERVAL = 8;

/** Delta-time values larger than this (seconds) are clamped to avoid simulation spikes. */
export const MAX_DELTA_TIME = 1 / 20;

/** Run animation tuning for the procedural player rig. */
export const RUN_CYCLE_SPEED = 9;
export const RUN_LIMB_SWING_AMPLITUDE = 0.65;
export const RUN_BODY_BOB_AMPLITUDE = 0.06;

/**
 * Temporary developer test shortcut: press G, while PLAYING, to instantly deplete Integrity.
 * This routes through the same IntegritySystem.damage() path as a real collision, so it
 * exercises the real Game Over flow rather than bypassing it. Documented as a dev-only shortcut.
 */
export const DEBUG_GAME_OVER_KEY = 'g';

/* ---------------------------------------------------------------------------------------- */
/* Sprint 2A - Obstacles, spawning, collision and feedback effects                           */
/* ---------------------------------------------------------------------------------------- */

/** World Z the player is fixed near; obstacles spawn far ahead and travel toward this. */
export const OBSTACLE_SPAWN_Z = -65;
/** Once an active obstacle's Z passes this point (behind the player), it recycles. */
export const OBSTACLE_DESPAWN_Z = 4;

/** How many pooled instances exist per obstacle type. Pool size is fixed - see ObstaclePool. */
export const OBSTACLE_POOL_SIZE_PER_TYPE = 4;

/** Player collision box half-extents, independent of the visual rig's exact mesh size. */
export const PLAYER_COLLISION_HALF_WIDTH = 0.4;
export const PLAYER_COLLISION_HALF_DEPTH = 0.3;

export interface ObstacleConfig {
  id: ObstacleTypeId;
  behavior: ObstacleBehavior;
  /** Relative weight used by the spawner's weighted random selection. */
  spawnWeight: number;
  /** Collision box half-extents and vertical range, in local obstacle space (floor = y 0). */
  collisionHalfWidth: number;
  collisionHalfDepth: number;
  collisionMinY: number;
  collisionMaxY: number;
}

/**
 * One config entry per obstacle type. Visual geometry (ObstacleFactory) is built directly from
 * these dimensions so the rendered silhouette and the collision box never drift apart.
 */
export const OBSTACLE_CONFIGS: Record<ObstacleTypeId, ObstacleConfig> = {
  [ObstacleTypeId.FILING_CABINET]: {
    id: ObstacleTypeId.FILING_CABINET,
    behavior: ObstacleBehavior.JUMP,
    spawnWeight: 25,
    collisionHalfWidth: 0.5,
    collisionHalfDepth: 0.32,
    collisionMinY: 0,
    collisionMaxY: 1.6,
  },
  [ObstacleTypeId.ARCHIVE_BOXES]: {
    id: ObstacleTypeId.ARCHIVE_BOXES,
    behavior: ObstacleBehavior.JUMP,
    spawnWeight: 25,
    collisionHalfWidth: 0.45,
    collisionHalfDepth: 0.45,
    collisionMinY: 0,
    collisionMaxY: 1.15,
  },
  [ObstacleTypeId.WET_FLOOR_CONE]: {
    id: ObstacleTypeId.WET_FLOOR_CONE,
    behavior: ObstacleBehavior.JUMP,
    spawnWeight: 20,
    collisionHalfWidth: 0.28,
    collisionHalfDepth: 0.28,
    collisionMinY: 0,
    collisionMaxY: 0.55,
  },
  [ObstacleTypeId.BROKEN_PRINTER]: {
    id: ObstacleTypeId.BROKEN_PRINTER,
    behavior: ObstacleBehavior.JUMP,
    spawnWeight: 20,
    collisionHalfWidth: 0.48,
    collisionHalfDepth: 0.38,
    collisionMinY: 0,
    collisionMaxY: 1.35,
  },
  [ObstacleTypeId.SECURITY_BARRIER]: {
    id: ObstacleTypeId.SECURITY_BARRIER,
    behavior: ObstacleBehavior.SLIDE,
    spawnWeight: 10,
    collisionHalfWidth: 1.3,
    collisionHalfDepth: 0.22,
    // Leaves a clear gap from the floor up to collisionMinY for a successful slide;
    // SLIDING_HEIGHT (0.8) clears it, STANDING_HEIGHT (1.8) does not.
    collisionMinY: 0.9,
    collisionMaxY: 3.0,
  },
};

/** Grace period, in seconds of active play time, before the first obstacle can spawn. */
export const OBSTACLE_GRACE_PERIOD = 2.5;
/** Minimum reaction time (seconds) a safe spawn interval must respect at the current speed. */
export const MINIMUM_REACTION_TIME = 0.9;
/** Chance a spawn event uses a two-lane pattern, on stages where that pattern is allowed. */
export const TWO_LANE_PATTERN_CHANCE = 0.25;
/**
 * Extra world-unit spacing required, on top of the normal minimum safe spacing, before a lane
 * used by the most recent two-lane pattern is considered safe to spawn into again.
 */
export const TWO_LANE_SPACING_BUFFER = 5;

export const CAMERA_SHAKE_DURATION = 0.2;
export const CAMERA_SHAKE_AMPLITUDE = 0.07;

export const SCREEN_FLASH_DURATION = 0.2;

export const HIT_FEEDBACK_DURATION = 0.2;
/** Angular speed of the subtle invincibility shimmer, in radians/second. */
export const INVINCIBILITY_SHIMMER_SPEED = 18;

/* ---------------------------------------------------------------------------------------- */
/* Sprint 2B - Collectibles and reward loop                                                  */
/* ---------------------------------------------------------------------------------------- */

/** How many pooled Integrity Token instances exist. Fixed pool - see CollectiblePool. */
export const TOKEN_POOL_SIZE = 18;

/** World Z tokens spawn at, and the point past which an active token recycles. */
export const COLLECTIBLE_SPAWN_Z = -65;
export const COLLECTIBLE_DESPAWN_Z = 4;

/** Longitudinal distance between consecutive tokens within one pattern. */
export const TOKEN_SPACING = 2.5;

/** Token collision half-extent (cube approximation) before the pickup padding is added. */
export const TOKEN_COLLISION_HALF_EXTENT = 0.32;
/** Extra forgiveness added on top of the token's own bounds when checking pickup overlap. */
export const TOKEN_PICKUP_PADDING = 0.25;

/** Idle animation tuning for an active, uncollected token. */
export const TOKEN_IDLE_ROTATION_SPEED = 1.4; // radians/second
export const TOKEN_BOB_AMPLITUDE = 0.09;
export const TOKEN_BOB_FREQUENCY = 2.2;

/** Total duration of the scale/rise/fade pickup animation before the token deactivates. */
export const TOKEN_PICKUP_ANIMATION_DURATION = 0.28;

export const FLOATING_REWARD_DURATION = 0.7;
/** Small pool of reusable DOM elements for floating "+25" style reward text. */
export const FLOATING_REWARD_POOL_SIZE = 6;

/** Grace period, in seconds of active play time, before the first collectible pattern spawns. */
export const COLLECTIBLE_GRACE_PERIOD = 1.0;
export const COLLECTIBLE_SPAWN_INTERVAL_MIN = 2.2;
export const COLLECTIBLE_SPAWN_INTERVAL_MAX = 3.8;
/**
 * Per difficulty stage index (0-3), shaves a little off the maximum interval so later stages
 * see collectible patterns slightly more often, without the max ever dropping below the min.
 */
export const COLLECTIBLE_MAX_INTERVAL_REDUCTION_PER_STAGE = 0.35;

export const COLLECTIBLE_PATTERN_LENGTH_MIN = 3;
export const COLLECTIBLE_PATTERN_LENGTH_MAX = 5;
export const SLIDE_TRAIL_PATTERN_LENGTH_MIN = 3;
export const SLIDE_TRAIL_PATTERN_LENGTH_MAX = 4;

/** Height bands (world units above the floor) used when placing token patterns. */
export const TOKEN_HEIGHT_STANDING = 1.0;
export const TOKEN_HEIGHT_JUMP_PEAK = 1.9;
export const TOKEN_HEIGHT_SLIDE = 0.35;

/** Extra Z-margin kept clear around an obstacle when checking lane safety for a token pattern. */
export const COLLECTIBLE_OBSTACLE_CLEARANCE = 3;

/** Chance a spawn attempt uses the Safe-Lane Reward pattern when one is currently possible. */
export const SAFE_LANE_REWARD_CHANCE = 0.6;
/**
 * Two obstacles are treated as one two-lane pattern when their Z values differ by less than
 * this - they were spawned together and always move at identical speed afterward, so their Z
 * values never drift apart.
 */
export const TWO_LANE_PATTERN_Z_MATCH_EPSILON = 0.01;

/** Reward and streak tuning. */
export const TOKEN_BASE_SCORE = 25;
export const MAX_MULTIPLIER = 4;
/** A qualifying streak lost to a collision must reach at least this length to show feedback. */
export const STREAK_LOST_DISPLAY_THRESHOLD = 5;

export interface MultiplierTier {
  streakThreshold: number;
  multiplier: number;
}

/** Multiplier progression: x1 at streak 0, x2 at 5, x3 at 10, x4 at 20 (the maximum). */
export const MULTIPLIER_TIERS: ReadonlyArray<MultiplierTier> = [
  { streakThreshold: 0, multiplier: 1 },
  { streakThreshold: 5, multiplier: 2 },
  { streakThreshold: 10, multiplier: 3 },
  { streakThreshold: 20, multiplier: 4 },
];

export function getMultiplierForStreak(streak: number): number {
  let multiplier = MULTIPLIER_TIERS[0].multiplier;
  for (const tier of MULTIPLIER_TIERS) {
    if (streak >= tier.streakThreshold) multiplier = tier.multiplier;
  }
  return Math.min(multiplier, MAX_MULTIPLIER);
}

/* ---------------------------------------------------------------------------------------- */
/* Sprint 3A - Game feel and polish                                                          */
/* ---------------------------------------------------------------------------------------- */

/**
 * Player rig polish: lane lean, jump/landing squash-stretch, slide anticipation. All of these
 * are purely visual (rotation/scale only) - none of them touch currentX, jumpArc, JUMP_HEIGHT,
 * JUMP_DURATION, SLIDE_DURATION, or currentHeightScale (the field CollisionSystem actually
 * reads), so collision timing and gameplay balance are unchanged.
 */
export const LANE_LEAN_MAX_DEGREES = 10;

export const JUMP_ANTICIPATION_DURATION = 0.08;
export const JUMP_HANG_STRETCH = 1.05;
export const JUMP_ANTICIPATION_SQUASH = 0.88;
export const JUMP_LANDING_SQUASH_DURATION = 0.16;
export const JUMP_LANDING_SQUASH_AMOUNT = 0.82;
export const SLIDE_ANTICIPATION_DURATION = 0.06;
export const SLIDE_ANTICIPATION_SQUASH = 0.92;
export const SQUASH_STRETCH_SMOOTH_TIME = 0.07;

/**
 * Camera polish: a light secondary smoothing pass layered on top of the existing follow
 * damping (CAMERA_FOLLOW_DAMPING, unchanged) for a subtle trailing feel, a matching blend for
 * the shake offset, and a small distinct impulse reserved for landings (separate from the
 * larger collision shake amplitude/duration).
 */
export const CAMERA_FOLLOW_LAG = 0.065;
export const CAMERA_SHAKE_BLEND_TIME = 0.04;
export const LANDING_IMPULSE_AMPLITUDE = 0.035;
export const LANDING_IMPULSE_DURATION = 0.12;

/** Landing dust ring and token-pickup ring pulse (both drawn by the shared PulseRingEffect). */
export const LANDING_RING_START_SCALE = 0.2;
export const LANDING_RING_END_SCALE = 1.6;
export const LANDING_RING_DURATION = 0.35;
export const LANDING_RING_OPACITY = 0.35;

export const COLLECT_RING_START_SCALE = 0.15;
export const COLLECT_RING_END_SCALE = 1.1;
export const COLLECT_RING_DURATION = 0.3;
export const COLLECT_RING_OPACITY = 0.55;

/** Token pickup animation polish: a glow pulse (rise-then-fall, not a monotonic decay) and a
 *  brief spin acceleration layered on top of the idle rotation speed during pickup. */
export const TOKEN_PICKUP_GLOW_INTENSITY = 0.9;
export const TOKEN_PICKUP_SPIN_ACCEL = 4;

/**
 * Near Miss: rewards a successful jump-over or slide-under (same lane as an obstacle that
 * reaches the player without ever colliding) with a small score bonus. Deliberately never
 * touches Integrity or the reward streak/multiplier - it is purely an additional score source,
 * layered on top of the unchanged collision/damage/streak systems.
 */
export const NEAR_MISS_SCORE = 50;

/** HUD score count-up smoothing time constant. Purely a display effect - the stored/submitted
 *  score (ScoreSystem.getScore()) this animates toward is never affected. */
export const SCORE_COUNT_SMOOTH_TIME = 0.18;

/* ---------------------------------------------------------------------------------------- */
/* Sprint 3B - World and visual polish                                                       */
/* ---------------------------------------------------------------------------------------- */

/** How many seconds of active play time a single environment theme "zone" lasts before the
 *  next segment to recycle picks up a new theme. Segments already placed keep their theme -
 *  this only affects newly-recycled segments, which is what creates multi-segment zones. */
export const THEME_DURATION = 16;

/** X distance beyond the track's glass-panel wall line (TRACK_WIDTH / 2 + wall offset) at
 *  which theme vignette props are placed - well clear of the lanes and collision. */
export const THEME_PROP_WALL_OFFSET = 1.6;

/** Ambient animation tuning (monitor flicker, server rack blink, signboard pulse, etc.). */
export const AMBIENT_MONITOR_FLICKER_SPEED = 3.2;
export const AMBIENT_SERVER_BLINK_SPEED = 2.4;
export const AMBIENT_SIGNBOARD_PULSE_SPEED = 1.1;
export const AMBIENT_PLANT_SWAY_SPEED = 0.8;
export const AMBIENT_PLANT_SWAY_AMPLITUDE = 0.04;

/** Demo Camera (F9): a slow cinematic orbit around the player, for screenshots/trailer capture. */
export const DEMO_CAMERA_ORBIT_SPEED = 0.35; // radians/second
export const DEMO_CAMERA_ORBIT_RADIUS = 7.5;
export const DEMO_CAMERA_ORBIT_HEIGHT = 3.2;
export const DEMO_CAMERA_HEIGHT_VARIANCE = 1.1;
export const DEMO_CAMERA_LOOK_HEIGHT = 1.2;

/** Background depth layer (Task 7): large, distant, low-poly silhouettes beyond the walls. */
export const BACKGROUND_SILHOUETTE_X_OFFSET = 9;
export const BACKGROUND_SILHOUETTE_HEIGHT = 10;
export const BACKGROUND_SILHOUETTE_DEPTH = 6;

/** Track/surface polish: floor seam trim spacing and wall panel trim thickness. */
export const FLOOR_SEAM_INTERVAL = 4;
export const WALL_TRIM_THICKNESS = 0.05;
