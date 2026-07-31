import * as THREE from 'three';
import { THEME } from '../../config/theme';
import type { AmbientRegistration } from '../../effects/AmbientAnimationSystem';

/** One built prop: a local-origin group (the caller positions/rotates it), plus any parts that
 *  should be registered with AmbientAnimationSystem once the prop is placed in the world. */
export interface PropResult {
  group: THREE.Group;
  ambient?: AmbientRegistration[];
}

interface PropMaterials {
  woodDesk: THREE.Material;
  deskAccent: THREE.Material;
  chairSeat: THREE.Material;
  chairFrame: THREE.Material;
  monitorBody: THREE.Material;
  cabinetBody: THREE.Material;
  cabinetTrim: THREE.Material;
  counterTop: THREE.Material;
  counterBody: THREE.Material;
  serverBody: THREE.Material;
  potBody: THREE.Material;
  foliage: THREE.Material;
  glassPanel: THREE.Material;
  panelFrame: THREE.Material;
  gold: THREE.Material;
  white: THREE.Material;
  neutralDark: THREE.Material;
}

let cachedMaterials: PropMaterials | null = null;

/** Shared, module-level material cache - built once, reused by every prop instance across
 *  every segment and theme. Only the handful of "ambient animated" parts (monitor screens,
 *  server lights, signboard panel, coffee machine indicator) get their own per-instance
 *  material, created individually in their builder, so each can animate independently. */
function getMaterials(): PropMaterials {
  if (cachedMaterials) return cachedMaterials;

  cachedMaterials = {
    woodDesk: new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.7, metalness: 0.05 }),
    deskAccent: new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.75 }),
    chairSeat: new THREE.MeshStandardMaterial({ color: 0x24405c, roughness: 0.6 }),
    chairFrame: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.4 }),
    monitorBody: new THREE.MeshStandardMaterial({ color: 0x141d29, roughness: 0.4, metalness: 0.3 }),
    cabinetBody: new THREE.MeshStandardMaterial({ color: 0x445b6e, roughness: 0.55, metalness: 0.25 }),
    cabinetTrim: new THREE.MeshStandardMaterial({ color: 0x263241, roughness: 0.6 }),
    counterTop: new THREE.MeshStandardMaterial({ color: 0xd9d9d9, roughness: 0.35, metalness: 0.1 }),
    counterBody: new THREE.MeshStandardMaterial({ color: 0x2f4258, roughness: 0.6 }),
    serverBody: new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.45, metalness: 0.35 }),
    potBody: new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.8 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x2f6b45, roughness: 0.75 }),
    glassPanel: new THREE.MeshPhysicalMaterial({
      color: THEME.brightBlue,
      transparent: true,
      opacity: 0.18,
      roughness: 0.1,
      transmission: 0.35,
    }),
    panelFrame: new THREE.MeshStandardMaterial({ color: THEME.integrityBlue, roughness: 0.5, metalness: 0.2 }),
    gold: new THREE.MeshStandardMaterial({
      color: THEME.gold,
      roughness: 0.35,
      metalness: 0.4,
      emissive: THEME.gold,
      emissiveIntensity: 0.15,
    }),
    white: new THREE.MeshStandardMaterial({ color: THEME.white, roughness: 0.5 }),
    neutralDark: new THREE.MeshStandardMaterial({ color: 0x0e1b29, roughness: 0.7 }),
  };

  return cachedMaterials;
}

export function createReceptionDesk(): PropResult {
  const m = getMaterials();
  const group = new THREE.Group();

  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 0.65), m.woodDesk);
  counter.position.y = 0.5;
  counter.castShadow = true;
  group.add(counter);

  const top = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.7), m.deskAccent);
  top.position.y = 1.03;
  group.add(top);

  const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.18, 5), m.gold);
  emblem.position.set(0, 0.6, 0.34);
  group.add(emblem);

  return { group };
}

export function createOfficeDesk(): PropResult {
  const m = getMaterials();
  const group = new THREE.Group();

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.6), m.woodDesk);
  top.position.y = 0.74;
  top.castShadow = true;
  group.add(top);

  for (const side of [-1, 1] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.74, 0.06), m.chairFrame);
    leg.position.set(side * 0.55, 0.37, 0.25);
    group.add(leg);
    const legBack = leg.clone();
    legBack.position.z = -0.25;
    group.add(legBack);
  }

  return { group };
}

export function createOfficeChair(): PropResult {
  const m = getMaterials();
  const group = new THREE.Group();

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.46), m.chairSeat);
  seat.position.y = 0.46;
  group.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.06), m.chairSeat);
  back.position.set(0, 0.72, -0.2);
  group.add(back);

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 6), m.chairFrame);
  post.position.y = 0.24;
  group.add(post);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 8), m.chairFrame);
  base.position.y = 0.02;
  group.add(base);

  return { group };
}

/** Returns its own screen material so AmbientAnimationSystem can flicker it independently. */
export function createComputerMonitor(): PropResult {
  const m = getMaterials();
  const group = new THREE.Group();

  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.05), m.monitorBody);
  stand.position.y = 0.07;
  group.add(stand);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.03), m.monitorBody);
  body.position.y = 0.28;
  group.add(body);

  const screenMaterial = new THREE.MeshStandardMaterial({
    color: THEME.brightBlue,
    emissive: THEME.brightBlue,
    emissiveIntensity: 0.3,
    roughness: 0.3,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.22), screenMaterial);
  screen.position.set(0, 0.28, 0.016);
  group.add(screen);

  return {
    group,
    ambient: [{ kind: 'monitorFlicker', material: screenMaterial, baseEmissiveIntensity: 0.3 }],
  };
}

export function createIndoorPlant(): PropResult {
  const m = getMaterials();
  const group = new THREE.Group();

  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.32, 8), m.potBody);
  pot.position.y = 0.16;
  group.add(pot);

  const foliageGroup = new THREE.Group();
  foliageGroup.position.y = 0.32;
  const leafSizes = [0.36, 0.28, 0.22];
  leafSizes.forEach((size, index) => {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(size * 0.55, size, 6), m.foliage);
    leaf.position.y = index * 0.22 + size * 0.4;
    foliageGroup.add(leaf);
  });
  group.add(foliageGroup);

  return { group, ambient: [{ kind: 'plantSway', object: foliageGroup }] };
}

export function createFilingCabinet(): PropResult {
  const m = getMaterials();
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.1, 0.5), m.cabinetBody);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  for (let i = 1; i < 3; i++) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.59, 0.02, 0.51), m.cabinetTrim);
    seam.position.y = (1.1 / 3) * i;
    group.add(seam);
  }

  return { group };
}

export function createMeetingTable(): PropResult {
  const m = getMaterials();
  const group = new THREE.Group();

  const top = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 1.0), m.counterTop);
  top.position.y = 0.72;
  top.castShadow = true;
  group.add(top);

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), m.chairFrame);
  base.position.y = 0.35;
  group.add(base);

  return { group };
}

/** Returns its own indicator-light material so AmbientAnimationSystem can pulse it. */
export function createCoffeeMachine(): PropResult {
  const m = getMaterials();
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.5, 0.32), m.serverBody);
  body.position.y = 0.25;
  body.castShadow = true;
  group.add(body);

  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.2), m.counterTop);
  tray.position.y = 0.05;
  group.add(tray);

  const indicatorMaterial = new THREE.MeshStandardMaterial({
    color: THEME.gold,
    emissive: THEME.gold,
    emissiveIntensity: 0.5,
  });
  const indicator = new THREE.Mesh(new THREE.CircleGeometry(0.02, 8), indicatorMaterial);
  indicator.position.set(0, 0.4, 0.17);
  group.add(indicator);

  return {
    group,
    ambient: [{ kind: 'signboardPulse', material: indicatorMaterial, baseEmissiveIntensity: 0.5 }],
  };
}

export function createPantryCounter(): PropResult {
  const m = getMaterials();
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 0.55), m.counterBody);
  body.position.y = 0.425;
  body.castShadow = true;
  group.add(body);

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.05, 0.6), m.counterTop);
  top.position.y = 0.875;
  group.add(top);

  return { group };
}

/** Returns its indicator-light strip material so AmbientAnimationSystem can blink it. */
export function createServerRack(): PropResult {
  const m = getMaterials();
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.85, 0.55), m.serverBody);
  body.position.y = 0.925;
  body.castShadow = true;
  group.add(body);

  for (let i = 0; i < 4; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.02), m.cabinetTrim);
    slot.position.set(0, 0.4 + i * 0.32, 0.27);
    group.add(slot);
  }

  const lightMaterial = new THREE.MeshStandardMaterial({
    color: THEME.brightBlue,
    emissive: THEME.brightBlue,
    emissiveIntensity: 0.6,
  });
  const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.9, 0.03), lightMaterial);
  lightStrip.position.set(0.24, 1.0, 0.27);
  group.add(lightStrip);

  return {
    group,
    ambient: [{ kind: 'serverBlink', material: lightMaterial, baseEmissiveIntensity: 0.6 }],
  };
}

/** Returns its own panel material so AmbientAnimationSystem can pulse it (also reused, styled
 *  differently, as the Meeting Room's presentation screen). */
export function createDigitalSignboard(): PropResult {
  const m = getMaterials();
  const group = new THREE.Group();

  const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.06), m.chairFrame);
  post.position.y = 0.75;
  group.add(post);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.54, 0.05), m.neutralDark);
  frame.position.y = 1.55;
  group.add(frame);

  const panelMaterial = new THREE.MeshStandardMaterial({
    color: THEME.integrityBlue,
    emissive: THEME.brightBlue,
    emissiveIntensity: 0.35,
    roughness: 0.3,
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.46), panelMaterial);
  panel.position.set(0, 1.55, 0.028);
  group.add(panel);

  return {
    group,
    ambient: [{ kind: 'signboardPulse', material: panelMaterial, baseEmissiveIntensity: 0.35 }],
  };
}

export function createWallPanel(): PropResult {
  const m = getMaterials();
  const group = new THREE.Group();

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.7, 0.05), m.panelFrame);
  frame.position.y = 1.0;
  group.add(frame);

  const inset = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.06), m.glassPanel);
  inset.position.set(0, 1.0, 0.01);
  group.add(inset);

  return { group };
}
