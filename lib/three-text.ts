import * as THREE from 'three';
import { type Font, FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

import fontData from '@/assets/fonts/plus-jakarta-sans-800.typeface.json';

type TypefaceData = { resolution: number; glyphs: Record<string, { ha: number }> };
const typeface = fontData as unknown as TypefaceData;

let cachedFont: Font | null = null;

/** Plus Jakarta Sans ExtraBold as a three.js font (overlaps pre-merged for clean extrusion). */
export function getBrandFont() {
  if (!cachedFont) cachedFont = new FontLoader().parse(fontData as never);
  return cachedFont;
}

export type TextLetter = {
  mesh: THREE.Mesh;
  /** Glyph centre relative to the start of the line (x) and the baseline (y). */
  offset: THREE.Vector3;
  /** Character index within the line, spaces included — use for stagger timing. */
  index: number;
};

/**
 * Builds one extruded mesh per character so letters can animate individually.
 * Each geometry is centred on its own origin; `offset` says where it belongs.
 * TextGeometry material groups: 0 = front/back caps, 1 = extruded sides.
 */
export function buildTextLetters(
  text: string,
  options: { size: number; depth: number; bevel: number; front: THREE.Material; side: THREE.Material },
) {
  const font = getBrandFont();
  const unit = options.size / typeface.resolution;
  const letters: TextLetter[] = [];
  let cursor = 0;

  Array.from(text).forEach((ch, index) => {
    const advance = (typeface.glyphs[ch]?.ha ?? typeface.glyphs[' '].ha) * unit;
    if (ch.trim()) {
      const geometry = new TextGeometry(ch, {
        font,
        size: options.size,
        depth: options.depth,
        curveSegments: 6,
        bevelEnabled: options.bevel > 0,
        bevelThickness: options.bevel * 1.6,
        bevelSize: options.bevel,
        bevelSegments: 3,
      });
      geometry.computeBoundingBox();
      const center = new THREE.Vector3();
      geometry.boundingBox!.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);
      letters.push({
        mesh: new THREE.Mesh(geometry, [options.front, options.side]),
        offset: new THREE.Vector3(cursor + center.x, center.y, 0),
        index,
      });
    }
    cursor += advance;
  });

  return { letters, width: cursor };
}
