import type { ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';

/** Brand glow used for beams, check marks and highlights across the 3D scenes. */
export const GLOW = '#BFF3FF';

/** Stub canvas: three.js only needs a few properties when handed an existing GL context. */
function fakeCanvas(gl: ExpoWebGLRenderingContext) {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  return {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
  } as unknown as HTMLCanvasElement;
}

/** A three.js renderer drawing into an expo-gl context, cleared to `clearColor`. */
export function createGLRenderer(gl: ExpoWebGLRenderingContext, clearColor: THREE.ColorRepresentation) {
  const renderer = new THREE.WebGLRenderer({
    canvas: fakeCanvas(gl),
    context: gl as unknown as WebGL2RenderingContext,
    antialias: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
  renderer.setClearColor(clearColor, 1);
  return renderer;
}

/**
 * Perspective camera where the z = 0 plane maps 1:1 to layout points,
 * so 3D content can be positioned against React Native layout.
 * `center` is the world point shown in the middle of the view.
 */
export function createPointsCamera(width: number, height: number, fov: number, center = new THREE.Vector2()) {
  const camera = new THREE.PerspectiveCamera(fov, width / height, 1, 4000);
  const distance = height / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  camera.position.set(center.x, center.y, distance);
  camera.lookAt(center.x, center.y, 0);
  return camera;
}

export function easeOutBack(t: number, overshoot = 1.70158) {
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
}

export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** Progress (0..1) of a step that starts at `startMs` and lasts `durationMs`. */
export function stepProgress(elapsedMs: number, startMs: number, durationMs: number) {
  return elapsedMs < 0 ? 0 : clamp01((elapsedMs - startMs) / durationMs);
}

/** Disposes every geometry and material reachable from `root`. */
export function disposeTree(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => materials.add(m));
    }
  });
  materials.forEach((material) => {
    (material as THREE.MeshBasicMaterial).map?.dispose();
    material.dispose();
  });
}
