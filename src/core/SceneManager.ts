import * as THREE from 'three';
import { THEME } from '../config/theme';
import { CAMERA_FOV_BASE, SEGMENT_LENGTH, SEGMENT_COUNT } from '../config/gameConfig';

/**
 * Builds the shared scene graph: camera, fog, and a lightweight two-light setup
 * (hemisphere fill + a single shadow-casting directional key light).
 */
export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly directionalLight: THREE.DirectionalLight;

  constructor(aspect: number) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(THEME.darkNavy);

    const fogFar = SEGMENT_LENGTH * SEGMENT_COUNT * 0.55;
    this.scene.fog = new THREE.Fog(THEME.darkNavy, fogFar * 0.35, fogFar);

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV_BASE, aspect, 0.1, fogFar + 20);

    const hemisphere = new THREE.HemisphereLight(0x9fc9ff, THEME.darkNavy, 0.65);
    this.scene.add(hemisphere);

    this.directionalLight = new THREE.DirectionalLight(0xfff2d8, 1.15);
    this.directionalLight.position.set(-6, 12, 8);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.set(1024, 1024);
    this.directionalLight.shadow.camera.near = 1;
    this.directionalLight.shadow.camera.far = 40;
    this.directionalLight.shadow.camera.left = -12;
    this.directionalLight.shadow.camera.right = 12;
    this.directionalLight.shadow.camera.top = 12;
    this.directionalLight.shadow.camera.bottom = -12;
    this.directionalLight.shadow.bias = -0.0025;
    this.scene.add(this.directionalLight);
    this.scene.add(this.directionalLight.target);
  }

  /** Keeps the shadow-casting light anchored above the player as the world scrolls. */
  followTarget(x: number, z: number): void {
    this.directionalLight.position.set(x - 6, 12, z + 8);
    this.directionalLight.target.position.set(x, 0, z);
  }
}
