import * as THREE from 'three';
import { THEME } from '../config/theme';
import { OBSTACLE_CONFIGS } from '../config/gameConfig';
import { Obstacle } from './Obstacle';
import { ObstacleTypeId } from './ObstacleType';

interface ObstacleMaterials {
  cabinetBody: THREE.Material;
  cabinetDrawerSeam: THREE.Material;
  boxCardboard: THREE.Material;
  boxCardboardDark: THREE.Material;
  boxLabel: THREE.Material;
  barrierPost: THREE.Material;
  barrierBar: THREE.Material;
  barrierStripe: THREE.Material;
  coneBody: THREE.Material;
  coneStripe: THREE.Material;
  coneBase: THREE.Material;
  printerBody: THREE.Material;
  printerTray: THREE.Material;
  printerPanel: THREE.Material;
  gold: THREE.Material;
}

let cachedMaterials: ObstacleMaterials | null = null;

/** Materials are created once and shared across every pooled obstacle instance. */
function getMaterials(): ObstacleMaterials {
  if (cachedMaterials) return cachedMaterials;

  cachedMaterials = {
    cabinetBody: new THREE.MeshStandardMaterial({ color: 0x445b6e, roughness: 0.55, metalness: 0.3 }),
    cabinetDrawerSeam: new THREE.MeshStandardMaterial({ color: 0x263241, roughness: 0.6 }),
    boxCardboard: new THREE.MeshStandardMaterial({ color: 0x8a7a63, roughness: 0.85 }),
    boxCardboardDark: new THREE.MeshStandardMaterial({ color: 0x6f6250, roughness: 0.85 }),
    boxLabel: new THREE.MeshStandardMaterial({ color: THEME.white, roughness: 0.5 }),
    barrierPost: new THREE.MeshStandardMaterial({ color: THEME.darkNavy, roughness: 0.5, metalness: 0.3 }),
    barrierBar: new THREE.MeshStandardMaterial({ color: THEME.integrityBlue, roughness: 0.4, metalness: 0.35 }),
    barrierStripe: new THREE.MeshStandardMaterial({
      color: THEME.gold,
      roughness: 0.35,
      metalness: 0.3,
      emissive: THEME.gold,
      emissiveIntensity: 0.15,
    }),
    coneBody: new THREE.MeshStandardMaterial({
      color: THEME.gold,
      roughness: 0.4,
      metalness: 0.2,
      emissive: THEME.gold,
      emissiveIntensity: 0.1,
    }),
    coneStripe: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }),
    coneBase: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7 }),
    printerBody: new THREE.MeshStandardMaterial({ color: THEME.darkNavy, roughness: 0.5, metalness: 0.25 }),
    printerTray: new THREE.MeshStandardMaterial({ color: 0x7c8896, roughness: 0.5, metalness: 0.2 }),
    printerPanel: new THREE.MeshStandardMaterial({
      color: THEME.brightBlue,
      roughness: 0.3,
      metalness: 0.4,
      emissive: THEME.brightBlue,
      emissiveIntensity: 0.2,
    }),
    gold: new THREE.MeshStandardMaterial({
      color: THEME.gold,
      roughness: 0.35,
      metalness: 0.4,
      emissive: THEME.gold,
      emissiveIntensity: 0.15,
    }),
  };

  return cachedMaterials;
}

function buildFilingCabinet(materials: ObstacleMaterials, height: number): THREE.Group {
  const group = new THREE.Group();
  const width = 1.0;
  const depth = 0.64;

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials.cabinetBody);
  body.position.y = height / 2;
  body.castShadow = true;
  group.add(body);

  const drawerCount = 4;
  for (let i = 1; i < drawerCount; i++) {
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.01, 0.03, depth + 0.01),
      materials.cabinetDrawerSeam,
    );
    seam.position.y = (height / drawerCount) * i;
    group.add(seam);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), materials.gold);
    handle.position.set(0, (height / drawerCount) * (i - 0.5), depth / 2 + 0.02);
    group.add(handle);
  }

  return group;
}

function buildArchiveBoxes(materials: ObstacleMaterials, height: number): THREE.Group {
  const group = new THREE.Group();
  const boxHeights = [0.42, 0.38, 0.34];
  let y = 0;

  boxHeights.forEach((boxHeight, index) => {
    const width = 0.82 - index * 0.06;
    const depth = 0.82 - index * 0.06;
    const material = index % 2 === 0 ? materials.boxCardboard : materials.boxCardboardDark;

    const box = new THREE.Mesh(new THREE.BoxGeometry(width, boxHeight, depth), material);
    box.position.set((index - 1) * 0.03, y + boxHeight / 2, 0);
    box.castShadow = true;
    group.add(box);

    const label = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.5, boxHeight * 0.35), materials.boxLabel);
    label.position.set((index - 1) * 0.03, y + boxHeight / 2, depth / 2 + 0.005);
    group.add(label);

    y += boxHeight;
  });

  // Ensure the stack's actual built height matches the configured collision height.
  group.scale.y = height / y;

  return group;
}

function buildSecurityBarrier(materials: ObstacleMaterials, minY: number, maxY: number): THREE.Group {
  const group = new THREE.Group();
  const laneSpan = 2.6;
  const postHeight = 3.0;

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, postHeight, 0.14), materials.barrierPost);
    post.position.set(side * (laneSpan / 2), postHeight / 2, 0);
    post.castShadow = true;
    group.add(post);
  }

  const barHeight = maxY - minY > 0.8 ? 0.8 : maxY - minY;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(laneSpan + 0.1, barHeight, 0.18), materials.barrierBar);
  bar.position.y = minY + barHeight / 2;
  bar.castShadow = true;
  group.add(bar);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(laneSpan + 0.12, 0.08, 0.2), materials.barrierStripe);
  stripe.position.y = minY + barHeight / 2;
  group.add(stripe);

  return group;
}

function buildWetFloorCone(materials: ObstacleMaterials, height: number): THREE.Group {
  const group = new THREE.Group();

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.04, 12), materials.coneBase);
  base.position.y = 0.02;
  group.add(base);

  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, height - 0.04, 10), materials.coneBody);
  cone.position.y = 0.04 + (height - 0.04) / 2;
  cone.castShadow = true;
  group.add(cone);

  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.06, 10), materials.coneStripe);
  stripe.position.y = 0.04 + (height - 0.04) * 0.45;
  group.add(stripe);

  return group;
}

function buildBrokenPrinter(materials: ObstacleMaterials, height: number): THREE.Group {
  const group = new THREE.Group();
  const width = 0.9;
  const depth = 0.7;
  const bodyHeight = height * 0.65;

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, bodyHeight, depth), materials.printerBody);
  body.position.y = bodyHeight / 2;
  body.castShadow = true;
  group.add(body);

  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.8, height - bodyHeight, depth * 0.75),
    materials.printerTray,
  );
  tray.position.set(0.04, bodyHeight + (height - bodyHeight) / 2, -0.02);
  tray.rotation.z = -0.05;
  tray.castShadow = true;
  group.add(tray);

  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.14), materials.printerPanel);
  panel.position.set(-0.2, bodyHeight * 0.7, depth / 2 + 0.005);
  group.add(panel);

  return group;
}

/** Builds the visual group and matching local-space collision box for one obstacle type. */
export function createObstacleVisual(typeId: ObstacleTypeId): { group: THREE.Group; localBounds: THREE.Box3 } {
  const config = OBSTACLE_CONFIGS[typeId];
  const materials = getMaterials();
  const height = config.collisionMaxY;

  let group: THREE.Group;
  switch (typeId) {
    case ObstacleTypeId.FILING_CABINET:
      group = buildFilingCabinet(materials, height);
      break;
    case ObstacleTypeId.ARCHIVE_BOXES:
      group = buildArchiveBoxes(materials, height);
      break;
    case ObstacleTypeId.SECURITY_BARRIER:
      group = buildSecurityBarrier(materials, config.collisionMinY, config.collisionMaxY);
      break;
    case ObstacleTypeId.WET_FLOOR_CONE:
      group = buildWetFloorCone(materials, height);
      break;
    case ObstacleTypeId.BROKEN_PRINTER:
      group = buildBrokenPrinter(materials, height);
      break;
  }

  const localBounds = new THREE.Box3(
    new THREE.Vector3(-config.collisionHalfWidth, config.collisionMinY, -config.collisionHalfDepth),
    new THREE.Vector3(config.collisionHalfWidth, config.collisionMaxY, config.collisionHalfDepth),
  );

  return { group, localBounds };
}

export function createObstacle(typeId: ObstacleTypeId): Obstacle {
  const config = OBSTACLE_CONFIGS[typeId];
  const { group, localBounds } = createObstacleVisual(typeId);
  return new Obstacle(typeId, config.behavior, group, localBounds);
}
