import { type ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import { clamp01, createGLRenderer, createPointsCamera, disposeTree, easeOutBack, GLOW } from '@/lib/three-gl';

export type ProfileToolModel =
  | 'hammer'
  | 'ruler'
  | 'wrench'
  | 'hardHat'
  | 'clipboard'
  | 'camera'
  | 'compass'
  | 'thermometer'
  | 'cloudHail'
  | 'lightning'
  | 'flashlight'
  | 'search'
  | 'drill'
  | 'pencil'
  | 'wind';

export type ProfileToolPlacement = {
  model: ProfileToolModel;
  /** Centre of the tool in % of the hero's width / height. */
  x: number;
  y: number;
  /** Rough on-screen size in layout points. */
  size: number;
  /** Drift (points) and tilt (deg) reached at the end of one half-cycle. */
  dx: number;
  dy: number;
  tilt: number;
  durationMs: number;
};

const PALETTE = {
  red: '#F05252',
  orange: '#FF8A3D',
  amber: '#F5B533',
  yellow: '#FFD84D',
  green: '#34D399',
  blue: '#4F8DF7',
  sky: '#5CC8F5',
  purple: '#A78BFA',
  pink: '#F472B6',
  white: '#F5F8FA',
  metal: '#B8C6CD',
  dark: '#26343B',
  wood: '#C98A4B',
} as const;

type Materials = Record<keyof typeof PALETTE | 'glow' | 'glass', THREE.MeshStandardMaterial>;

/** Global visibility knob for the 3D tools: 1 is fully opaque. */
const TOOL_OPACITY = 0.65;

function createMaterials(): Materials {
  const entries = Object.entries(PALETTE).map(([key, color]) => [
    key,
    new THREE.MeshStandardMaterial({
      color,
      roughness: key === 'metal' ? 0.3 : 0.42,
      metalness: key === 'metal' ? 0.55 : 0.05,
      transparent: true,
      opacity: TOOL_OPACITY,
    }),
  ]);
  return {
    ...(Object.fromEntries(entries) as Record<keyof typeof PALETTE, THREE.MeshStandardMaterial>),
    glow: new THREE.MeshStandardMaterial({
      color: GLOW,
      emissive: GLOW,
      emissiveIntensity: 0.9,
      roughness: 0.3,
      transparent: true,
      opacity: TOOL_OPACITY,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: '#D9F6FF',
      transparent: true,
      opacity: 0.55 * TOOL_OPACITY,
      roughness: 0.1,
    }),
  };
}

function rounded(w: number, h: number, d: number, r: number, material: THREE.Material) {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), material);
}

function cylinder(rTop: number, rBottom: number, h: number, material: THREE.Material, segments = 20) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
}

function sphere(r: number, material: THREE.Material) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), material);
}

// Every model fits roughly a 1 × 1 box centred on the origin, facing +z.
const BUILDERS: Record<ProfileToolModel, (m: Materials) => THREE.Object3D> = {
  hammer: (m) => {
    const g = new THREE.Group();
    g.add(cylinder(0.05, 0.06, 0.85, m.wood));
    const grip = cylinder(0.075, 0.075, 0.3, m.red);
    grip.position.y = -0.28;
    g.add(grip);
    const head = rounded(0.5, 0.16, 0.16, 0.04, m.metal);
    head.position.y = 0.42;
    g.add(head);
    const face = cylinder(0.1, 0.1, 0.08, m.metal);
    face.rotation.z = Math.PI / 2;
    face.position.set(-0.28, 0.42, 0);
    g.add(face);
    g.rotation.z = -0.6;
    return g;
  },
  ruler: (m) => {
    const g = new THREE.Group();
    g.add(rounded(1.1, 0.26, 0.07, 0.04, m.yellow));
    for (let i = 0; i < 10; i++) {
      const h = i % 2 === 0 ? 0.12 : 0.07;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.025, h, 0.015), m.dark);
      tick.position.set(-0.45 + i * 0.1, 0.13 - h / 2, 0.04);
      g.add(tick);
    }
    g.rotation.z = Math.PI / 4;
    return g;
  },
  wrench: (m) => {
    const g = new THREE.Group();
    g.add(rounded(0.16, 0.75, 0.08, 0.06, m.blue));
    const head = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.07, 10, 24, Math.PI * 1.45), m.blue);
    head.position.y = 0.45;
    head.rotation.z = -Math.PI * 0.22;
    g.add(head);
    const end = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.05, 10, 24), m.metal);
    end.position.y = -0.42;
    g.add(end);
    g.rotation.z = 0.7;
    return g;
  },
  hardHat: (m) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.36, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), m.amber));
    const brim = cylinder(0.5, 0.5, 0.05, m.orange, 32);
    brim.scale.z = 1.1;
    g.add(brim);
    const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 24, Math.PI), m.orange);
    ridge.rotation.y = Math.PI / 2;
    g.add(ridge);
    g.position.y = -0.12;
    const wrap = new THREE.Group();
    wrap.add(g);
    wrap.rotation.x = 0.12;
    return wrap;
  },
  clipboard: (m) => {
    const g = new THREE.Group();
    g.add(rounded(0.74, 0.96, 0.07, 0.06, m.wood));
    const paper = rounded(0.6, 0.78, 0.02, 0.02, m.white);
    paper.position.set(0, -0.05, 0.045);
    g.add(paper);
    const clip = rounded(0.32, 0.12, 0.08, 0.03, m.metal);
    clip.position.set(0, 0.48, 0.05);
    g.add(clip);
    const legs: [number, number][] = [
      [0.2, (135 * Math.PI) / 180],
      [0.4, (50 * Math.PI) / 180],
    ];
    for (const [length, angle] of legs) {
      const leg = rounded(length, 0.07, 0.04, 0.03, m.green);
      leg.position.set(-0.06 + (Math.cos(angle) * length) / 2, -0.16 + (Math.sin(angle) * length) / 2, 0.07);
      leg.rotation.z = angle;
      g.add(leg);
    }
    return g;
  },
  camera: (m) => {
    const g = new THREE.Group();
    g.add(rounded(0.9, 0.6, 0.3, 0.1, m.blue));
    const hump = rounded(0.3, 0.14, 0.24, 0.05, m.blue);
    hump.position.set(-0.15, 0.34, 0);
    g.add(hump);
    const lens = cylinder(0.22, 0.24, 0.16, m.dark, 28);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.2;
    g.add(lens);
    const glass = cylinder(0.15, 0.15, 0.04, m.glow, 28);
    glass.rotation.x = Math.PI / 2;
    glass.position.z = 0.28;
    g.add(glass);
    const shutter = cylinder(0.06, 0.06, 0.06, m.red);
    shutter.position.set(0.28, 0.32, 0);
    g.add(shutter);
    return g;
  },
  compass: (m) => {
    const g = new THREE.Group();
    const body = cylinder(0.45, 0.45, 0.1, m.white, 36);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 10, 36), m.purple);
    g.add(rim);
    const north = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.34, 4), m.red);
    north.position.set(0, 0.17, 0.07);
    g.add(north);
    const south = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.34, 4), m.dark);
    south.rotation.z = Math.PI;
    south.position.set(0, -0.17, 0.07);
    g.add(south);
    const pin = sphere(0.05, m.metal);
    pin.position.z = 0.08;
    g.add(pin);
    g.rotation.z = 0.5;
    return g;
  },
  thermometer: (m) => {
    const g = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.62, 6, 16), m.white);
    tube.position.y = 0.1;
    g.add(tube);
    const bulb = sphere(0.19, m.red);
    bulb.position.y = -0.38;
    g.add(bulb);
    const mercury = cylinder(0.05, 0.05, 0.45, m.red);
    mercury.position.set(0, -0.08, 0.06);
    g.add(mercury);
    g.rotation.z = -0.35;
    return g;
  },
  cloudHail: (m) => {
    const g = new THREE.Group();
    const puffs: [number, number, number][] = [
      [-0.26, 0.1, 0.22],
      [0.02, 0.22, 0.3],
      [0.3, 0.08, 0.22],
      [0.02, 0.02, 0.26],
    ];
    for (const [x, y, r] of puffs) {
      const puff = sphere(r, m.white);
      puff.position.set(x, y, 0);
      g.add(puff);
    }
    for (const [x, y] of [
      [-0.22, -0.3],
      [0.04, -0.4],
      [0.28, -0.28],
    ]) {
      const stone = sphere(0.08, m.sky);
      stone.position.set(x, y, 0.05);
      g.add(stone);
    }
    return g;
  },
  lightning: (m) => {
    const shape = new THREE.Shape();
    const pts: [number, number][] = [
      [0.08, 0.5],
      [-0.28, -0.02],
      [-0.02, -0.02],
      [-0.12, -0.5],
      [0.28, 0.08],
      [0.02, 0.08],
      [0.14, 0.5],
    ];
    shape.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.03, bevelSegments: 2 });
    geo.center();
    return new THREE.Mesh(geo, m.yellow);
  },
  flashlight: (m) => {
    const g = new THREE.Group();
    const body = cylinder(0.11, 0.11, 0.6, m.dark);
    body.position.y = -0.12;
    g.add(body);
    const head = cylinder(0.2, 0.12, 0.26, m.orange);
    head.position.y = 0.3;
    g.add(head);
    const lens = cylinder(0.17, 0.17, 0.03, m.glow);
    lens.position.y = 0.44;
    g.add(lens);
    const button = rounded(0.07, 0.12, 0.06, 0.02, m.orange);
    button.position.set(0, -0.02, 0.11);
    g.add(button);
    g.rotation.z = -0.6;
    return g;
  },
  search: (m) => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 12, 32), m.purple);
    ring.position.set(-0.1, 0.12, 0);
    g.add(ring);
    const glass = cylinder(0.24, 0.24, 0.02, m.glass, 28);
    glass.rotation.x = Math.PI / 2;
    glass.position.set(-0.1, 0.12, 0);
    g.add(glass);
    const handle = rounded(0.12, 0.38, 0.1, 0.05, m.dark);
    handle.position.set(0.2, -0.24, 0);
    handle.rotation.z = Math.PI / 4;
    g.add(handle);
    return g;
  },
  drill: (m) => {
    const g = new THREE.Group();
    const body = rounded(0.62, 0.26, 0.24, 0.08, m.orange);
    body.position.y = 0.18;
    g.add(body);
    const handle = rounded(0.2, 0.46, 0.2, 0.06, m.dark);
    handle.position.set(-0.08, -0.14, 0);
    handle.rotation.z = -0.2;
    g.add(handle);
    const chuck = cylinder(0.08, 0.1, 0.14, m.metal);
    chuck.rotation.z = Math.PI / 2;
    chuck.position.set(0.38, 0.18, 0);
    g.add(chuck);
    const bit = cylinder(0.025, 0.025, 0.26, m.metal, 10);
    bit.rotation.z = Math.PI / 2;
    bit.position.set(0.56, 0.18, 0);
    g.add(bit);
    g.scale.setScalar(1.1);
    return g;
  },
  pencil: (m) => {
    const g = new THREE.Group();
    g.add(cylinder(0.09, 0.09, 0.7, m.yellow, 6));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 6), m.wood);
    tip.position.y = 0.45;
    g.add(tip);
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 6), m.dark);
    lead.position.y = 0.52;
    g.add(lead);
    const band = cylinder(0.095, 0.095, 0.06, m.metal, 12);
    band.position.y = -0.38;
    g.add(band);
    const eraser = cylinder(0.09, 0.09, 0.12, m.pink, 12);
    eraser.position.y = -0.47;
    g.add(eraser);
    g.rotation.z = -0.8;
    return g;
  },
  wind: (m) => {
    const g = new THREE.Group();
    const strands: [number, number, number][] = [
      [0.26, 0.18, 0.5],
      [0.16, -0.06, 0.36],
      [0.2, -0.28, 0.44],
    ];
    strands.forEach(([radius, y, length], i) => {
      const line = rounded(length, 0.07, 0.07, 0.035, i === 1 ? m.sky : m.white);
      line.position.set(-0.08, y, 0);
      g.add(line);
      const curl = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.4, 0.035, 8, 20, Math.PI * 1.3), i === 1 ? m.sky : m.white);
      curl.position.set(-0.08 + length / 2, y + radius * 0.4, 0);
      curl.rotation.z = -Math.PI / 2;
      g.add(curl);
    });
    return g;
  },
};

/** Model size relative to the 2D icon box, so the 3D tools read at about the same weight. */
const SIZE_SCALE = 1.35;
const INTRO_STAGGER_MS = 45;
const INTRO_MS = 600;

/**
 * Colourful 3D tools floating in the Profile hero (replaces the flat white icons).
 * Fills its parent; `width`/`height` are the parent's layout size in points.
 * Pauses while `active` is false and draws one still frame under reduce motion.
 */
export function ProfileTools3D({
  tools,
  width,
  height,
  background,
  active,
  reduceMotion,
  onError,
}: {
  tools: ProfileToolPlacement[];
  width: number;
  height: number;
  background: string;
  active: boolean;
  reduceMotion: boolean;
  onError?: () => void;
}) {
  const activeRef = useRef(active);
  const reduceMotionRef = useRef(reduceMotion);
  activeRef.current = active;
  reduceMotionRef.current = reduceMotion;
  const resumeRef = useRef<(() => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);
  useEffect(() => {
    resumeRef.current?.();
  }, [active, reduceMotion]);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      const renderer = createGLRenderer(gl, background);
      // Work in layout points: the z = 0 plane maps 1:1 to the hero's layout.
      const scene = new THREE.Scene();
      const camera = createPointsCamera(width, height, 30);

      scene.add(new THREE.HemisphereLight('#FFFFFF', '#2E6B76', 1.5));
      const key = new THREE.DirectionalLight('#FFFFFF', 2.3);
      key.position.set(width * 0.3, height, 600);
      scene.add(key);
      const rim = new THREE.DirectionalLight(GLOW, 0.9);
      rim.position.set(-width, height * 0.3, -300);
      scene.add(rim);

      const m = createMaterials();
      const items = tools.map((tool, index) => {
        const model = BUILDERS[tool.model](m);
        const holder = new THREE.Group();
        holder.add(model);
        holder.position.set(((tool.x - 50) / 100) * width, ((50 - tool.y) / 100) * height, 0);
        scene.add(holder);
        return {
          holder,
          tool,
          index,
          scale: tool.size * SIZE_SCALE,
          home: holder.position.clone(),
          phase: (index * 0.7) % 4,
        };
      });

      let raf = 0;
      let last = 0;
      let time = 0;
      let renderedStill = false;

      const draw = (seconds: number, still: boolean) => {
        const ms = still ? Number.POSITIVE_INFINITY : seconds * 1000;
        for (const { holder, tool, index, scale, home, phase } of items) {
          const pop = clamp01((ms - index * INTRO_STAGGER_MS) / INTRO_MS);
          holder.scale.setScalar(Math.max(0.0001, scale * (pop === 0 ? 0 : easeOutBack(pop, 1.6))));

          // Same ping-pong drift as the 2D icons, plus a slow turn that shows the depth.
          const half = (tool.durationMs * 0.4) / 1000;
          const t = still ? 0.5 : (Math.max(0, seconds - phase) % (half * 2)) / half;
          const p = 0.5 - 0.5 * Math.cos(Math.PI * (t > 1 ? 2 - t : t));
          holder.position.set(home.x + tool.dx * p, home.y - tool.dy * p, 0);
          holder.rotation.z = -THREE.MathUtils.degToRad(tool.tilt * p); // RN rotates clockwise
          holder.rotation.y = Math.sin(seconds * 0.8 + index * 1.3) * 0.55;
          holder.rotation.x = 0.15 + Math.sin(seconds * 0.6 + index) * 0.12;
        }
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };

      const frame = (now: number) => {
        const still = reduceMotionRef.current;
        if (still ? renderedStill : !activeRef.current) {
          raf = 0; // paused, resumeRef restarts it
          return;
        }
        raf = requestAnimationFrame(frame);
        if (last === 0) last = now;
        time += Math.min(0.05, (now - last) / 1000);
        last = now;
        draw(still ? 1.2 : time, still);
        renderedStill = still;
      };

      resumeRef.current = () => {
        if (raf !== 0) return;
        last = performance.now(); // resume without a time jump
        if (reduceMotionRef.current) renderedStill = false;
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      cleanupRef.current = () => {
        cancelAnimationFrame(raf);
        resumeRef.current = null;
        disposeTree(scene);
        renderer.dispose();
      };
    } catch (error) {
      console.warn('[profile-tools-3d] falling back to 2D', error);
      onError?.();
    }
  };

  return (
    <GLView
      msaaSamples={4}
      onContextCreate={onContextCreate}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: background }]}
    />
  );
}
