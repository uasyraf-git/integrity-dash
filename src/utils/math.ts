export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/** Exponential smoothing factor for frame-rate-independent damping toward a target. */
export function dampFactor(dampingTime: number, deltaTime: number): number {
  if (dampingTime <= 0) return 1;
  return 1 - Math.exp(-deltaTime / dampingTime);
}

export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/** Smooth 0->1->0 arc, used for the jump height curve. */
export function jumpArc(t: number): number {
  return Math.sin(Math.PI * clamp(t, 0, 1));
}

/** Eases 0->1 with a slight overshoot past 1 near the end, for a "pop" scale-in feel. */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = clamp(t, 0, 1) - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Picks a random index, weighted by the given non-negative weights. */
export function pickWeightedIndex(weights: ReadonlyArray<number>): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return weights.length - 1;
}
