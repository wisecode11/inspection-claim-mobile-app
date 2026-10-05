import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import type { MiniSceneBuilder } from '@/components/mini-scene-3d';
import {
  BRAND_ORANGE,
  BRAND_ORANGE_SIDE,
  brandShape,
  CHECK_PX,
  extrudeCentered,
  HOUSE_PX,
} from '@/lib/brand-mark';
import { easeInOutCubic, GLOW } from '@/lib/three-gl';

// Stat-card icons for the Home hero. World units: each icon fits ~1.6 across
// (MiniScene3D's camera shows ~2.4).

const TEAL = '#133A42';
const TEAL_SOFT = '#5E9EAA';
const METAL = '#A9BEC4';

function standard(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...extra });
}

function rounded(w: number, h: number, d: number, r: number, material: THREE.Material) {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), material);
}

const FLIP_EVERY_S = 3.5;

/** TODAY — desk calendar whose front page tears off and flies away every few seconds. */
export const buildCalendarIcon: MiniSceneBuilder = (scene) => {
  const root = new THREE.Group();
  scene.add(root);

  root.add(rounded(1.4, 1.36, 0.22, 0.16, standard(TEAL)));
  const header = rounded(1.42, 0.4, 0.26, 0.14, standard(BRAND_ORANGE));
  header.position.set(0, 0.5, 0.02);
  root.add(header);
  for (const x of [-0.36, 0.36]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.032, 10, 24), standard(METAL, { metalness: 0.6, roughness: 0.3 }));
    ring.position.set(x, 0.72, 0.04);
    root.add(ring);
  }

  // A page: white sheet with a 3×4 grid of day dots, one orange (today).
  const makePage = (sheetMat: THREE.Material, dotMat: THREE.Material, todayMat: THREE.Material) => {
    const page = new THREE.Group();
    const sheet = rounded(1.14, 0.86, 0.03, 0.05, sheetMat);
    sheet.position.y = -0.43;
    page.add(sheet);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const today = row === 1 && col === 2;
        const dot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.13, 0.02), today ? todayMat : dotMat);
        dot.position.set(-0.36 + col * 0.24, -0.2 - row * 0.22, 0.025);
        page.add(dot);
      }
    }
    return page;
  };

  // The page underneath stays put, so a torn-off page always reveals an identical one.
  const under = makePage(standard('#FFFFFF', { roughness: 0.7 }), standard(TEAL_SOFT), standard(BRAND_ORANGE));
  under.position.set(0, 0.3, 0.12);
  root.add(under);

  const fade = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
    standard(color, { transparent: true, ...extra });
  const pageMats = [
    fade('#FFFFFF', { roughness: 0.7 }),
    fade(TEAL_SOFT),
    fade(BRAND_ORANGE, { emissive: BRAND_ORANGE, emissiveIntensity: 0.4 }),
  ];
  const front = makePage(pageMats[0], pageMats[1], pageMats[2]);
  root.add(front);

  return (time) => {
    root.rotation.y = Math.sin(time * 0.8) * 0.35;
    root.position.y = Math.sin(time * 1.6) * 0.04;

    // Hold, then tear the page up and away while it fades; fade the next one in.
    const phase = (time % FLIP_EVERY_S) / FLIP_EVERY_S;
    const tear = phase < 0.72 ? 0 : (phase - 0.72) / 0.28;
    const appear = phase < 0.1 ? phase / 0.1 : 1;
    front.position.set(0, 0.3 + tear * 0.5, 0.15 + tear * 0.3);
    front.rotation.x = -easeInOutCubic(tear) * 1.4;
    const opacity = tear > 0 ? 1 - tear : appear;
    pageMats.forEach((material) => {
      material.opacity = opacity;
    });
  };
};

/** IN PROGRESS — a progress arc sweeping around the brand house (sits on the teal card). */
export const buildProgressIcon: MiniSceneBuilder = (scene) => {
  const root = new THREE.Group();
  scene.add(root);

  const track = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.07, 12, 64),
    new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.16 }),
  );
  root.add(track);

  const spinner = new THREE.Group();
  root.add(spinner);
  const arcLength = Math.PI * 1.35;
  spinner.add(new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.085, 12, 64, arcLength), standard('#FFFFFF', { emissive: '#FFFFFF', emissiveIntensity: 0.25 })));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), standard(GLOW, { emissive: GLOW, emissiveIntensity: 1 }));
  head.position.set(Math.cos(arcLength) * 0.7, Math.sin(arcLength) * 0.7, 0);
  spinner.add(head);

  const house = new THREE.Mesh(
    extrudeCentered(brandShape(HOUSE_PX, 0.0026, true), 0.16, 0.03),
    [standard('#FFFFFF'), standard(TEAL_SOFT)],
  );
  root.add(house);

  return (time) => {
    spinner.rotation.z = -time * 2.4; // clockwise
    root.rotation.x = Math.sin(time * 0.9) * 0.35;
    root.rotation.y = Math.sin(time * 0.6) * 0.3;
    house.rotation.y = Math.sin(time * 1.2) * 0.4;
    const pulse = 1 + Math.sin(time * 4) * 0.12;
    head.scale.setScalar(pulse);
  };
};

const SPIN_EVERY_S = 4;
const SPIN_S = 0.9;

/** COMPLETED — a coin-like badge with the brand's orange check that flips over periodically. */
export function buildCheckBadgeIcon(muted: boolean): MiniSceneBuilder {
  return (scene) => {
    const root = new THREE.Group();
    scene.add(root);

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.2, 48), standard(muted ? '#C5CDD3' : TEAL));
    disc.rotation.x = Math.PI / 2;
    root.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.055, 10, 48), standard(muted ? '#D8E0E4' : TEAL_SOFT));
    root.add(rim);

    // The check on both faces so the flip never shows a blank side.
    // The check spans 116 × 92 icon px; 0.0068 makes it ~0.8 wide inside the 1.44 disc.
    const checkGeo = extrudeCentered(brandShape(CHECK_PX, 0.0068, true), 0.12, 0.02);
    const checkMats = muted
      ? [standard('#EEF2F4'), standard('#D8E0E4')]
      : [standard(BRAND_ORANGE, { emissive: BRAND_ORANGE, emissiveIntensity: 0.2 }), standard(BRAND_ORANGE_SIDE)];
    for (const side of [1, -1]) {
      const check = new THREE.Mesh(checkGeo, checkMats);
      check.position.z = side * 0.14;
      check.rotation.y = side > 0 ? 0 : Math.PI;
      root.add(check);
    }

    return (time) => {
      root.position.y = Math.sin(time * 1.5) * 0.04;
      const cycle = time % SPIN_EVERY_S;
      const sway = Math.sin(time * 0.8) * 0.3;
      // An empty (muted) badge only sways; a real one flips over every few seconds.
      root.rotation.y = !muted && cycle < SPIN_S ? easeInOutCubic(cycle / SPIN_S) * Math.PI * 2 + sway : sway;
    };
  };
}
