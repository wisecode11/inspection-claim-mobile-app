import { type ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import { Brand } from '@/constants/theme';
import {
  clamp01,
  createGLRenderer,
  disposeTree,
  easeOutBack,
  easeInOutCubic,
  GLOW,
  stepProgress,
} from '@/lib/three-gl';

const BG = Brand.accent;
const WALL = '#EEF4F5';
const ROOF = '#7F9AA2';
const SHINGLE = '#68838B';
const GROUND = '#1E5059';
const DOOR = '#0E2D33';
const ORANGE = '#F47622'; // brand check orange — "damage found"

// House (world units). Ridge runs along x; the front slope faces +z toward the camera.
const WALL_W = 1.1;
const WALL_D = 0.9;
const WALL_H = 0.6;
const ROOF_PITCH = THREE.MathUtils.degToRad(32);
const ROOF_HALF_SPAN = WALL_D / 2 + 0.1; // eave overhang
const ROOF_RISE = ROOF_HALF_SPAN * Math.tan(ROOF_PITCH);
const ROOF_SLOPE_LEN = ROOF_HALF_SPAN / Math.cos(ROOF_PITCH);
const ROOF_THICK = 0.04;

// Drone flies an ellipse over the front slope.
const LAP_S = 6.5;
const PATH_RX = 0.55;
const PATH_CZ = 0.28;
const PATH_RZ = 0.21;
const DRONE_ALT = 1.3;
const SCAN_RADIUS = 0.2;
// Markers sit on the drone's path, so each is "found" as the scan passes over it.
const MARKER_ANGLES = [0.5, 1.9, 3.3, 4.8];
const FOUND_DISTANCE = 0.12;

// Framing checked by projecting the ground slab, roof, chimney and the drone's full lap
// (rotors included, across the whole camera drift): the scene fills ~95% of a 136×112
// view without clipping.
const CAMERA_POS = new THREE.Vector3(3.024, 2.464, 3.36);
const CAMERA_LOOK = new THREE.Vector3(0, 0.3, 0.08);
const CAMERA_DRIFT = new THREE.Vector2(0.28, 0.168);

const INTRO_HOUSE = { at: 0, ms: 700 };
const INTRO_DRONE = { at: 350, ms: 1000 };
const INTRO_DONE_MS = INTRO_DRONE.at + INTRO_DRONE.ms;

function rounded(w: number, h: number, d: number, r: number, material: THREE.Material) {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), material);
}

function box(w: number, h: number, d: number, material: THREE.Material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

/** Height of the front roof's top surface above a world z (0 at the ridge). */
function frontRoofY(z: number) {
  return WALL_H + ROOF_RISE * (1 - z / ROOF_HALF_SPAN) + ROOF_THICK / 2 / Math.cos(ROOF_PITCH);
}

function pathPoint(angle: number, target = new THREE.Vector3()) {
  return target.set(Math.cos(angle) * PATH_RX, 0, PATH_CZ + Math.sin(angle) * PATH_RZ);
}

function buildHouse() {
  const house = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: WALL, roughness: 0.8 });
  const roofMat = new THREE.MeshStandardMaterial({ color: ROOF, roughness: 0.75 });
  const shingleMat = new THREE.MeshStandardMaterial({ color: SHINGLE, roughness: 0.85 });
  const doorMat = new THREE.MeshStandardMaterial({ color: DOOR, roughness: 0.6 });
  const windowMat = new THREE.MeshStandardMaterial({ color: GLOW, emissive: GLOW, emissiveIntensity: 0.8 });

  const walls = box(WALL_W, WALL_H, WALL_D, wallMat);
  walls.position.y = WALL_H / 2;
  house.add(walls);

  // Gable triangles on the two short ends.
  const gableHeight = ROOF_RISE * (WALL_D / 2 / ROOF_HALF_SPAN);
  const gable = new THREE.Shape();
  gable.moveTo(-WALL_D / 2, 0);
  gable.lineTo(WALL_D / 2, 0);
  gable.lineTo(0, gableHeight);
  gable.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gable, { depth: 0.02, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const mesh = new THREE.Mesh(gableGeo, wallMat);
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(side * (WALL_W / 2) - (side > 0 ? 0.02 : 0), WALL_H, 0);
    house.add(mesh);
  }

  // Two roof slopes, each with raised shingle courses.
  for (const side of [1, -1]) {
    const panel = box(WALL_W + 0.2, ROOF_THICK, ROOF_SLOPE_LEN, roofMat);
    panel.position.set(0, WALL_H + ROOF_RISE / 2, (side * ROOF_HALF_SPAN) / 2);
    panel.rotation.x = side * ROOF_PITCH;
    for (const offset of [-0.2, 0, 0.2]) {
      const course = box(WALL_W + 0.2, 0.012, 0.03, shingleMat);
      course.position.set(0, ROOF_THICK / 2 + 0.006, offset);
      panel.add(course);
    }
    house.add(panel);
  }

  const ridge = rounded(WALL_W + 0.24, 0.05, 0.07, 0.02, shingleMat);
  ridge.position.y = WALL_H + ROOF_RISE + 0.02;
  house.add(ridge);

  const chimney = box(0.12, 0.32, 0.12, wallMat);
  chimney.position.set(0.3, WALL_H + ROOF_RISE * 0.6 + 0.08, -0.14);
  house.add(chimney);

  const door = box(0.18, 0.3, 0.02, doorMat);
  door.position.set(-0.26, 0.15, WALL_D / 2 + 0.01);
  house.add(door);
  const windowPane = box(0.22, 0.16, 0.02, windowMat);
  windowPane.position.set(0.24, 0.36, WALL_D / 2 + 0.01);
  house.add(windowPane);

  return house;
}

function buildDrone() {
  const drone = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.35, metalness: 0.2 });
  const armMat = new THREE.MeshStandardMaterial({ color: '#C9D6DA', roughness: 0.5 });
  const rotorMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.35, depthWrite: false });
  const lensMat = new THREE.MeshStandardMaterial({ color: GLOW, emissive: GLOW, emissiveIntensity: 1 });

  drone.add(rounded(0.2, 0.06, 0.2, 0.025, bodyMat));
  const rotors: THREE.Mesh[] = [];
  for (const angle of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const arm = box(0.19, 0.02, 0.025, armMat);
    arm.position.set(Math.cos(angle) * 0.1, 0, Math.sin(angle) * 0.1);
    arm.rotation.y = -angle;
    drone.add(arm);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.006, 20), rotorMat);
    rotor.position.set(Math.cos(angle) * 0.19, 0.03, Math.sin(angle) * 0.19);
    drone.add(rotor);
    rotors.push(rotor);
  }
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), lensMat);
  lens.position.y = -0.045;
  drone.add(lens);
  return { drone, rotors };
}

type Marker = { group: THREE.Group; dot: THREE.Mesh; wave: THREE.Mesh; waveMat: THREE.MeshBasicMaterial; foundAt: number | null };

function buildMarkers(scene: THREE.Scene) {
  const dotMat = new THREE.MeshStandardMaterial({ color: ORANGE, emissive: ORANGE, emissiveIntensity: 0.6 });
  const dotGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.014, 20);
  const waveGeo = new THREE.TorusGeometry(0.06, 0.008, 8, 32);
  return MARKER_ANGLES.map<Marker>((angle) => {
    const point = pathPoint(angle);
    const group = new THREE.Group();
    group.position.set(point.x, frontRoofY(point.z) + 0.004, point.z);
    group.rotation.x = ROOF_PITCH; // lie flat on the front slope
    const dot = new THREE.Mesh(dotGeo, dotMat);
    group.add(dot);
    const waveMat = new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0, depthWrite: false });
    const wave = new THREE.Mesh(waveGeo, waveMat);
    wave.rotation.x = Math.PI / 2;
    group.add(wave);
    group.visible = false;
    scene.add(group);
    return { group, dot, wave, waveMat, foundAt: null };
  });
}

/**
 * Home hero motion: a drone circles a house scanning its roof; orange hail-damage
 * markers pop up wherever the scan passes, then clear each lap.
 *
 * `active` false (screen unfocused) pauses the loop entirely; `reduceMotion` renders
 * a finished still (drone parked, all damage found).
 */
export function HeroInspection3D({
  width,
  height,
  active,
  reduceMotion,
}: {
  width: number;
  height: number;
  active: boolean;
  reduceMotion: boolean;
}) {
  const activeRef = useRef(active);
  const reduceMotionRef = useRef(reduceMotion);
  activeRef.current = active;
  reduceMotionRef.current = reduceMotion;
  const resumeRef = useRef<(() => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);
  // Restart the paused loop when the screen regains focus or motion settings change.
  useEffect(() => {
    resumeRef.current?.();
  }, [active, reduceMotion]);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      const renderer = createGLRenderer(gl, BG);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);
      camera.position.copy(CAMERA_POS);
      const lookAt = CAMERA_LOOK;
      camera.lookAt(lookAt);

      scene.add(new THREE.HemisphereLight('#FFFFFF', BG, 1.35));
      const sun = new THREE.DirectionalLight('#FFFFFF', 2.2);
      sun.position.set(2, 4, 3);
      scene.add(sun);
      const rim = new THREE.DirectionalLight(GLOW, 1.0);
      rim.position.set(-3, 1.5, -2);
      scene.add(rim);

      const ground = rounded(2.1, 0.08, 1.8, 0.04, new THREE.MeshStandardMaterial({ color: GROUND, roughness: 1 }));
      ground.position.y = -0.04;
      scene.add(ground);
      const shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false });
      const houseShadow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), shadowMat);
      houseShadow.rotation.x = -Math.PI / 2;
      houseShadow.scale.set(1, 0.85, 1);
      houseShadow.position.set(0.05, 0.002, 0.05);
      scene.add(houseShadow);

      const house = buildHouse();
      scene.add(house);
      const markers = buildMarkers(scene);

      const { drone, rotors } = buildDrone();
      scene.add(drone);
      const droneShadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false });
      const droneShadow = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), droneShadowMat);
      droneShadow.rotation.x = -Math.PI / 2;
      scene.add(droneShadow);

      // Scan cone from the drone's lens down onto the roof.
      const coneHeight = DRONE_ALT - 0.75;
      const scanMat = new THREE.MeshBasicMaterial({
        color: GLOW,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const scanCone = new THREE.Mesh(new THREE.ConeGeometry(SCAN_RADIUS, coneHeight, 28, 1, true), scanMat);
      scene.add(scanCone);

      const introFrom = new THREE.Vector3(1.8, 2.4, 1.2);
      const target = new THREE.Vector3();
      const ahead = new THREE.Vector3();
      const markerWorld = new THREE.Vector3();

      let raf = 0;
      let startedAt: number | null = null;
      let last = 0;
      let flight = 0; // seconds of flight since the intro finished
      let renderedStill = false;

      const frame = (now: number) => {
        const still = reduceMotionRef.current;
        if (!activeRef.current && !(still && !renderedStill)) {
          raf = 0; // paused — resumeRef restarts it
          return;
        }
        if (still && renderedStill) {
          raf = 0;
          return;
        }
        raf = requestAnimationFrame(frame);
        if (startedAt === null) {
          startedAt = now;
          last = now;
        }
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const t = still ? INTRO_DONE_MS : now - startedAt;
        if (!still && t > INTRO_DONE_MS) flight += dt;

        // House pops up.
        const houseP = stepProgress(t, INTRO_HOUSE.at, INTRO_HOUSE.ms);
        const houseScale = houseP === 0 ? 0.0001 : 0.6 + 0.4 * easeOutBack(houseP, 1.5);
        house.scale.setScalar(houseScale);
        houseShadow.scale.set(houseScale, houseScale * 0.85, 1);

        // Drone: fly in, then lap the ellipse over the front slope.
        const angle = still ? MARKER_ANGLES[1] + 0.35 : (flight / LAP_S) * Math.PI * 2;
        pathPoint(angle, target);
        target.y = DRONE_ALT + Math.sin(flight * 2.4) * 0.03;
        const flyIn = easeInOutCubic(stepProgress(t, INTRO_DRONE.at, INTRO_DRONE.ms));
        drone.position.lerpVectors(introFrom, target, flyIn);
        drone.visible = flyIn > 0;
        // Bank into the turn and face along the path.
        pathPoint(angle + 0.05, ahead);
        drone.rotation.set(0, Math.atan2(ahead.x - target.x, ahead.z - target.z), 0);
        drone.rotateX(0.12 * flyIn);
        for (const rotor of rotors) rotor.rotation.y += dt * 40;

        droneShadow.position.set(drone.position.x, 0.003, drone.position.z);
        droneShadowMat.opacity = 0.25 * flyIn;

        const scanOn = clamp01((t - INTRO_DONE_MS) / 400);
        scanCone.position.set(drone.position.x, drone.position.y - 0.05 - coneHeight / 2, drone.position.z);
        scanMat.opacity = (0.16 + Math.sin(flight * 6) * 0.03) * scanOn;

        // Damage markers: found when the scan passes; cleared near the end of each lap.
        const lap = Math.floor(flight / LAP_S);
        const lapTime = flight % LAP_S;
        const clearing = !still && lapTime > LAP_S - 0.5;
        for (const marker of markers) {
          // Each lap starts with a clean roof, even if a frame skipped the fade-out.
          if (!still && marker.foundAt !== null && Math.floor(marker.foundAt / LAP_S) !== lap) {
            marker.foundAt = null;
          }
          if (marker.foundAt === null) {
            marker.group.getWorldPosition(markerWorld);
            const passing =
              still ||
              (scanOn > 0 &&
                Math.hypot(markerWorld.x - drone.position.x, markerWorld.z - drone.position.z) < FOUND_DISTANCE);
            if (passing && !clearing) marker.foundAt = flight;
          }
          if (marker.foundAt === null) {
            marker.group.visible = false;
            continue;
          }
          const age = still ? 1 : flight - marker.foundAt;
          const pop = clamp01(age / 0.35);
          const fade = clearing ? clamp01((LAP_S - lapTime) / 0.5) : 1;
          marker.group.visible = true;
          marker.dot.scale.setScalar(Math.max(0.0001, easeOutBack(pop, 2.4) * fade));
          // Expanding wave on discovery, then a slow pulse.
          const wave = still ? 0.5 : (age % 1.6) / 1.6;
          marker.wave.scale.setScalar(1 + wave * 1.8);
          marker.waveMat.opacity = (1 - wave) * 0.8 * fade;
        }

        // Slow camera drift for parallax.
        const drift = still ? 0 : flight;
        camera.position.set(
          CAMERA_POS.x + Math.sin(drift * 0.25) * CAMERA_DRIFT.x,
          CAMERA_POS.y,
          CAMERA_POS.z + Math.cos(drift * 0.25) * CAMERA_DRIFT.y,
        );
        camera.lookAt(lookAt);

        renderer.render(scene, camera);
        gl.endFrameEXP();
        if (still) renderedStill = true;
      };

      resumeRef.current = () => {
        if (raf === 0) {
          // Resume without jumping: reset the frame clock.
          last = performance.now();
          if (reduceMotionRef.current) renderedStill = false;
          raf = requestAnimationFrame(frame);
        }
      };
      raf = requestAnimationFrame(frame);

      cleanupRef.current = () => {
        cancelAnimationFrame(raf);
        resumeRef.current = null;
        disposeTree(scene);
        renderer.dispose();
      };
    } catch (error) {
      // Decorative only — on failure the hero simply shows no 3D scene.
      console.warn('[hero-inspection-3d] disabled', error);
    }
  };

  return (
    <GLView
      msaaSamples={4}
      onContextCreate={onContextCreate}
      pointerEvents="none"
      style={{ backgroundColor: BG, height, width }}
    />
  );
}
