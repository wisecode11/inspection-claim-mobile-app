import * as THREE from 'three';

/**
 * RoofCheck brand mark traced from assets/images/splash-icon.png (512 px canvas, y down).
 * Verified against the PNG: house IoU 0.95, check IoU 0.93.
 */
export const HOUSE_PX: [number, number][] = [
  [81, 284], [141, 232], [141, 163], [182, 163], [182, 197], [256, 135], [432, 284],
  [378, 284], [256, 180], [166, 256], [166, 377], [131, 377], [131, 284],
];
export const CHECK_PX: [number, number][] = [
  [252, 337], [292, 377], [368, 302], [351, 285], [292, 343], [269, 320],
];

/** Brand orange, sampled from the mark's check. */
export const BRAND_ORANGE = '#F47622';
export const BRAND_ORANGE_SIDE = '#B9521A';

/**
 * A three.js shape from icon pixels. `scale` converts icon px to world units.
 * By default the shape is placed relative to the icon centre (256, 256), so house and
 * check keep their relative position; pass `centerOnSelf` to centre a piece on its own bounds.
 */
export function brandShape(points: [number, number][], scale: number, centerOnSelf = false) {
  let cx = 256;
  let cy = 256;
  if (centerOnSelf) {
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  }
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => {
    const X = (x - cx) * scale;
    const Y = -(y - cy) * scale;
    if (i === 0) shape.moveTo(X, Y);
    else shape.lineTo(X, Y);
  });
  shape.closePath();
  return shape;
}

/** Extrudes a shape with a soft bevel, centred on z. */
export function extrudeCentered(shape: THREE.Shape, depth: number, bevel: number) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.7,
    bevelSegments: 3,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}
