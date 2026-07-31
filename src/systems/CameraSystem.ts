import * as THREE from 'three';
import type { Player } from '../entities/Player';
import {
  CAMERA_DISTANCE,
  CAMERA_FOLLOW_DAMPING,
  CAMERA_FOLLOW_LAG,
  CAMERA_FOV_BASE,
  CAMERA_FOV_MAX_BOOST,
  CAMERA_HEIGHT,
  CAMERA_SHAKE_BLEND_TIME,
  CAMERA_TILT_DEGREES,
  INITIAL_SPEED,
  MAX_SPEED,
} from '../config/gameConfig';
import { clamp, dampFactor, degToRad, lerp } from '../utils/math';

const desiredPosition = new THREE.Vector3();
const ZERO_SHAKE = { x: 0, y: 0 };
const CAMERA_PITCH = -degToRad(CAMERA_TILT_DEGREES);

/**
 * Smoothly follows the player from behind and slightly above using exponential damping on
 * position only. Pitch stays fixed at the design-doc tilt so the camera never yaws or changes
 * FOV beyond the existing subtle speed-based boost.
 *
 * Follow position goes through two smoothing stages: `smoothedPosition` tracks the desired
 * position at the original, unchanged `CAMERA_FOLLOW_DAMPING` rate (preserving Sprint 1/2A
 * responsiveness), then `renderPosition` trails `smoothedPosition` with a much lighter, faster
 * secondary pass (`CAMERA_FOLLOW_LAG`) purely to smooth out any remaining per-frame stepping -
 * a subtle "premium" trailing feel, not an added input delay. Shake is blended through the same
 * kind of light secondary pass before being added on top of `renderPosition` at the very last
 * step, so shake can never contaminate the follow-smoothing baseline itself.
 */
export class CameraSystem {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly smoothedPosition = new THREE.Vector3();
  private readonly renderPosition = new THREE.Vector3();
  private readonly smoothedShake = { x: 0, y: 0 };

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.camera.rotation.set(CAMERA_PITCH, 0, 0, 'YXZ');
  }

  snapTo(player: Player): void {
    this.smoothedPosition.set(player.currentX, CAMERA_HEIGHT, CAMERA_DISTANCE);
    this.renderPosition.copy(this.smoothedPosition);
    this.smoothedShake.x = 0;
    this.smoothedShake.y = 0;
    this.camera.position.copy(this.renderPosition);
    this.camera.rotation.set(CAMERA_PITCH, 0, 0, 'YXZ');
    this.camera.fov = CAMERA_FOV_BASE;
    this.camera.updateProjectionMatrix();
  }

  update(
    player: Player,
    currentSpeed: number,
    deltaTime: number,
    shakeOffset: Readonly<{ x: number; y: number }> = ZERO_SHAKE,
  ): void {
    desiredPosition.set(
      player.currentX,
      CAMERA_HEIGHT + player.group.position.y * 0.15,
      CAMERA_DISTANCE,
    );

    const factor = dampFactor(CAMERA_FOLLOW_DAMPING, deltaTime);
    this.smoothedPosition.x = lerp(this.smoothedPosition.x, desiredPosition.x, factor);
    this.smoothedPosition.y = lerp(this.smoothedPosition.y, desiredPosition.y, factor);
    this.smoothedPosition.z = lerp(this.smoothedPosition.z, desiredPosition.z, factor);

    const lagFactor = dampFactor(CAMERA_FOLLOW_LAG, deltaTime);
    this.renderPosition.x = lerp(this.renderPosition.x, this.smoothedPosition.x, lagFactor);
    this.renderPosition.y = lerp(this.renderPosition.y, this.smoothedPosition.y, lagFactor);
    this.renderPosition.z = lerp(this.renderPosition.z, this.smoothedPosition.z, lagFactor);

    const shakeBlend = dampFactor(CAMERA_SHAKE_BLEND_TIME, deltaTime);
    this.smoothedShake.x = lerp(this.smoothedShake.x, shakeOffset.x, shakeBlend);
    this.smoothedShake.y = lerp(this.smoothedShake.y, shakeOffset.y, shakeBlend);

    this.camera.position.set(
      this.renderPosition.x + this.smoothedShake.x,
      this.renderPosition.y + this.smoothedShake.y,
      this.renderPosition.z,
    );

    const speedRatio = clamp((currentSpeed - INITIAL_SPEED) / (MAX_SPEED - INITIAL_SPEED), 0, 1);
    const targetFov = CAMERA_FOV_BASE + speedRatio * CAMERA_FOV_MAX_BOOST;
    this.camera.fov = lerp(this.camera.fov, targetFov, factor);
    this.camera.updateProjectionMatrix();
  }
}
