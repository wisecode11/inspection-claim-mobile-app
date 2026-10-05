import { type ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as THREE from 'three';

import { Brand } from '@/constants/theme';
import {
  clamp01,
  createGLRenderer,
  createPointsCamera,
  disposeTree,
  easeInOutCubic,
  easeOutBack,
  GLOW,
  stepProgress,
} from '@/lib/three-gl';
import { BRAND_ORANGE, BRAND_ORANGE_SIDE, brandShape, CHECK_PX, extrudeCentered, HOUSE_PX } from '@/lib/brand-mark';
import { buildTextLetters } from '@/lib/three-text';

const BG = Brand.accent;
const WHITE = '#F7FAFB';
const WHITE_SIDE = '#5E9EAA';
const ORANGE = BRAND_ORANGE;
const ORANGE_SIDE = BRAND_ORANGE_SIDE;
const MUTED = '#8FAEB8';

// The native splash draws the 512 px icon at 200 pt, centred — start the 3D mark exactly there.
const ICON_SCALE = 200 / 512;

const HOUSE_DEPTH = 16;
const CHECK_DEPTH = 22;
const LOGO_Y = 78; // final logo centre above screen centre (points)
const LOGO_SCALE = 1.18;
const RING_RADIUS = 118;
const RING_TILT = 1.2;
const TITLE_SIZE = 38;
const TITLE_BASELINE = -58; // points below screen centre
const SUBTITLE_TOP = 74; // RN text, points below screen centre
const PARTICLES = 110;

// Timeline (ms from mount).
const EXTRUDE = { at: 0, ms: 750 };
const RISE = { at: 350, ms: 750 };
const CHECK_POP = { at: 700, ms: 450 };
const RING_IN = { at: 850, ms: 500 };
const BEAM_AT = 1250;
const TITLE_AT = 1000;
const LETTER_STAGGER = 55;
const LETTER_MS = 600;
const SETTLED_AT = 2300;
const SHINE_EVERY_S = 3.2;
const SHINE_SWEEP_S = 1.2;
const EXIT_MS = 420;

/** Soft round sprite (white, radial alpha) for particles and the background glow. */
function radialTexture(size: number, falloff: number) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(Math.pow(1 - r, falloff) * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

function LoadingBar() {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
  }, [progress]);
  const fill = useAnimatedStyle(() => ({ width: interpolate(progress.value, [0, 1], [18, 120]) }));
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
}

/**
 * Full-screen 3D splash. Opens on the brand mark exactly where the native splash
 * drew it, then extrudes it into 3D, lifts it, pops the orange check forward,
 * rings it with the inspection beam and flips "RoofCheck" in letter by letter
 * over drifting glow particles. Subtitle, loader and footer stay crisp 2D text.
 *
 * `exiting` fades it out (parent unmounts afterwards). `onError` lets the parent
 * fall back to the 2D splash if GL can't start.
 */
export function Splash3D({ exiting = false, onError }: { exiting?: boolean; onError?: () => void }) {
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const reduceMotionRef = useRef(false);
  reduceMotionRef.current = reduceMotion;
  const exitingRef = useRef(exiting);
  exitingRef.current = exiting;
  const cleanupRef = useRef<(() => void) | null>(null);
  const screenOpacity = useSharedValue(1);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
      cleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (exiting) screenOpacity.value = withTiming(0, { duration: EXIT_MS, easing: Easing.out(Easing.cubic) });
  }, [exiting, screenOpacity]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      const renderer = createGLRenderer(gl, BG);
      const scene = new THREE.Scene();
      const camera = createPointsCamera(width, height, 35);

      scene.add(new THREE.HemisphereLight('#FFFFFF', BG, 1.3));
      const key = new THREE.DirectionalLight('#FFFFFF', 2.3);
      key.position.set(-200, 400, 600);
      scene.add(key);
      const rim = new THREE.DirectionalLight(GLOW, 1.4);
      rim.position.set(300, 150, -400);
      scene.add(rim);
      const shine = new THREE.PointLight('#FFFFFF', 0, 0, 0);
      scene.add(shine);

      // Soft teal glow behind the logo's resting place.
      const glowTexture = radialTexture(64, 2);
      const glowMat = new THREE.MeshBasicMaterial({
        map: glowTexture,
        color: '#2A6A78',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), glowMat);
      glow.position.set(0, LOGO_Y, -160);
      scene.add(glow);

      // Drifting glow particles for depth.
      const dotTexture = radialTexture(32, 2.2);
      const positions = new Float32Array(PARTICLES * 3);
      const speeds = new Float32Array(PARTICLES);
      for (let i = 0; i < PARTICLES; i++) {
        positions[i * 3] = (Math.random() - 0.5) * width * 1.6;
        positions[i * 3 + 1] = (Math.random() - 0.5) * height * 1.3;
        positions[i * 3 + 2] = -400 + Math.random() * 440;
        speeds[i] = 8 + Math.random() * 16;
      }
      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const particleMat = new THREE.PointsMaterial({
        map: dotTexture,
        color: GLOW,
        size: 6,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      scene.add(new THREE.Points(particleGeo, particleMat));

      // Brand mark: white house + orange check, extruded.
      const whiteMat = new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.32, metalness: 0.12 });
      const whiteSideMat = new THREE.MeshStandardMaterial({ color: WHITE_SIDE, roughness: 0.5 });
      const orangeMat = new THREE.MeshStandardMaterial({
        color: ORANGE,
        roughness: 0.35,
        metalness: 0.1,
        emissive: ORANGE,
        emissiveIntensity: 0,
      });
      const orangeSideMat = new THREE.MeshStandardMaterial({ color: ORANGE_SIDE, roughness: 0.5 });

      const logo = new THREE.Group();
      scene.add(logo);
      const house = new THREE.Mesh(extrudeCentered(brandShape(HOUSE_PX, ICON_SCALE), HOUSE_DEPTH, 1.6), [whiteMat, whiteSideMat]);
      logo.add(house);
      const check = new THREE.Mesh(extrudeCentered(brandShape(CHECK_PX, ICON_SCALE), CHECK_DEPTH, 1.6), [orangeMat, orangeSideMat]);
      logo.add(check);

      // Inspection ring + beam around the logo's resting place.
      const ring = new THREE.Group();
      ring.position.set(0, LOGO_Y, 0);
      ring.rotation.x = RING_TILT;
      scene.add(ring);
      const ringMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false });
      ring.add(new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, 0.9, 8, 160), ringMat));
      const beadGeo = new THREE.SphereGeometry(1, 16, 12);
      const trail = Array.from({ length: 10 }, (_, i) => {
        const t = 1 - i / 10;
        const mat = new THREE.MeshBasicMaterial({ color: i === 0 ? '#FFFFFF' : GLOW, transparent: true, opacity: 0, depthWrite: false });
        const mesh = new THREE.Mesh(beadGeo, mat);
        mesh.scale.setScalar(i === 0 ? 4.2 : 3.2 * t + 0.8);
        ring.add(mesh);
        return { mesh, mat, maxOpacity: i === 0 ? 1 : 0.6 * t * t };
      });
      const haloMat = new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0, depthWrite: false });
      const halo = new THREE.Mesh(beadGeo, haloMat);
      halo.scale.setScalar(12);
      ring.add(halo);

      // "Roof" in white, "Check" in the mark's orange.
      const title = new THREE.Group();
      title.position.set(0, TITLE_BASELINE, 0);
      scene.add(title);
      const { letters, width: titleWidth } = buildTextLetters('RoofCheck', {
        size: TITLE_SIZE,
        depth: 9,
        bevel: 0.8,
        front: whiteMat,
        side: whiteSideMat,
      });
      for (const letter of letters) {
        if (letter.index >= 4) letter.mesh.material = [orangeMat, orangeSideMat];
        letter.offset.x -= titleWidth / 2;
        title.add(letter.mesh);
      }

      let raf = 0;
      const startedAt = performance.now();
      let last = startedAt;
      let idle = 0;
      let exitStart: number | null = null;
      let renderedStill = false;

      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const still = reduceMotionRef.current;
        // Reduce motion: show the finished composition, drawn once.
        const t = still ? SETTLED_AT : now - startedAt;
        if (still && renderedStill && !exitingRef.current) return;
        if (!still && t > RISE.at + RISE.ms) idle += dt;
        if (exitingRef.current && exitStart === null) exitStart = now;
        const exitP = exitStart === null || still ? 0 : clamp01((now - exitStart) / EXIT_MS);

        // 1. Flat mark (matching the native splash) gains depth with a swing that shows it off.
        const extrudeP = easeInOutCubic(stepProgress(t, EXTRUDE.at, EXTRUDE.ms));
        const riseP = easeInOutCubic(stepProgress(t, RISE.at, RISE.ms));
        const scale = (1 + (LOGO_SCALE - 1) * riseP) * (1 + 0.12 * exitP);
        logo.scale.set(scale, scale, scale * Math.max(0.02, extrudeP));
        logo.position.set(0, LOGO_Y * riseP + Math.sin(idle * 1.3) * 3, 40 * exitP);
        logo.rotation.y = Math.sin(extrudeP * Math.PI) * 0.75 + Math.sin(idle * 0.7) * 0.35;
        logo.rotation.x = Math.sin(idle * 0.5) * 0.06;

        // 2. The check pops forward off the house with a flash.
        const popP = stepProgress(t, CHECK_POP.at, CHECK_POP.ms);
        check.position.z = (popP === 0 ? 0 : easeOutBack(popP, 2.2)) * 9;
        orangeMat.emissiveIntensity =
          popP > 0 && popP < 1 ? Math.sin(popP * Math.PI) * 0.9 : 0.12 + Math.sin(idle * 2.2) * 0.08;

        // 3. Ring, glow and beam.
        const ringP = stepProgress(t, RING_IN.at, RING_IN.ms);
        ring.scale.setScalar(0.6 + 0.4 * easeOutBack(ringP, 1.4));
        ringMat.opacity = 0.2 * ringP;
        glowMat.opacity = 0.75 * ringP;
        const beamIn = stepProgress(t, BEAM_AT, 500);
        const beamAngle = Math.PI / 2 - Math.max(0, t - BEAM_AT) / 1000 * ((Math.PI * 2) / 3);
        trail.forEach(({ mesh, mat, maxOpacity }, i) => {
          const a = beamAngle + i * 0.09;
          mesh.position.set(Math.cos(a) * RING_RADIUS, Math.sin(a) * RING_RADIUS, 0);
          mat.opacity = maxOpacity * beamIn;
        });
        halo.position.copy(trail[0].mesh.position);
        haloMat.opacity = 0.22 * beamIn;

        // 4. Title letters flip up one by one, then a gentle wave.
        for (const { mesh, offset, index } of letters) {
          const p = stepProgress(t, TITLE_AT + index * LETTER_STAGGER, LETTER_MS);
          const eased = p === 0 ? 0 : easeOutBack(p, 1.6);
          mesh.visible = p > 0;
          mesh.position.set(offset.x, offset.y - (1 - eased) * 14, Math.sin(idle * 2 - index * 0.45) * 1.4);
          mesh.rotation.x = (1 - eased) * -Math.PI / 2;
          mesh.scale.setScalar(0.6 + 0.4 * eased);
        }

        // 5. Particles drift up and fade in.
        particleMat.opacity = 0.55 * stepProgress(t, 400, 1000);
        if (!still) {
          for (let i = 0; i < PARTICLES; i++) {
            positions[i * 3 + 1] += speeds[i] * dt;
            if (positions[i * 3 + 1] > height * 0.65) positions[i * 3 + 1] = -height * 0.65;
          }
          particleGeo.attributes.position.needsUpdate = true;
        }

        // 6. Periodic light sweep across logo and title.
        const sinceSettled = t - SETTLED_AT;
        const cycle = sinceSettled % (SHINE_EVERY_S * 1000);
        const sweep = Math.min(1, cycle / (SHINE_SWEEP_S * 1000));
        const sweeping = !still && sinceSettled > 0 && cycle < SHINE_SWEEP_S * 1000;
        shine.position.set(-width * 0.6 + sweep * width * 1.2, 20, 140);
        shine.intensity = sweeping ? Math.sin(sweep * Math.PI) * 1.6 : 0;

        renderer.render(scene, camera);
        gl.endFrameEXP();
        if (still) renderedStill = true;
      };
      raf = requestAnimationFrame(frame);

      cleanupRef.current = () => {
        cancelAnimationFrame(raf);
        disposeTree(scene);
        renderer.dispose();
      };
    } catch (error) {
      console.warn('[splash-3d] falling back to 2D', error);
      onError?.();
    }
  };

  return (
    <Animated.View
      accessibilityLabel="RoofCheck, loading"
      accessible
      pointerEvents={exiting ? 'none' : 'auto'}
      style={[styles.screen, screenStyle]}
    >
      <GLView msaaSamples={4} onContextCreate={onContextCreate} style={StyleSheet.absoluteFill} />

      <View pointerEvents="none" style={[styles.copy, { top: height / 2 + SUBTITLE_TOP }]}>
        <Animated.Text entering={FadeIn.delay(1700).duration(400)} style={styles.subtitle}>
          Inspection workspace
        </Animated.Text>
        <Animated.View entering={FadeIn.delay(1900).duration(400)}>
          <LoadingBar />
        </Animated.View>
      </View>

      <Animated.Text entering={FadeIn.delay(2000).duration(400)} style={styles.footer}>
        Field inspections made simple
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    zIndex: 100,
  },
  copy: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  subtitle: {
    color: MUTED,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  barTrack: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    height: 4,
    marginTop: 28,
    overflow: 'hidden',
    width: 120,
  },
  barFill: {
    backgroundColor: GLOW,
    borderRadius: 999,
    height: '100%',
  },
  footer: {
    bottom: 42,
    color: MUTED,
    fontSize: 13,
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
  },
});
