import { type ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import { Brand } from '@/constants/theme';
import { clamp01, createGLRenderer, easeOutBack, GLOW } from '@/lib/three-gl';

// Same colourful palette as the Profile hero tools (profile-tools-3d.tsx); cyan glow for the beam.
const BG = Brand.accent;
const WHITE = '#F5F8FA';
const PAPER = '#FFFFFF';
const DETAIL = '#26343B';
const METAL = '#B8C6CD';
const GOLD = '#F5B533';
const GOLD_DARK = '#FF8A3D';
const WOOD = '#C98A4B';
const RED = '#F05252';
const YELLOW = '#FFD84D';
const GREEN = '#34D399';
const PURPLE = '#A78BFA';
const BLUE = '#4F8DF7';

// Timeline mirrors the 2D ToolOrbit intro: clipboard pops, tools slide out one by one, then orbit.
const INTRO_CLIPBOARD_MS = 520;
const INTRO_TOOLS_AT_MS = 420;
const INTRO_TOOL_STAGGER_MS = 120;
const INTRO_TOOL_MS = 650;
const TOOL_COUNT = 5;
const INTRO_DONE_MS =
  INTRO_TOOLS_AT_MS + (TOOL_COUNT - 1) * INTRO_TOOL_STAGGER_MS + INTRO_TOOL_MS;
const BEAM_FADE_MS = 500;

const ORBIT_SECONDS = 24; // one lap of the tools
const BEAM_SECONDS = 3.6; // one lap of the beam, same as 2D
const RING_RADIUS = 1.12;
const RING_TILT = 0.5; // radians the ring leans back, turning the circle into a 3D ellipse
const TRAIL_COUNT = 9;

type Materials = Record<
  | 'white'
  | 'paper'
  | 'detail'
  | 'metal'
  | 'gold'
  | 'goldDark'
  | 'wood'
  | 'red'
  | 'yellow'
  | 'green'
  | 'purple'
  | 'blue'
  | 'glow',
  THREE.Material
>;

function box(w: number, h: number, d: number, material: THREE.Material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

function rounded(w: number, h: number, d: number, radius: number, material: THREE.Material) {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material);
}

function createMaterials(): Materials {
  const standard = (color: string, roughness: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  return {
    white: standard(WHITE, 0.45),
    paper: standard(PAPER, 0.7),
    detail: standard(DETAIL, 0.6),
    metal: standard(METAL, 0.3, { metalness: 0.55 }),
    gold: standard(GOLD, 0.4),
    goldDark: standard(GOLD_DARK, 0.42),
    wood: standard(WOOD, 0.42),
    red: standard(RED, 0.42),
    yellow: standard(YELLOW, 0.42),
    green: standard(GREEN, 0.42),
    purple: standard(PURPLE, 0.42),
    blue: standard(BLUE, 0.42),
    glow: standard(GLOW, 0.3, { emissive: GLOW, emissiveIntensity: 0.85 }),
  };
}

/** Centre piece — mirrors lucide's ClipboardCheck. */
function buildClipboard(m: Materials) {
  const g = new THREE.Group();
  g.add(rounded(0.78, 1.0, 0.07, 0.06, m.wood));

  const paper = rounded(0.62, 0.8, 0.02, 0.02, m.paper);
  paper.position.set(0, -0.05, 0.045);
  g.add(paper);

  const clip = rounded(0.34, 0.13, 0.08, 0.035, m.metal);
  clip.position.set(0, 0.5, 0.05);
  g.add(clip);
  const clipRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 20), m.metal);
  clipRing.position.set(0, 0.58, 0.05);
  g.add(clipRing);

  // Check mark: short leg up-left and long leg up-right from a shared vertex.
  const vertex = new THREE.Vector2(-0.06, -0.15);
  const legs: [number, number][] = [
    [0.2, (135 * Math.PI) / 180],
    [0.42, (50 * Math.PI) / 180],
  ];
  for (const [length, angle] of legs) {
    const leg = rounded(length, 0.065, 0.035, 0.03, m.green);
    leg.position.set(
      vertex.x + (Math.cos(angle) * length) / 2,
      vertex.y + (Math.sin(angle) * length) / 2,
      0.07,
    );
    leg.rotation.z = angle;
    g.add(leg);
  }

  g.scale.setScalar(0.82);
  return g;
}

function buildRuler(m: Materials) {
  const g = new THREE.Group();
  g.add(rounded(1.0, 0.22, 0.05, 0.03, m.yellow));
  for (let i = 0; i < 9; i += 1) {
    const height = i % 2 === 0 ? 0.1 : 0.06;
    const tick = box(0.02, height, 0.012, m.detail);
    tick.position.set(-0.4 + i * 0.1, 0.11 - height / 2, 0.03);
    g.add(tick);
  }
  g.rotation.z = Math.PI / 4;
  g.scale.setScalar(0.55);
  return g;
}

function buildStopwatch(m: Materials) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 40), m.white);
  body.rotation.x = Math.PI / 2;
  g.add(body);

  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 10, 40), m.purple);
  bezel.position.z = 0.03;
  g.add(bezel);

  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.01, 40), m.paper);
  face.rotation.x = Math.PI / 2;
  face.position.z = 0.055;
  g.add(face);

  const minute = box(0.025, 0.15, 0.012, m.detail);
  minute.geometry.translate(0, 0.075, 0);
  minute.position.z = 0.065;
  minute.rotation.z = -0.5;
  g.add(minute);

  const second = box(0.015, 0.18, 0.012, m.red);
  second.geometry.translate(0, 0.09, 0);
  second.position.z = 0.07;
  second.rotation.z = 1.9;
  g.add(second);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 16), m.metal);
  crown.position.y = 0.33;
  g.add(crown);
  const button = rounded(0.07, 0.05, 0.06, 0.015, m.metal);
  button.position.set(0.21, 0.24, 0);
  button.rotation.z = -Math.PI / 4;
  g.add(button);

  g.scale.setScalar(0.85);
  return g;
}

function buildHardHat(m: Materials) {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    m.gold,
  );
  g.add(dome);

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.035, 40), m.goldDark);
  brim.scale.z = 1.12;
  brim.position.z = 0.04;
  g.add(brim);

  const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 24, Math.PI), m.goldDark);
  ridge.rotation.y = Math.PI / 2;
  g.add(ridge);

  g.position.y = -0.08;
  const wrap = new THREE.Group();
  wrap.add(g);
  wrap.rotation.x = 0.35; // tip forward so the dome reads from the front camera
  wrap.scale.setScalar(0.9);
  return wrap;
}

function buildHammer(m: Materials) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 0.72, 16), m.wood);
  g.add(handle);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 16), m.red);
  grip.position.y = -0.22;
  g.add(grip);

  const head = rounded(0.4, 0.12, 0.12, 0.025, m.metal);
  head.position.y = 0.36;
  g.add(head);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 20), m.metal);
  face.rotation.z = Math.PI / 2;
  face.position.set(-0.22, 0.36, 0);
  g.add(face);
  for (const z of [-0.03, 0.03]) {
    const claw = box(0.16, 0.035, 0.035, m.metal);
    claw.position.set(0.25, 0.32, z);
    claw.rotation.z = -0.5;
    g.add(claw);
  }

  g.rotation.z = -Math.PI / 5;
  g.scale.setScalar(0.62);
  return g;
}

/** Same camera as the Profile hero: blue body, dark lens with a glowing glass, red shutter. */
function buildCamera(m: Materials) {
  const g = new THREE.Group();
  g.add(rounded(0.9, 0.6, 0.3, 0.1, m.blue));
  const hump = rounded(0.3, 0.14, 0.24, 0.05, m.blue);
  hump.position.set(-0.15, 0.34, 0);
  g.add(hump);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.16, 28), m.detail);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.2;
  g.add(lens);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 28), m.glow);
  glass.rotation.x = Math.PI / 2;
  glass.position.z = 0.28;
  g.add(glass);
  const shutter = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 20), m.red);
  shutter.position.set(0.28, 0.32, 0);
  g.add(shutter);
  g.scale.setScalar(0.5);
  return g;
}

/**
 * Login hero in 3D: the inspection clipboard with ruler, stopwatch, hard hat, camera and hammer
 * orbiting on a tilted ring and a glowing beam — the 2D ToolOrbit, rendered with three.js.
 *
 * `start` holds the intro until the splash is gone; `animate` false (reduce motion) shows
 * the settled pose. `onError` lets the caller fall back to the 2D orbit.
 */
export function HeroTools3D({
  start,
  animate,
  size = 140,
  onError,
}: {
  start: boolean;
  animate: boolean;
  size?: number;
  onError?: () => void;
}) {
  const startRef = useRef(start);
  const animateRef = useRef(animate);
  startRef.current = start;
  animateRef.current = animate;
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;

      // Clear to the hero colour so the view blends in on every platform.
      const renderer = createGLRenderer(gl, BG);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
      camera.position.set(0, 0, 4.4);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.HemisphereLight('#FFFFFF', BG, 1.4));
      const key = new THREE.DirectionalLight('#FFFFFF', 2.4);
      key.position.set(2, 3, 4);
      scene.add(key);
      // Cyan rim from behind ties the models to the beam colour.
      const rim = new THREE.DirectionalLight(GLOW, 1.6);
      rim.position.set(-3, 1.5, -3);
      scene.add(rim);

      const m = createMaterials();

      const clipboard = buildClipboard(m);
      scene.add(clipboard);

      // Evenly spaced clockwise from the top: ruler, stopwatch, hard hat, camera, hammer.
      const tools = [buildRuler(m), buildStopwatch(m), buildHardHat(m), buildCamera(m), buildHammer(m)].map(
        (object, index) => {
          scene.add(object);
          return { object, baseAngle: Math.PI / 2 - index * ((Math.PI * 2) / TOOL_COUNT), baseScale: object.scale.x };
        },
      );

      // Ring + beam live in a tilted group; tools are placed using its transform but stay upright.
      const orbit = new THREE.Group();
      orbit.rotation.x = RING_TILT;
      scene.add(orbit);
      orbit.updateMatrixWorld();

      const ringMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0 });
      orbit.add(new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, 0.008, 8, 140), ringMat));

      const beadGeo = new THREE.SphereGeometry(1, 16, 12);
      const trail = Array.from({ length: TRAIL_COUNT }, (_, i) => {
        const t = 1 - i / TRAIL_COUNT;
        const mat = new THREE.MeshBasicMaterial({ color: i === 0 ? '#FFFFFF' : GLOW, transparent: true, opacity: 0 });
        const mesh = new THREE.Mesh(beadGeo, mat);
        mesh.scale.setScalar(i === 0 ? 0.045 : 0.035 * t + 0.008);
        orbit.add(mesh);
        return { mesh, mat, maxOpacity: i === 0 ? 1 : 0.6 * t * t };
      });
      const haloMat = new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0 });
      const halo = new THREE.Mesh(beadGeo, haloMat);
      halo.scale.setScalar(0.13);
      orbit.add(halo);
      const beamLight = new THREE.PointLight(GLOW, 0, 2.5, 2);
      orbit.add(beamLight);

      const slot = new THREE.Vector3();
      const hiddenSpot = new THREE.Vector3(0, 0, -0.35); // behind the clipboard

      let raf = 0;
      let last = performance.now();
      let introStart: number | null = null;
      let elapsed = 0; // seconds of motion since the orbit began
      let renderedStill = false;

      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;

        const moving = animateRef.current;
        if (startRef.current && introStart === null) introStart = now;
        // Reduce motion jumps straight to the settled pose.
        const sinceStart =
          introStart === null ? -1 : moving ? now - introStart : INTRO_DONE_MS + BEAM_FADE_MS;

        if (!moving && sinceStart >= 0 && renderedStill) return;

        const orbiting = sinceStart >= INTRO_DONE_MS;
        if (moving && orbiting) elapsed += dt;

        // Clipboard pop-in, then a gentle idle sway that shows off its depth.
        const pop = sinceStart < 0 ? 0 : clamp01(sinceStart / INTRO_CLIPBOARD_MS);
        clipboard.scale.setScalar(0.82 * Math.max(0.0001, pop === 0 ? 0 : 0.3 + 0.7 * easeOutBack(pop, 1.8)));
        clipboard.rotation.y = Math.sin(elapsed * 0.7) * 0.35;
        clipboard.rotation.x = Math.sin(elapsed * 0.5) * 0.08;
        clipboard.position.y = Math.sin(elapsed * 1.2) * 0.03;

        const lap = -(elapsed / ORBIT_SECONDS) * Math.PI * 2; // clockwise like the 2D orbit
        tools.forEach(({ object, baseAngle, baseScale }, index) => {
          const toolAt = sinceStart - (INTRO_TOOLS_AT_MS + index * INTRO_TOOL_STAGGER_MS);
          const spread = sinceStart < 0 ? 0 : clamp01(toolAt / INTRO_TOOL_MS);
          const eased = spread === 0 ? 0 : easeOutBack(spread, 1.5);

          const angle = baseAngle + lap;
          slot.set(Math.cos(angle) * RING_RADIUS, Math.sin(angle) * RING_RADIUS, 0);
          orbit.localToWorld(slot);
          object.position.lerpVectors(hiddenSpot, slot, eased);
          object.scale.setScalar(baseScale * Math.max(0.0001, spread === 0 ? 0 : 0.5 + 0.5 * eased));
          // Each tool turns a little on its own axis so its 3D form reads.
          object.rotation.y = Math.sin(elapsed * 0.9 + index * 1.7) * 0.6;
        });

        const beamIn = clamp01((sinceStart - INTRO_DONE_MS) / BEAM_FADE_MS);
        const beamAngle = Math.PI / 2 - (elapsed / BEAM_SECONDS) * Math.PI * 2;
        trail.forEach(({ mesh, mat, maxOpacity }, i) => {
          const a = beamAngle + i * 0.1; // tail trails behind the clockwise head
          mesh.position.set(Math.cos(a) * RING_RADIUS, Math.sin(a) * RING_RADIUS, 0);
          mat.opacity = maxOpacity * beamIn;
        });
        halo.position.copy(trail[0].mesh.position);
        haloMat.opacity = 0.25 * beamIn;
        beamLight.position.copy(trail[0].mesh.position);
        beamLight.intensity = 2 * beamIn;
        ringMat.opacity = 0.18 * clamp01(pop * 1.5);

        renderer.render(scene, camera);
        gl.endFrameEXP();
        if (!moving && sinceStart >= 0) renderedStill = true;
      };
      raf = requestAnimationFrame(frame);

      cleanupRef.current = () => {
        cancelAnimationFrame(raf);
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) object.geometry.dispose();
        });
        Object.values(m).forEach((material) => material.dispose());
        [ringMat, haloMat, ...trail.map((bead) => bead.mat)].forEach((material) => material.dispose());
        renderer.dispose();
      };
    } catch (error) {
      console.warn('[hero-3d] falling back to 2D', error);
      onError?.();
    }
  };

  return (
    <GLView
      msaaSamples={4}
      onContextCreate={onContextCreate}
      style={[styles.view, { height: size, width: size }]}
    />
  );
}

const styles = StyleSheet.create({
  view: {
    backgroundColor: BG,
  },
});
