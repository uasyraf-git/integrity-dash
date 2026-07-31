import * as THREE from 'three';
import { THEME } from '../config/theme';
import { TOKEN_COLLISION_HALF_EXTENT } from '../config/gameConfig';
import { Collectible } from './Collectible';
import { CollectibleTypeId } from './CollectibleType';

const BODY_RADIUS = 0.3;
const BODY_THICKNESS = 0.09;
const ACCENT_RADIUS = 0.22;
const BADGE_RADIUS = 0.1;

/**
 * Builds one Integrity Token: a hexagonal disc (not a round coin) in Integrity Blue, a gold
 * hexagonal accent on each face, and a small white pentagon "badge" motif echoing the game's
 * shield emblem. Materials are created fresh per call (never shared) so each pooled token can
 * fade/glow independently during its own pickup animation. Geometry is intentionally simple:
 * one cylinder plus four flat discs, all with a 6-segment (hexagon) or 5-segment (pentagon)
 * radial count - no curves, no extra detail.
 */
export function createTokenVisual(): {
  group: THREE.Group;
  localBounds: THREE.Box3;
  materials: THREE.MeshStandardMaterial[];
} {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: THEME.integrityBlue,
    roughness: 0.35,
    metalness: 0.4,
    transparent: true,
    opacity: 1,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: THEME.gold,
    roughness: 0.3,
    metalness: 0.45,
    emissive: THEME.gold,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 1,
  });
  const badgeMaterial = new THREE.MeshStandardMaterial({
    color: THEME.white,
    roughness: 0.4,
    metalness: 0.1,
    transparent: true,
    opacity: 1,
  });

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, BODY_THICKNESS, 6),
    bodyMaterial,
  );
  body.rotation.x = Math.PI / 2; // Faces point along +/-Z instead of the default +/-Y.
  body.castShadow = false;
  group.add(body);

  const halfThickness = BODY_THICKNESS / 2;
  for (const side of [1, -1] as const) {
    const accent = new THREE.Mesh(new THREE.CircleGeometry(ACCENT_RADIUS, 6), accentMaterial);
    accent.position.z = side * (halfThickness + 0.006);
    if (side < 0) accent.rotation.y = Math.PI;
    group.add(accent);

    const badge = new THREE.Mesh(new THREE.CircleGeometry(BADGE_RADIUS, 5), badgeMaterial);
    badge.position.z = side * (halfThickness + 0.012);
    if (side < 0) badge.rotation.y = Math.PI;
    group.add(badge);
  }

  const localBounds = new THREE.Box3(
    new THREE.Vector3(-TOKEN_COLLISION_HALF_EXTENT, -TOKEN_COLLISION_HALF_EXTENT, -TOKEN_COLLISION_HALF_EXTENT),
    new THREE.Vector3(TOKEN_COLLISION_HALF_EXTENT, TOKEN_COLLISION_HALF_EXTENT, TOKEN_COLLISION_HALF_EXTENT),
  );

  return { group, localBounds, materials: [bodyMaterial, accentMaterial, badgeMaterial] };
}

export function createCollectible(typeId: CollectibleTypeId): Collectible {
  const { group, localBounds, materials } = createTokenVisual();
  return new Collectible(typeId, group, localBounds, materials);
}
