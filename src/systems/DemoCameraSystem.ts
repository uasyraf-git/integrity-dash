import * as THREE from 'three';
import type { Player } from '../entities/Player';
import {
  DEMO_CAMERA_HEIGHT_VARIANCE,
  DEMO_CAMERA_LOOK_HEIGHT,
  DEMO_CAMERA_ORBIT_HEIGHT,
  DEMO_CAMERA_ORBIT_RADIUS,
  DEMO_CAMERA_ORBIT_SPEED,
} from '../config/gameConfig';

const lookTarget = new THREE.Vector3();

/**
 * Developer-only cinematic camera (F9): a slow orbit around the player, for screenshots/trailer
 * capture - not a gameplay feature. Deliberately isolated from CameraSystem: while active, it
 * writes directly to the shared THREE.PerspectiveCamera instead of going through
 * CameraSystem.update(), so none of CameraSystem's follow-smoothing state is touched and
 * exiting is simply "stop calling this, let CameraSystem's own snapTo() re-anchor it" - no
 * special-case restore logic needed here at all.
 */
export class DemoCameraSystem {
  private active = false;
  private angle = 0;

  isActive(): boolean {
    return this.active;
  }

  toggle(): void {
    if (this.active) this.deactivate();
    else this.activate();
  }

  activate(): void {
    this.active = true;
    this.angle = 0;
  }

  deactivate(): void {
    this.active = false;
  }

  update(deltaTime: number, player: Player, camera: THREE.PerspectiveCamera): void {
    if (!this.active) return;

    this.angle += deltaTime * DEMO_CAMERA_ORBIT_SPEED;
    const x = player.currentX + Math.sin(this.angle) * DEMO_CAMERA_ORBIT_RADIUS;
    const z = player.group.position.z + Math.cos(this.angle) * DEMO_CAMERA_ORBIT_RADIUS;
    const y = DEMO_CAMERA_ORBIT_HEIGHT + Math.sin(this.angle * 0.5) * DEMO_CAMERA_HEIGHT_VARIANCE;

    camera.position.set(x, y, z);
    lookTarget.set(player.currentX, DEMO_CAMERA_LOOK_HEIGHT, player.group.position.z);
    camera.lookAt(lookTarget);
  }

  /** Forcibly exits Demo Camera Mode - used on Restart/Main Menu so it can never leak across a
   *  state transition ("no broken camera after restart"). */
  reset(): void {
    this.active = false;
    this.angle = 0;
  }
}
