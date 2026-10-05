import { type ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

import { Brand } from '@/constants/theme';
import {
  createGLRenderer,
  createPointsCamera,
  disposeTree,
  easeOutBack,
  GLOW,
  stepProgress,
} from '@/lib/three-gl';
import { buildTextLetters, type TextLetter } from '@/lib/three-text';

const BG = Brand.accent;
const FACE = '#FFFFFF';
const SIDE = '#5E9EAA';

// Matches the 2D hero title (34pt, 38pt line height) so the 3D text sits where the old text did.
const FONT_SIZE = 34;
const LINE_HEIGHT = 38;
const DEPTH = 7;
const PAD_X = 10; // room for perspective when the block tilts; offset back with a negative margin
const PAD_TOP = 6;
const FIRST_BASELINE = 30;
const PAD_BOTTOM = 14;

const LETTER_STAGGER_MS = 45;
const LETTER_MS = 620;
const SHINE_EVERY_S = 5;
const SHINE_SWEEP_S = 1.4;

const CAMERA_FOV = 30;

export function heroTitle3DHeight(lineCount: number) {
  return PAD_TOP + FIRST_BASELINE + (lineCount - 1) * LINE_HEIGHT + PAD_BOTTOM;
}

type PlacedLetter = TextLetter & { base: THREE.Vector3; order: number };

/**
 * Lays the lines out left-aligned like RN text (view coords: origin top-left, y up).
 * If the widest line doesn't fit `maxWidth`, the whole block shrinks from its top-left corner.
 */
function layoutLines(lines: string[], maxWidth: number, front: THREE.Material, side: THREE.Material) {
  const placed: PlacedLetter[] = [];
  let order = 0;
  let widest = 0;

  lines.forEach((line, lineIndex) => {
    const baseline = -(PAD_TOP + FIRST_BASELINE + lineIndex * LINE_HEIGHT);
    const { letters, width } = buildTextLetters(line, { size: FONT_SIZE, depth: DEPTH, bevel: 0.65, front, side });
    for (const letter of letters) {
      placed.push({
        ...letter,
        base: new THREE.Vector3(PAD_X + letter.offset.x, baseline + letter.offset.y, 0),
        order: order + letter.index,
      });
    }
    order += line.length;
    widest = Math.max(widest, width);
  });

  const fit = widest > maxWidth ? maxWidth / widest : 1;
  if (fit < 1) {
    for (const letter of placed) {
      letter.base.x = PAD_X + (letter.base.x - PAD_X) * fit;
      letter.base.y = -PAD_TOP + (letter.base.y + PAD_TOP) * fit;
    }
  }
  return { letters: placed, fit };
}

/**
 * The login hero's "Welcome / back" as extruded 3D type in the brand font:
 * letters flip up one by one, the block tilts gently, a soft wave runs through
 * the letters and a light sweeps across them every few seconds.
 *
 * `width` is the available layout width (points). The view is wider by PAD_X on
 * each side and pulled left by the same amount, so the letters line up with the
 * 2D eyebrow above. `animate` false (reduce motion) renders the settled title once.
 */
export function HeroTitle3D({
  lines,
  width,
  start,
  animate,
  onError,
}: {
  lines: string[];
  width: number;
  start: boolean;
  animate: boolean;
  onError?: () => void;
}) {
  const startRef = useRef(start);
  const animateRef = useRef(animate);
  startRef.current = start;
  animateRef.current = animate;
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const viewWidth = width + PAD_X * 2;
  const viewHeight = heroTitle3DHeight(lines.length);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      const renderer = createGLRenderer(gl, BG);
      const scene = new THREE.Scene();
      // Origin top-left like RN layout: the view shows x ∈ [0, w], y ∈ [-h, 0].
      const camera = createPointsCamera(
        viewWidth,
        viewHeight,
        CAMERA_FOV,
        new THREE.Vector2(viewWidth / 2, -viewHeight / 2),
      );

      scene.add(new THREE.HemisphereLight('#FFFFFF', BG, 1.2));
      const key = new THREE.DirectionalLight('#FFFFFF', 1.8);
      key.position.set(viewWidth * 0.2, viewHeight * 1.5, 160);
      key.target.position.set(viewWidth / 2, -viewHeight / 2, 0);
      scene.add(key, key.target);
      const rim = new THREE.DirectionalLight(GLOW, 1.2);
      rim.position.set(viewWidth * 1.2, viewHeight, -80);
      rim.target.position.set(viewWidth / 2, -viewHeight / 2, 0);
      scene.add(rim, rim.target);
      // Sweeping highlight — decay 0 keeps its strength independent of point-scale distances.
      const shine = new THREE.PointLight(GLOW, 0, 0, 0);
      scene.add(shine);

      const frontMat = new THREE.MeshStandardMaterial({ color: FACE, roughness: 0.3, metalness: 0.15 });
      const sideMat = new THREE.MeshStandardMaterial({ color: SIDE, roughness: 0.5, metalness: 0.1 });

      // Tilt pivots around the middle of the text block.
      const pivot = new THREE.Group();
      pivot.position.set(viewWidth / 2, -viewHeight / 2, 0);
      scene.add(pivot);
      const { letters, fit } = layoutLines(lines, width, frontMat, sideMat);
      for (const letter of letters) {
        letter.base.x -= viewWidth / 2;
        letter.base.y += viewHeight / 2;
        pivot.add(letter.mesh);
      }
      const introMs = (letters.at(-1)?.order ?? 0) * LETTER_STAGGER_MS + LETTER_MS;

      let raf = 0;
      let last = performance.now();
      let introStart: number | null = null;
      let elapsed = 0;
      let renderedStill = false;

      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;

        const moving = animateRef.current;
        if (startRef.current && introStart === null) introStart = now;
        const sinceStart = introStart === null ? -1 : moving ? now - introStart : introMs;
        if (!moving && sinceStart >= 0 && renderedStill) return;
        const settled = sinceStart >= introMs;
        if (moving && settled) elapsed += dt;

        for (const { mesh, base, order } of letters) {
          const p = stepProgress(sinceStart, order * LETTER_STAGGER_MS, LETTER_MS);
          const eased = p === 0 ? 0 : easeOutBack(p, 1.6);
          mesh.visible = p > 0;
          mesh.position.set(
            base.x,
            base.y - (1 - eased) * 16 * fit,
            // A soft wave rolls through the letters once they have landed.
            Math.sin(elapsed * 2 - order * 0.45) * 1.6,
          );
          mesh.rotation.x = (1 - eased) * -Math.PI / 2;
          mesh.scale.setScalar(fit * (0.6 + 0.4 * eased));
        }

        pivot.rotation.y = Math.sin(elapsed * 0.45) * 0.12;
        pivot.rotation.x = Math.sin(elapsed * 0.35) * 0.06;

        // Light sweep left → right once every SHINE_EVERY_S seconds.
        const cycle = elapsed % SHINE_EVERY_S;
        const sweep = Math.min(1, cycle / SHINE_SWEEP_S);
        const sweeping = moving && settled && cycle < SHINE_SWEEP_S;
        shine.position.set(-viewWidth * 0.2 + sweep * viewWidth * 1.4, -viewHeight * 0.4, 45);
        shine.intensity = sweeping ? Math.sin(sweep * Math.PI) * 2.6 : 0;

        renderer.render(scene, camera);
        gl.endFrameEXP();
        if (!moving && sinceStart >= 0) renderedStill = true;
      };
      raf = requestAnimationFrame(frame);

      cleanupRef.current = () => {
        cancelAnimationFrame(raf);
        disposeTree(scene);
        renderer.dispose();
      };
    } catch (error) {
      console.warn('[hero-title-3d] falling back to 2D', error);
      onError?.();
    }
  };

  return (
    <GLView
      accessibilityLabel={lines.join(' ')}
      accessibilityRole="header"
      accessible
      msaaSamples={4}
      onContextCreate={onContextCreate}
      style={{ backgroundColor: BG, height: viewHeight, marginLeft: -PAD_X, width: viewWidth }}
    />
  );
}
