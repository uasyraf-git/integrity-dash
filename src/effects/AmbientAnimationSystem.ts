import * as THREE from 'three';
import {
  AMBIENT_MONITOR_FLICKER_SPEED,
  AMBIENT_PLANT_SWAY_AMPLITUDE,
  AMBIENT_PLANT_SWAY_SPEED,
  AMBIENT_SERVER_BLINK_SPEED,
  AMBIENT_SIGNBOARD_PULSE_SPEED,
} from '../config/gameConfig';

export type AmbientAnimationKind = 'monitorFlicker' | 'serverBlink' | 'signboardPulse' | 'plantSway';

/** What a prop builder hands back for one animatable part. `phase` is filled in by `register()`
 *  so pooled instances of the same prop type don't all animate in perfect lockstep. */
export interface AmbientRegistration {
  kind: AmbientAnimationKind;
  material?: THREE.MeshStandardMaterial;
  baseEmissiveIntensity?: number;
  object?: THREE.Object3D;
}

interface AmbientEntry extends AmbientRegistration {
  phase: number;
  basePositionX: number;
}

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A single centralised update loop for all "world feels alive" decoration - monitor flicker,
 * server rack blink, signboard/coffee-machine pulse, and plant sway - instead of each prop
 * running its own per-object animation logic. Registration happens once, when a themed
 * vignette's props are built and placed (see EnvironmentSegment); `update()` is only ever
 * called from `Game.tick` inside the `PLAYING` guard, so it pauses and resumes exactly like
 * every other gameplay-tied system, with no internal state check needed here.
 */
export class AmbientAnimationSystem {
  private readonly registry: AmbientEntry[] = [];
  private elapsed = 0;

  register(entry: AmbientRegistration): void {
    this.registry.push({
      ...entry,
      phase: Math.random() * Math.PI * 2,
      basePositionX: entry.object?.position.x ?? 0,
    });
  }

  update(deltaTime: number): void {
    if (REDUCED_MOTION) return;
    this.elapsed += deltaTime;

    for (const entry of this.registry) {
      switch (entry.kind) {
        case 'monitorFlicker':
          this.applyFlicker(entry, AMBIENT_MONITOR_FLICKER_SPEED, 0.5, 0.2);
          break;
        case 'serverBlink':
          this.applyFlicker(entry, AMBIENT_SERVER_BLINK_SPEED, 0.9, 0.5);
          break;
        case 'signboardPulse':
          this.applyFlicker(entry, AMBIENT_SIGNBOARD_PULSE_SPEED, 0.6, 0.35);
          break;
        case 'plantSway':
          if (entry.object) {
            entry.object.rotation.z =
              Math.sin(this.elapsed * AMBIENT_PLANT_SWAY_SPEED + entry.phase) * AMBIENT_PLANT_SWAY_AMPLITUDE;
          }
          break;
      }
    }
  }

  private applyFlicker(entry: AmbientEntry, speed: number, wave: number, floor: number): void {
    if (!entry.material || entry.baseEmissiveIntensity === undefined) return;
    const t = 0.5 + 0.5 * Math.sin(this.elapsed * speed + entry.phase);
    entry.material.emissiveIntensity = entry.baseEmissiveIntensity * (floor + wave * t);
  }

  /** Resets elapsed time only - registrations persist for the app's lifetime (props are never
   *  rebuilt), matching every other pooled system's reset(). */
  reset(): void {
    this.elapsed = 0;
  }
}
