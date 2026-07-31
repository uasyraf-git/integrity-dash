import * as THREE from 'three';
import type { AmbientAnimationSystem } from '../effects/AmbientAnimationSystem';
import {
  createCoffeeMachine,
  createComputerMonitor,
  createDigitalSignboard,
  createFilingCabinet,
  createIndoorPlant,
  createMeetingTable,
  createOfficeChair,
  createOfficeDesk,
  createPantryCounter,
  createReceptionDesk,
  createServerRack,
  createWallPanel,
  type PropResult,
} from './props/PropFactory';
import { EnvironmentThemeId } from './EnvironmentThemeId';

interface PropPlacement {
  build: () => PropResult;
  /** Local offset from the vignette's base wall position, +x pointing further away from the
   *  track centre (never back toward it), +z along the segment's length. */
  x: number;
  z: number;
  rotationY?: number;
}

export interface EnvironmentThemeConfig {
  id: EnvironmentThemeId;
  displayName: string;
  /** A short description of the theme's intended atmosphere, used only for documentation/QA -
   *  actual "lighting" is achieved by material/emissive choice, not a dedicated scene light
   *  (see docs/SPRINT_03B.md for why). */
  atmosphere: string;
  /** Ordered most-important-first; propDensity trims from the end (see buildThemeVignette). */
  props: ReadonlyArray<PropPlacement>;
}

export const ENVIRONMENT_THEMES: Record<EnvironmentThemeId, EnvironmentThemeConfig> = {
  [EnvironmentThemeId.RECEPTION]: {
    id: EnvironmentThemeId.RECEPTION,
    displayName: 'Reception',
    atmosphere: 'warm',
    props: [
      { build: createReceptionDesk, x: 0.3, z: 0, rotationY: 0 },
      { build: createIndoorPlant, x: -0.1, z: 1.6, rotationY: 0 },
      { build: createWallPanel, x: 0, z: -1.8, rotationY: 0 },
    ],
  },
  [EnvironmentThemeId.OPEN_OFFICE]: {
    id: EnvironmentThemeId.OPEN_OFFICE,
    displayName: 'Open Office',
    atmosphere: 'neutral',
    props: [
      { build: createOfficeDesk, x: 0.2, z: 0, rotationY: 0 },
      { build: createComputerMonitor, x: 0.2, z: 0, rotationY: 0 },
      { build: createOfficeChair, x: -0.05, z: 0.55, rotationY: Math.PI },
      { build: createFilingCabinet, x: 0.1, z: -1.7, rotationY: 0 },
    ],
  },
  [EnvironmentThemeId.MEETING_ROOM]: {
    id: EnvironmentThemeId.MEETING_ROOM,
    displayName: 'Meeting Room',
    atmosphere: 'soft-neutral',
    props: [
      { build: createMeetingTable, x: 0.4, z: 0, rotationY: Math.PI / 2 },
      { build: createOfficeChair, x: 0.0, z: 0.75, rotationY: Math.PI },
      { build: createOfficeChair, x: 0.0, z: -0.75, rotationY: 0 },
      { build: createDigitalSignboard, x: -0.1, z: 1.9, rotationY: 0 },
    ],
  },
  [EnvironmentThemeId.PANTRY]: {
    id: EnvironmentThemeId.PANTRY,
    displayName: 'Pantry',
    atmosphere: 'warm',
    props: [
      { build: createPantryCounter, x: 0.2, z: 0, rotationY: 0 },
      { build: createCoffeeMachine, x: 0.25, z: 0.55, rotationY: 0 },
      { build: createIndoorPlant, x: -0.1, z: -1.7, rotationY: 0 },
    ],
  },
  [EnvironmentThemeId.SERVER_ROOM]: {
    id: EnvironmentThemeId.SERVER_ROOM,
    displayName: 'Server Room',
    atmosphere: 'cool',
    props: [
      { build: createServerRack, x: 0.15, z: 0, rotationY: 0 },
      { build: createServerRack, x: 0.15, z: -1.1, rotationY: 0 },
      { build: createWallPanel, x: -0.1, z: 1.7, rotationY: 0 },
    ],
  },
};

/**
 * Builds one themed vignette: a small cluster of decorative props for a single (segment, theme,
 * side) combination, called once per combination at startup and never rebuilt. `propDensity`
 * (from the active quality preset) trims lower-priority props from the end of each theme's list
 * rather than building everything and hiding it, so lower quality settings genuinely allocate
 * less geometry, not just render less of it. Registers any ambient-animatable parts with the
 * given AmbientAnimationSystem as it builds, since this is the one point every prop instance is
 * actually constructed.
 */
export function buildThemeVignette(
  themeId: EnvironmentThemeId,
  side: 1 | -1,
  propDensity: number,
  ambientSystem: AmbientAnimationSystem,
): THREE.Group {
  const config = ENVIRONMENT_THEMES[themeId];
  const group = new THREE.Group();

  const propCount = Math.max(1, Math.round(config.props.length * propDensity));
  for (let i = 0; i < propCount; i++) {
    const placement = config.props[i];
    const { group: propGroup, ambient } = placement.build();

    propGroup.position.set(side * placement.x, 0, placement.z);
    propGroup.rotation.y = placement.rotationY ?? 0;
    group.add(propGroup);

    if (ambient) {
      for (const registration of ambient) ambientSystem.register(registration);
    }
  }

  return group;
}
