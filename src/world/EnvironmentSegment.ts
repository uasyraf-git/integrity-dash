import * as THREE from 'three';
import {
  BACKGROUND_SILHOUETTE_DEPTH,
  BACKGROUND_SILHOUETTE_HEIGHT,
  BACKGROUND_SILHOUETTE_X_OFFSET,
  FLOOR_SEAM_INTERVAL,
  PILLAR_INTERVAL,
  SEGMENT_LENGTH,
  THEME_PROP_WALL_OFFSET,
  TRACK_WIDTH,
  LANE_WIDTH,
  WALL_TRIM_THICKNESS,
} from '../config/gameConfig';
import type { AmbientAnimationSystem } from '../effects/AmbientAnimationSystem';
import { ALL_ENVIRONMENT_THEME_IDS, EnvironmentThemeId } from './EnvironmentThemeId';
import { buildThemeVignette } from './environmentThemes';

export interface SegmentMaterials {
  floor: THREE.Material;
  floorSeam: THREE.Material;
  laneLine: THREE.Material;
  edge: THREE.Material;
  pillar: THREE.Material;
  glass: THREE.Material;
  gold: THREE.Material;
  ceiling: THREE.Material;
  wallTrim: THREE.Material;
  background: THREE.Material;
}

/**
 * One repeatable slice of the Corporate HQ track. Structural geometry (floor, lane lines,
 * pillars, glass, ceiling beams) is unchanged from Sprint 1/2A and built once in the
 * constructor, exactly as before - Sprint 3B only adds decorative layers on top (floor seam
 * trim, wall trim, a background depth layer, and per-theme prop vignettes), all built once here
 * too. Only the group's Z position (and, for the theme vignettes, which one is visible) ever
 * changes afterward, so the environment never grows the scene graph while the game runs.
 */
export class EnvironmentSegment {
  readonly group: THREE.Group;
  private readonly themeGroups: Map<EnvironmentThemeId, THREE.Group> = new Map();
  private activeTheme: EnvironmentThemeId | null = null;

  constructor(
    materials: SegmentMaterials,
    ambientSystem: AmbientAnimationSystem,
    propDensity: number,
    backgroundDepthEnabled: boolean,
  ) {
    this.group = new THREE.Group();

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(TRACK_WIDTH, 0.2, SEGMENT_LENGTH),
      materials.floor,
    );
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    this.group.add(floor);

    const laneLineOffsets = [-LANE_WIDTH / 2, LANE_WIDTH / 2];
    for (const x of laneLineOffsets) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.02, SEGMENT_LENGTH),
        materials.laneLine,
      );
      line.position.set(x, 0.011, 0);
      this.group.add(line);
    }

    const edgeOffsets = [-TRACK_WIDTH / 2 + 0.2, TRACK_WIDTH / 2 - 0.2];
    for (const x of edgeOffsets) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, SEGMENT_LENGTH), materials.edge);
      edge.position.set(x, 0.005, 0);
      this.group.add(edge);
    }

    const sideX = TRACK_WIDTH / 2 + 0.6;
    const pillarCount = Math.max(1, Math.round(SEGMENT_LENGTH / PILLAR_INTERVAL));
    for (let i = 0; i < pillarCount; i++) {
      const localZ = -SEGMENT_LENGTH / 2 + PILLAR_INTERVAL * i + PILLAR_INTERVAL / 2;
      for (const side of [-1, 1]) {
        this.addPillar(side * sideX, localZ, materials);
      }

      if (i < pillarCount - 1) {
        const glassZ = localZ + PILLAR_INTERVAL / 2;
        for (const side of [-1, 1]) {
          this.addGlassPanel(side * sideX, glassZ, materials);
        }
      }
    }

    const beamCount = Math.max(1, Math.round(SEGMENT_LENGTH / (PILLAR_INTERVAL * 2)));
    for (let i = 0; i < beamCount; i++) {
      const localZ = -SEGMENT_LENGTH / 2 + (SEGMENT_LENGTH / beamCount) * (i + 0.5);
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(TRACK_WIDTH + 1.2, 0.25, 0.4),
        materials.ceiling,
      );
      beam.position.set(0, 4.3, localZ);
      this.group.add(beam);

      const accent = new THREE.Mesh(
        new THREE.BoxGeometry(TRACK_WIDTH + 1.2, 0.04, 0.06),
        materials.gold,
      );
      accent.position.set(0, 4.15, localZ);
      this.group.add(accent);
    }

    this.addFloorSeams(materials);
    this.addWallTrim(sideX, materials);
    if (backgroundDepthEnabled) this.addBackgroundSilhouettes(sideX, materials);
    this.addThemeVignettes(sideX, ambientSystem, propDensity);
  }

  /** Task 6: subtle periodic floor seam strips, purely decorative - the floor's top surface,
   *  width, and every lane/edge position above are completely unchanged. */
  private addFloorSeams(materials: SegmentMaterials): void {
    const seamCount = Math.max(1, Math.round(SEGMENT_LENGTH / FLOOR_SEAM_INTERVAL));
    for (let i = 1; i < seamCount; i++) {
      const localZ = -SEGMENT_LENGTH / 2 + FLOOR_SEAM_INTERVAL * i;
      const seam = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH - 0.4, 0.012, 0.03), materials.floorSeam);
      seam.position.set(0, 0.006, localZ);
      this.group.add(seam);
    }
  }

  /** Task 6: thin horizontal trim strips along the glass-panel wall line, giving the wall a
   *  more "designed" read without adding new collision-relevant geometry anywhere. */
  private addWallTrim(sideX: number, materials: SegmentMaterials): void {
    for (const side of [-1, 1]) {
      for (const y of [0.15, 3.05]) {
        const trim = new THREE.Mesh(
          new THREE.BoxGeometry(WALL_TRIM_THICKNESS, WALL_TRIM_THICKNESS, SEGMENT_LENGTH),
          materials.wallTrim,
        );
        trim.position.set(side * (sideX - 0.05), y, 0);
        this.group.add(trim);
      }
    }
  }

  /** Task 7: large, distant, low-poly silhouettes beyond the wall line, sharing one cheap
   *  unlit-style material and fading into the existing fog - eliminates the "void" beyond the
   *  glass without adding meaningful draw-call or geometry cost. Not true parallax (it moves
   *  with the segment, at the same speed as everything else) - see docs/SPRINT_03B.md. */
  private addBackgroundSilhouettes(sideX: number, materials: SegmentMaterials): void {
    for (const side of [-1, 1]) {
      const silhouette = new THREE.Mesh(
        new THREE.BoxGeometry(BACKGROUND_SILHOUETTE_DEPTH, BACKGROUND_SILHOUETTE_HEIGHT, SEGMENT_LENGTH * 0.9),
        materials.background,
      );
      silhouette.position.set(
        side * (sideX + BACKGROUND_SILHOUETTE_X_OFFSET),
        BACKGROUND_SILHOUETTE_HEIGHT / 2 - 0.5,
        0,
      );
      this.group.add(silhouette);
    }
  }

  /** Prebuilds every theme's decorative vignette (both wall sides) once, toggling visibility
   *  via setTheme() afterward - no vignette is ever created or destroyed during gameplay. At
   *  low prop density (see gameConfig quality tuning), only the near wall side is built at all,
   *  roughly halving the decorative footprint for lower-end devices. */
  private addThemeVignettes(sideX: number, ambientSystem: AmbientAnimationSystem, propDensity: number): void {
    const wallX = sideX + THEME_PROP_WALL_OFFSET;
    const sides: ReadonlyArray<1 | -1> = propDensity < 0.6 ? [-1] : [-1, 1];

    for (const themeId of ALL_ENVIRONMENT_THEME_IDS) {
      const themeGroup = new THREE.Group();
      themeGroup.visible = false;

      for (const side of sides) {
        const vignette = buildThemeVignette(themeId, side, propDensity, ambientSystem);
        vignette.position.set(side * wallX, 0, 0);
        themeGroup.add(vignette);
      }

      this.themeGroups.set(themeId, themeGroup);
      this.group.add(themeGroup);
    }
  }

  /** Swaps the visible theme vignette. A no-op if this theme is already active, so recycling a
   *  segment into the same theme it already had (rare, but possible) never toggles anything. */
  setTheme(themeId: EnvironmentThemeId): void {
    if (this.activeTheme === themeId) return;
    if (this.activeTheme) {
      const previous = this.themeGroups.get(this.activeTheme);
      if (previous) previous.visible = false;
    }
    const next = this.themeGroups.get(themeId);
    if (next) next.visible = true;
    this.activeTheme = themeId;
  }

  getTheme(): EnvironmentThemeId | null {
    return this.activeTheme;
  }

  private addPillar(x: number, z: number, materials: SegmentMaterials): void {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.2, 0.5), materials.pillar);
    pillar.position.set(x, 2.1, z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    this.group.add(pillar);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.56), materials.gold);
    cap.position.set(x, 4.05, z);
    this.group.add(cap);
  }

  private addGlassPanel(x: number, z: number, materials: SegmentMaterials): void {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 3, PILLAR_INTERVAL - 0.6),
      materials.glass,
    );
    panel.position.set(x, 1.6, z);
    this.group.add(panel);
  }

  setZ(z: number): void {
    this.group.position.z = z;
  }

  getZ(): number {
    return this.group.position.z;
  }
}
