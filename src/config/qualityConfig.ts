export enum QualityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export interface QualitySettings {
  /** Fraction (0-1) of each theme's prop list actually built - see environmentThemes.ts. */
  propDensity: number;
  ambientAnimationEnabled: boolean;
  shadowsEnabled: boolean;
  backgroundDepthEnabled: boolean;
  /** Cap applied on top of window.devicePixelRatio when sizing the renderer. */
  maxPixelRatio: number;
}

/**
 * Three presets. None of these affect gameplay mechanics - only how much decorative geometry,
 * ambient animation, shadows, background depth, and render resolution are used. Documented in
 * docs/SPRINT_03B.md; not yet exposed through a UI (no settings menu this sprint), but the
 * config is intentionally self-contained so a future settings menu can just call
 * `QualityManager.setLevel()`.
 */
export const QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
  [QualityLevel.LOW]: {
    propDensity: 0.4,
    ambientAnimationEnabled: false,
    shadowsEnabled: false,
    backgroundDepthEnabled: false,
    maxPixelRatio: 1,
  },
  [QualityLevel.MEDIUM]: {
    propDensity: 0.7,
    ambientAnimationEnabled: true,
    shadowsEnabled: true,
    backgroundDepthEnabled: true,
    maxPixelRatio: 1.5,
  },
  [QualityLevel.HIGH]: {
    propDensity: 1,
    ambientAnimationEnabled: true,
    shadowsEnabled: true,
    backgroundDepthEnabled: true,
    maxPixelRatio: 2,
  },
};

/**
 * Picks a sensible default from a handful of weak signals combined (coarse pointer, CPU core
 * count, viewport width) rather than trusting any single one (e.g. user-agent sniffing) as the
 * sole decision method. This only ever affects visual density, never gameplay.
 */
export function detectDefaultQuality(): QualityLevel {
  if (typeof window === 'undefined') return QualityLevel.MEDIUM;

  const coarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const lowConcurrency =
    typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 4) <= 4;
  const smallViewport = window.innerWidth <= 480;

  if (smallViewport || (coarsePointer && lowConcurrency)) return QualityLevel.LOW;
  if (coarsePointer || lowConcurrency) return QualityLevel.MEDIUM;
  return QualityLevel.HIGH;
}

/** Reads a `?quality=low|medium|high` URL override, for manual QA - falls back to auto-detect. */
function readQualityOverride(): QualityLevel | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('quality')?.toUpperCase();
  if (raw === QualityLevel.LOW || raw === QualityLevel.MEDIUM || raw === QualityLevel.HIGH) {
    return raw;
  }
  return null;
}

/** Small holder for the resolved quality level and its settings, so callers don't each re-run
 *  detection. Resolved once at construction (no settings menu yet to change it mid-session). */
export class QualityManager {
  private readonly level: QualityLevel;

  constructor() {
    this.level = readQualityOverride() ?? detectDefaultQuality();
  }

  getLevel(): QualityLevel {
    return this.level;
  }

  getSettings(): QualitySettings {
    return QUALITY_PRESETS[this.level];
  }
}
