import * as THREE from 'three';

const DEFAULT_MAX_PIXEL_RATIO = 2;

/**
 * Owns the single WebGL canvas and renderer instance for the app's lifetime.
 * Never recreate this on restart - only the scene contents reset.
 */
export class Renderer {
  readonly domElement: HTMLCanvasElement;
  private readonly webgl: THREE.WebGLRenderer;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement, maxPixelRatio = DEFAULT_MAX_PIXEL_RATIO, shadowsEnabled = true) {
    this.container = container;

    this.webgl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
    this.webgl.shadowMap.enabled = shadowsEnabled;
    this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.05;

    this.domElement = this.webgl.domElement;
    this.container.appendChild(this.domElement);

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.webgl.setSize(width, height, true);
  };

  get aspect(): number {
    return this.container.clientWidth / Math.max(this.container.clientHeight, 1);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    camera.aspect = this.aspect;
    camera.updateProjectionMatrix();
    this.webgl.render(scene, camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.webgl.dispose();
    this.domElement.remove();
  }
}
