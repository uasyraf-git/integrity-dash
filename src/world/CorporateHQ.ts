import * as THREE from 'three';
import { THEME } from '../config/theme';
import { CAMERA_DISTANCE, SEGMENT_COUNT, SEGMENT_LENGTH, TRACK_WIDTH } from '../config/gameConfig';
import type { AmbientAnimationSystem } from '../effects/AmbientAnimationSystem';
import type { QualitySettings } from '../config/qualityConfig';
import { EnvironmentSegment, type SegmentMaterials } from './EnvironmentSegment';
import { ALL_ENVIRONMENT_THEME_IDS, EnvironmentThemeId } from './EnvironmentThemeId';
import { ThemeSelector } from './ThemeSelector';

const TOTAL_LOOP_LENGTH = SEGMENT_LENGTH * SEGMENT_COUNT;
const RECYCLE_BEHIND_Z = CAMERA_DISTANCE + SEGMENT_LENGTH / 2 + 2;

/**
 * Owns the recycled Corporate HQ track: a fixed pool of EnvironmentSegment instances that are
 * repositioned (never recreated) to fake infinite travel, plus a one-off reception backdrop
 * marking the start of the run. Also owns the ThemeSelector and assigns its current theme to
 * whichever segment recycles to the front - see EnvironmentSegment for how a segment actually
 * renders a theme, and ThemeSelector for how the active theme advances over time.
 */
export class CorporateHQ {
  readonly group: THREE.Group;
  private readonly segments: EnvironmentSegment[] = [];
  private readonly themeSelector = new ThemeSelector();

  constructor(ambientSystem: AmbientAnimationSystem, quality: QualitySettings) {
    this.group = new THREE.Group();

    const materials = this.createMaterials();

    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const segment = new EnvironmentSegment(
        materials,
        ambientSystem,
        quality.propDensity,
        quality.backgroundDepthEnabled,
      );
      const z = CAMERA_DISTANCE - SEGMENT_LENGTH / 2 - i * SEGMENT_LENGTH;
      segment.setZ(z);
      segment.setTheme(ALL_ENVIRONMENT_THEME_IDS[i % ALL_ENVIRONMENT_THEME_IDS.length]);
      this.segments.push(segment);
      this.group.add(segment.group);
    }

    this.group.add(this.createReceptionBackdrop(materials));
  }

  private createMaterials(): SegmentMaterials {
    return {
      floor: new THREE.MeshStandardMaterial({ color: 0x0d2740, roughness: 0.75, metalness: 0.1 }),
      floorSeam: new THREE.MeshStandardMaterial({ color: 0x0a1f33, roughness: 0.8 }),
      laneLine: new THREE.MeshStandardMaterial({
        color: THEME.white,
        roughness: 0.4,
        emissive: THEME.white,
        emissiveIntensity: 0.08,
      }),
      edge: new THREE.MeshStandardMaterial({ color: THEME.darkNavy, roughness: 0.9 }),
      pillar: new THREE.MeshStandardMaterial({
        color: THEME.integrityBlue,
        roughness: 0.5,
        metalness: 0.2,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: THEME.brightBlue,
        transparent: true,
        opacity: 0.22,
        roughness: 0.1,
        metalness: 0,
        transmission: 0.3,
      }),
      gold: new THREE.MeshStandardMaterial({
        color: THEME.gold,
        roughness: 0.3,
        metalness: 0.5,
        emissive: THEME.gold,
        emissiveIntensity: 0.2,
      }),
      ceiling: new THREE.MeshStandardMaterial({ color: 0x0a1f33, roughness: 0.7, metalness: 0.15 }),
      wallTrim: new THREE.MeshStandardMaterial({
        color: THEME.gold,
        roughness: 0.3,
        metalness: 0.4,
        emissive: THEME.gold,
        emissiveIntensity: 0.1,
      }),
      background: new THREE.MeshStandardMaterial({ color: 0x081627, roughness: 0.9, metalness: 0 }),
    };
  }

  private createReceptionBackdrop(materials: SegmentMaterials): THREE.Group {
    const backdrop = new THREE.Group();
    const z = CAMERA_DISTANCE + SEGMENT_LENGTH / 2 - 1;

    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(TRACK_WIDTH + 2, 4.2, 0.3),
      materials.ceiling,
    );
    wall.position.set(0, 2.1, z);
    backdrop.add(wall);

    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 1), materials.pillar);
    desk.position.set(0, 0.5, z - 0.9);
    desk.castShadow = true;
    backdrop.add(desk);

    const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.5, 5), materials.gold);
    emblem.position.set(0, 2.4, z - 0.14);
    backdrop.add(emblem);

    return backdrop;
  }

  update(deltaTime: number, speed: number): void {
    this.themeSelector.update(deltaTime);

    const advance = speed * deltaTime;
    for (const segment of this.segments) {
      const nextZ = segment.getZ() + advance;
      if (nextZ > RECYCLE_BEHIND_Z) {
        segment.setZ(nextZ - TOTAL_LOOP_LENGTH);
        segment.setTheme(this.themeSelector.getCurrentTheme());
      } else {
        segment.setZ(nextZ);
      }
    }
  }

  /** Returns the current theme of the segment nearest the player, for HUD/QA visibility only -
   *  gameplay never depends on which theme is showing. */
  getActiveTheme(): EnvironmentThemeId {
    return this.themeSelector.getCurrentTheme();
  }

  reset(): void {
    this.themeSelector.reset();
    for (let i = 0; i < this.segments.length; i++) {
      this.segments[i].setZ(CAMERA_DISTANCE - SEGMENT_LENGTH / 2 - i * SEGMENT_LENGTH);
      this.segments[i].setTheme(ALL_ENVIRONMENT_THEME_IDS[i % ALL_ENVIRONMENT_THEME_IDS.length]);
    }
  }
}
