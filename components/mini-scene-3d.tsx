import { type ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

import { createGLRenderer, disposeTree, GLOW } from '@/lib/three-gl';

/** Builds the scene once and returns a per-frame update (`time` in seconds since start). */
export type MiniSceneBuilder = (scene: THREE.Scene) => (time: number) => void;

/** Time used for the single still frame when motion is reduced. */
const STILL_TIME = 1.2;

/**
 * Small square 3D icon: shared camera and lights, a frame loop that pauses while
 * `active` is false, and a single still frame under reduce motion.
 * `background` must match whatever the icon sits on (GL clears to an opaque colour).
 * `build` is read once, when the GL context is created.
 */
export function MiniScene3D({
  size,
  background,
  active,
  reduceMotion,
  build,
}: {
  size: number;
  background: string;
  active: boolean;
  reduceMotion: boolean;
  build: MiniSceneBuilder;
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
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      camera.position.set(0, 0, 4.6);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.HemisphereLight('#FFFFFF', '#5E9EAA', 1.4));
      const key = new THREE.DirectionalLight('#FFFFFF', 2.2);
      key.position.set(2, 3, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(GLOW, 0.8);
      rim.position.set(-3, 1, -2);
      scene.add(rim);

      const update = build(scene);

      let raf = 0;
      let last = 0;
      let time = 0;
      let renderedStill = false;

      const frame = (now: number) => {
        const still = reduceMotionRef.current;
        if (still ? renderedStill : !activeRef.current) {
          raf = 0; // paused — resumeRef restarts it
          return;
        }
        raf = requestAnimationFrame(frame);
        if (last === 0) last = now;
        time += Math.min(0.05, (now - last) / 1000);
        last = now;
        update(still ? STILL_TIME : time);
        renderer.render(scene, camera);
        gl.endFrameEXP();
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
      // Decorative only — on failure the card simply shows no icon.
      console.warn('[mini-scene-3d] disabled', error);
    }
  };

  return (
    <GLView
      msaaSamples={4}
      onContextCreate={onContextCreate}
      pointerEvents="none"
      style={{ backgroundColor: background, height: size, width: size }}
    />
  );
}
