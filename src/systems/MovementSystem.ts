import type { Player } from '../entities/Player';
import {
  HIT_FEEDBACK_DURATION,
  INVINCIBILITY_SHIMMER_SPEED,
  JUMP_ANTICIPATION_DURATION,
  JUMP_ANTICIPATION_SQUASH,
  JUMP_DURATION,
  JUMP_HANG_STRETCH,
  JUMP_HEIGHT,
  JUMP_INPUT_BUFFER,
  JUMP_LANDING_SQUASH_AMOUNT,
  JUMP_LANDING_SQUASH_DURATION,
  LANE_INPUT_ACCEPT_PROGRESS,
  LANE_LEAN_MAX_DEGREES,
  LANE_POSITIONS,
  LANE_TRANSITION_DURATION,
  RUN_BODY_BOB_AMPLITUDE,
  RUN_CYCLE_SPEED,
  RUN_LIMB_SWING_AMPLITUDE,
  SLIDE_ANTICIPATION_DURATION,
  SLIDE_ANTICIPATION_SQUASH,
  SLIDE_DURATION,
  SLIDING_HEIGHT,
  SQUASH_STRETCH_SMOOTH_TIME,
  STANDING_HEIGHT,
} from '../config/gameConfig';
import { clamp, dampFactor, degToRad, easeInOutSine, jumpArc, lerp } from '../utils/math';

const SLIDE_HEIGHT_SCALE = SLIDING_HEIGHT / STANDING_HEIGHT;
const HEIGHT_SMOOTH_TIME = 0.08;

/**
 * Requests a lane change, honoring the mid-transition input-acceptance rule.
 * Returns true only when the request actually starts a new lane transition
 * (i.e. the action should be counted as an accepted player action); returns
 * false when rejected (mid-transition too early, or already at the boundary).
 */
export function requestLaneChange(player: Player, direction: -1 | 1): boolean {
  const transitionProgress = player.laneTransition.active
    ? player.laneTransition.elapsed / LANE_TRANSITION_DURATION
    : 1;

  if (player.laneTransition.active && transitionProgress < LANE_INPUT_ACCEPT_PROGRESS) {
    return false;
  }

  const nextLane = clamp(player.laneIndex + direction, 0, LANE_POSITIONS.length - 1);
  if (nextLane === player.laneIndex && !player.laneTransition.active) return false;

  player.laneIndex = nextLane;
  player.laneTransition = {
    active: true,
    fromX: player.currentX,
    toX: LANE_POSITIONS[nextLane],
    elapsed: 0,
  };
  return true;
}

/**
 * Starts a jump, ignoring the request while sliding, per the design blueprint.
 * Returns true only when a new jump actually starts; returns false when
 * rejected (sliding, already mid-jump - including when the request is queued
 * as a buffered landing-jump, since that is not a newly accepted action yet).
 */
export function requestJump(player: Player): boolean {
  if (player.slideState.active) return false;

  if (player.jumpState.active) {
    const remaining = JUMP_DURATION - player.jumpState.elapsed;
    if (remaining <= JUMP_INPUT_BUFFER) {
      player.jumpState.bufferedRequest = true;
    }
    return false;
  }

  player.jumpState = { active: true, elapsed: 0, bufferedRequest: false };
  return true;
}

/**
 * Starts a slide; cannot begin mid-air and does not extend on repeated input.
 * Returns true only when a new slide actually starts; returns false when rejected.
 */
export function requestSlide(player: Player): boolean {
  if (player.jumpState.active || player.slideState.active) return false;
  player.slideState = { active: true, elapsed: 0 };
  return true;
}

export function updatePlayerMovement(player: Player, deltaTime: number): void {
  updateLaneTransition(player, deltaTime);
  updateJump(player, deltaTime);
  updateSlide(player, deltaTime);
  updateHeightScale(player, deltaTime);
  updateSquashStretch(player, deltaTime);
  updateLaneLean(player, deltaTime);
  updateRunAnimation(player, deltaTime);
  updateHitAndInvincibilityVisual(player, deltaTime);

  player.group.position.x = player.currentX;
}

function updateLaneTransition(player: Player, deltaTime: number): void {
  const transition = player.laneTransition;
  if (!transition.active) return;

  transition.elapsed += deltaTime;
  const t = clamp(transition.elapsed / LANE_TRANSITION_DURATION, 0, 1);
  player.currentX = lerp(transition.fromX, transition.toX, easeInOutSine(t));

  if (t >= 1) {
    transition.active = false;
    player.currentX = transition.toX;
  }
}

function updateJump(player: Player, deltaTime: number): void {
  const jump = player.jumpState;
  if (!jump.active) {
    player.group.position.y = 0;
    return;
  }

  jump.elapsed += deltaTime;
  const t = jump.elapsed / JUMP_DURATION;

  if (t >= 1) {
    jump.active = false;
    player.group.position.y = 0;
    player.notifyLanded();
    if (jump.bufferedRequest) {
      player.jumpState = { active: true, elapsed: 0, bufferedRequest: false };
    }
    return;
  }

  player.group.position.y = JUMP_HEIGHT * jumpArc(t);
}

function updateSlide(player: Player, deltaTime: number): void {
  const slide = player.slideState;
  if (!slide.active) return;

  slide.elapsed += deltaTime;
  if (slide.elapsed >= SLIDE_DURATION) {
    slide.active = false;
  }
}

function updateHeightScale(player: Player, deltaTime: number): void {
  const targetScale = player.slideState.active ? SLIDE_HEIGHT_SCALE : 1;
  const factor = dampFactor(HEIGHT_SMOOTH_TIME, deltaTime);
  player.currentHeightScale = lerp(player.currentHeightScale, targetScale, factor);
  player.group.scale.y = player.currentHeightScale;
}

/**
 * Purely cosmetic squash-and-stretch, applied on top of (never instead of) the collision-
 * relevant `currentHeightScale`: a brief compress at jump takeoff, a gentle stretch during
 * hang time, a sharper compress-and-recover on landing, and a small compress at slide start.
 * Writes only to `group.scale` - CollisionSystem reads `player.currentHeightScale` directly,
 * never `group.scale.y`, so none of this affects collision geometry or gameplay balance.
 */
function updateSquashStretch(player: Player, deltaTime: number): void {
  const jump = player.jumpState;
  const slide = player.slideState;
  let target = 1;

  if (jump.active && jump.elapsed < JUMP_ANTICIPATION_DURATION) {
    const t = clamp(jump.elapsed / JUMP_ANTICIPATION_DURATION, 0, 1);
    target = lerp(JUMP_ANTICIPATION_SQUASH, 1, t);
  } else if (jump.active) {
    target = JUMP_HANG_STRETCH;
  } else if (player.landingEffect.active) {
    player.landingEffect.elapsed += deltaTime;
    const t = clamp(player.landingEffect.elapsed / JUMP_LANDING_SQUASH_DURATION, 0, 1);
    if (t >= 1) {
      player.landingEffect.active = false;
      target = 1;
    } else {
      target = lerp(JUMP_LANDING_SQUASH_AMOUNT, 1, easeInOutSine(t));
    }
  } else if (slide.active && slide.elapsed < SLIDE_ANTICIPATION_DURATION) {
    const t = clamp(slide.elapsed / SLIDE_ANTICIPATION_DURATION, 0, 1);
    target = lerp(SLIDE_ANTICIPATION_SQUASH, 1, t);
  }

  const factor = dampFactor(SQUASH_STRETCH_SMOOTH_TIME, deltaTime);
  player.squashStretch = lerp(player.squashStretch, target, factor);

  player.group.scale.y = player.currentHeightScale * player.squashStretch;
  const xzScale = 1 + (1 - player.squashStretch) * 0.4;
  player.group.scale.x = xzScale;
  player.group.scale.z = xzScale;
}

/**
 * A subtle body lean into lane changes, purely visual: a rotation about the group's own Z axis
 * that peaks mid-transition and returns to exactly 0 the instant the transition ends or is
 * inactive, so it can never leave a residual tilt. Computed fresh from the transition's current
 * progress every frame (no persistent lean state), so it stays correct even if a transition is
 * interrupted by a new one partway through. Never touches currentX or lane timing.
 */
function updateLaneLean(player: Player, _deltaTime: number): void {
  const transition = player.laneTransition;
  if (!transition.active) {
    player.group.rotation.z = 0;
    return;
  }

  const t = clamp(transition.elapsed / LANE_TRANSITION_DURATION, 0, 1);
  const direction = Math.sign(transition.toX - transition.fromX);
  const envelope = Math.sin(Math.PI * t); // 0 at start/end, 1 at the midpoint.
  player.group.rotation.z = -direction * degToRad(LANE_LEAN_MAX_DEGREES) * envelope;
}

function updateRunAnimation(player: Player, deltaTime: number): void {
  player.runTime += deltaTime;

  const swing = RUN_LIMB_SWING_AMPLITUDE * Math.sin(player.runTime * RUN_CYCLE_SPEED);
  player.armLeftPivot.rotation.x = swing;
  player.armRightPivot.rotation.x = -swing;
  player.legLeftPivot.rotation.x = -swing;
  player.legRightPivot.rotation.x = swing;

  const bob = RUN_BODY_BOB_AMPLITUDE * Math.abs(Math.sin(player.runTime * RUN_CYCLE_SPEED));
  player.bodyGroup.position.y = bob;
}

/**
 * Drives the player's collision feedback: a sharp tint pulse on the frame of a hit (which
 * takes priority), or a gentle shimmer for the remainder of an invincibility window.
 */
function updateHitAndInvincibilityVisual(player: Player, deltaTime: number): void {
  if (player.hitFeedback.active) {
    player.hitFeedback.elapsed += deltaTime;
    const t = player.hitFeedback.elapsed / HIT_FEEDBACK_DURATION;
    if (t >= 1) {
      player.hitFeedback.active = false;
    } else {
      player.setTintIntensity(Math.sin(Math.PI * clamp(t, 0, 1)));
      return;
    }
  }

  if (player.invincible) {
    const shimmer = 0.5 + 0.5 * Math.sin(player.runTime * INVINCIBILITY_SHIMMER_SPEED);
    player.setTintIntensity(shimmer * 0.35);
  } else {
    player.setTintIntensity(0);
  }
}
