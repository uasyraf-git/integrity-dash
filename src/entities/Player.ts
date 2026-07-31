import * as THREE from 'three';
import { THEME } from '../config/theme';
import { CENTER_LANE_INDEX, LANE_POSITIONS } from '../config/gameConfig';

export interface LaneTransitionState {
  active: boolean;
  fromX: number;
  toX: number;
  elapsed: number;
}

export interface JumpState {
  active: boolean;
  elapsed: number;
  bufferedRequest: boolean;
}

export interface SlideState {
  active: boolean;
  elapsed: number;
}

export interface HitFeedbackState {
  active: boolean;
  elapsed: number;
}

/** Post-landing squash-and-recover window. Purely visual - see MovementSystem.updateSquashStretch. */
export interface LandingEffectState {
  active: boolean;
  elapsed: number;
}

/**
 * The player's visual rig and movement state. All per-frame physics/easing is
 * applied by systems/MovementSystem so this class stays focused on structure.
 */
export class Player {
  readonly group: THREE.Group;
  readonly bodyGroup: THREE.Group;
  readonly armLeftPivot: THREE.Group;
  readonly armRightPivot: THREE.Group;
  readonly legLeftPivot: THREE.Group;
  readonly legRightPivot: THREE.Group;

  laneIndex: number = CENTER_LANE_INDEX;
  currentX: number = LANE_POSITIONS[CENTER_LANE_INDEX];
  laneTransition: LaneTransitionState = { active: false, fromX: 0, toX: 0, elapsed: 0 };
  jumpState: JumpState = { active: false, elapsed: 0, bufferedRequest: false };
  slideState: SlideState = { active: false, elapsed: 0 };
  currentHeightScale = 1;
  runTime = 0;

  /** Brief tint pulse played on collision. See MovementSystem.updateHitAndInvincibilityVisual. */
  hitFeedback: HitFeedbackState = { active: false, elapsed: 0 };
  /** Whether the player is currently invincible (driven externally by IntegritySystem). */
  invincible = false;

  /** Current squash/stretch scalar (1 = neutral). See MovementSystem.updateSquashStretch. */
  squashStretch = 1;
  /** Started the instant a jump lands; drives the brief landing squash pose. */
  landingEffect: LandingEffectState = { active: false, elapsed: 0 };
  /** One-shot flag consumed by Game.tick to trigger the landing camera impulse and dust ring -
   *  kept separate from landingEffect (which drives the longer visual squash pose) so the game
   *  layer only ever reacts to the exact landing frame, not every frame the pose is playing. */
  private landingEventPending = false;

  private readonly tintMaterials: THREE.MeshStandardMaterial[];
  private readonly badgeMaterials: THREE.MeshStandardMaterial[];
  private readonly badgeBaseEmissiveIntensity: number;

  constructor() {
    this.group = new THREE.Group();
    this.group.position.x = this.currentX;

    const navyMaterial = new THREE.MeshStandardMaterial({
      color: THEME.darkNavy,
      roughness: 0.55,
      metalness: 0.1,
      emissive: 0xff3b3b,
      emissiveIntensity: 0,
    });
    const blueMaterial = new THREE.MeshStandardMaterial({
      color: THEME.integrityBlue,
      roughness: 0.45,
      metalness: 0.15,
      emissive: 0xff3b3b,
      emissiveIntensity: 0,
    });
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: THEME.gold,
      roughness: 0.35,
      metalness: 0.4,
      emissive: THEME.gold,
      emissiveIntensity: 0.15,
    });
    const visorMaterial = new THREE.MeshStandardMaterial({
      color: THEME.brightBlue,
      roughness: 0.25,
      metalness: 0.5,
    });

    this.tintMaterials = [navyMaterial, blueMaterial];
    this.badgeMaterials = [goldMaterial];
    this.badgeBaseEmissiveIntensity = goldMaterial.emissiveIntensity;

    // Legs stay grounded and are not affected by the body bob.
    const legsGroup = new THREE.Group();
    this.legLeftPivot = this.createLimbPivot(-0.16, 0.85, 0.42, 0.2, 0.16, navyMaterial);
    this.legRightPivot = this.createLimbPivot(0.16, 0.85, 0.42, 0.2, 0.16, navyMaterial);
    legsGroup.add(this.legLeftPivot, this.legRightPivot);
    this.group.add(legsGroup);

    // Torso, head, arms and accents bob slightly during the run cycle.
    this.bodyGroup = new THREE.Group();

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), blueMaterial);
    torso.position.y = 1.2;
    torso.castShadow = true;
    this.bodyGroup.add(torso);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.08, 0.36), goldMaterial);
    belt.position.y = 0.87;
    this.bodyGroup.add(belt);

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.2), navyMaterial);
    backpack.position.set(0, 1.2, 0.24);
    backpack.castShadow = true;
    this.bodyGroup.add(backpack);

    const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.11, 5), goldMaterial);
    emblem.position.set(0, 1.32, 0.345);
    this.bodyGroup.add(emblem);

    const chestBadge = new THREE.Mesh(new THREE.CircleGeometry(0.07, 5), goldMaterial);
    chestBadge.position.set(0.18, 1.4, -0.18);
    chestBadge.rotation.y = Math.PI;
    this.bodyGroup.add(chestBadge);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), navyMaterial);
    head.position.y = 1.78;
    head.castShadow = true;
    this.bodyGroup.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.06), visorMaterial);
    visor.position.set(0, 1.8, -0.21);
    this.bodyGroup.add(visor);

    this.armLeftPivot = this.createLimbPivot(-0.44, 1.5, 0.6, 0.15, 0.15, blueMaterial, 0.05);
    this.armRightPivot = this.createLimbPivot(0.44, 1.5, 0.6, 0.15, 0.15, blueMaterial, 0.05);
    this.bodyGroup.add(this.armLeftPivot, this.armRightPivot);

    this.group.add(this.bodyGroup);
  }

  private createLimbPivot(
    x: number,
    pivotY: number,
    length: number,
    width: number,
    depth: number,
    material: THREE.Material,
    goldCuffHeight = 0,
  ): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(x, pivotY, 0);

    const limb = new THREE.Mesh(new THREE.BoxGeometry(width, length, depth), material);
    limb.position.y = -length / 2;
    limb.castShadow = true;
    pivot.add(limb);

    if (goldCuffHeight > 0) {
      const cuff = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.02, goldCuffHeight, depth + 0.02),
        new THREE.MeshStandardMaterial({ color: THEME.gold, roughness: 0.35, metalness: 0.4 }),
      );
      cuff.position.y = -length + goldCuffHeight / 2;
      pivot.add(cuff);
    }

    return pivot;
  }

  /** Starts the brief hit-tint pulse. Called once per valid, non-invincible collision. */
  triggerHit(): void {
    this.hitFeedback = { active: true, elapsed: 0 };
  }

  /** Mirrors IntegritySystem's invincibility state onto the rig's shimmer visual. */
  setInvincible(invincible: boolean): void {
    this.invincible = invincible;
  }

  /** Called by MovementSystem the instant a jump lands. Starts the landing squash pose and
   *  queues a one-shot event for Game.tick to pick up (camera impulse, dust ring). */
  notifyLanded(): void {
    this.landingEffect = { active: true, elapsed: 0 };
    this.landingEventPending = true;
  }

  /** Consumes the pending landing event, if any. Returns true at most once per landing. */
  consumeLandingEvent(): boolean {
    const had = this.landingEventPending;
    this.landingEventPending = false;
    return had;
  }

  /** Applies a red tint (0 = none, 1 = full) across the shared body materials and badges. */
  setTintIntensity(intensity: number): void {
    for (const material of this.tintMaterials) {
      material.emissiveIntensity = intensity * 0.65;
    }
    for (const material of this.badgeMaterials) {
      material.emissiveIntensity = this.badgeBaseEmissiveIntensity + intensity * 0.5;
    }
  }

  /** Resets all movement state for a fresh run (used on restart). */
  reset(): void {
    this.laneIndex = CENTER_LANE_INDEX;
    this.currentX = LANE_POSITIONS[CENTER_LANE_INDEX];
    this.laneTransition = { active: false, fromX: 0, toX: 0, elapsed: 0 };
    this.jumpState = { active: false, elapsed: 0, bufferedRequest: false };
    this.slideState = { active: false, elapsed: 0 };
    this.currentHeightScale = 1;
    this.runTime = 0;
    this.hitFeedback = { active: false, elapsed: 0 };
    this.invincible = false;
    this.squashStretch = 1;
    this.landingEffect = { active: false, elapsed: 0 };
    this.landingEventPending = false;
    this.setTintIntensity(0);

    this.group.position.set(this.currentX, 0, 0);
    this.group.scale.set(1, 1, 1);
    this.group.rotation.z = 0;
    this.bodyGroup.position.y = 0;
    this.armLeftPivot.rotation.x = 0;
    this.armRightPivot.rotation.x = 0;
    this.legLeftPivot.rotation.x = 0;
    this.legRightPivot.rotation.x = 0;
  }
}
