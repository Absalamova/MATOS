import * as THREE from 'three';
import { Body } from './body';

const TAU = Math.PI * 2;

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export { rng } from '../lib/weave';
import { rng } from '../lib/weave';

export const hashString = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

export interface FoldSpec {
  /** fabric starts folding below this height */
  start: number;
  /** full depth reached here */
  end: number;
  depth: number;
  count: number;
  /** 0 = regular, 1 = very irregular */
  irregular?: number;
  /** knife pleats instead of soft folds */
  pleats?: boolean;
  seed?: number;
  /** how much the hem rises on fold peaks */
  hemWave?: number;
}

export interface ShellSpec {
  body: Body;
  cols?: number;
  rows?: number;
  yTop: (theta: number) => number;
  yBottom: (theta: number) => number;
  /** gap between hull and fabric */
  ease: (y: number, theta: number) => number;
  /** below this height the fabric hangs: radius never shrinks going down */
  hangFrom?: number;
  /** allowed shrink per row while hanging (1 = never shrinks) */
  hangKeep?: number;
  /** extra outward radius (A-line, mermaid …) */
  flare?: (y: number, theta: number) => number;
  /** final radius tweak (shoulder pads etc.) */
  shape?: (y: number, theta: number, r: number) => number;
  folds?: FoldSpec;
  hole?: (theta: number, y: number) => boolean;
  /** fabric spreading on the floor at the back */
  train?: { length: number; rows?: number; floorY: number };
  thetaRange?: [number, number];
  /** extra outward offset on top of everything (for overlays like lapels) */
  lift?: number;
  /** custom cross-section (defaults to the body hull) */
  hullFn?: (y: number, theta: number, out: THREE.Vector2) => THREE.Vector2;
  /** horizontal centre of the cross-section (defaults to the body axis) */
  centerFn?: (y: number) => { x: number; z: number };
  /** where wind starts to move the fabric (weight 0 above, 1 at the hem) */
  windFrom?: number;
  /** garment covers the shoulder joints (sleeved / cap-sleeved styles) */
  coverShoulders?: boolean;
}

export interface ShellResult {
  geometry: THREE.BufferGeometry;
  /** surface position + outward normal at (theta, y) on the finished shell (approximate) */
  pointAt: (theta: number, y: number) => { pos: THREE.Vector3; normal: THREE.Vector3 };
}

function foldValue(f: FoldSpec, theta: number) {
  const r = rng(f.seed ?? 7);
  if (f.pleats) {
    const v = (2 / Math.PI) * Math.asin(Math.sin(f.count * theta));
    return v;
  }
  const irr = f.irregular ?? 0.5;
  let sum = 0;
  let norm = 0;
  for (let k = 0; k < 4; k++) {
    const n = Math.max(2, Math.round(f.count * (k === 0 ? 1 : 0.5 + r() * 1.5)));
    const a = k === 0 ? 1 : irr * (0.35 + r() * 0.4);
    const ph = r() * TAU;
    sum += a * Math.sin(n * theta + ph);
    norm += a;
  }
  return sum / norm;
}

/**
 * Builds a garment surface around the body. Columns run around the body
 * (theta), rows run from the top edge to the hem.
 */
export function buildShell(spec: ShellSpec): ShellResult {
  const cols = spec.cols ?? 96;
  const rows = spec.rows ?? 72;
  const [t0, t1] = spec.thetaRange ?? [-Math.PI / 2, (3 * Math.PI) / 2];
  const closed = !spec.thetaRange;
  const trainRows = spec.train ? spec.train.rows ?? 10 : 0;
  const totalRows = rows + trainRows;
  const ncol = cols + 1;
  const pos = new Float32Array(ncol * (totalRows + 1) * 3);
  const uv = new Float32Array(ncol * (totalRows + 1) * 2);
  const weight = new Float32Array(ncol * (totalRows + 1));
  const thetaAttr = new Float32Array(ncol * (totalRows + 1));
  const hull = new THREE.Vector2();
  const prevR = new Float32Array(ncol);
  const yTopArr = new Float32Array(ncol);
  const yBotArr = new Float32Array(ncol);
  const foldArr = new Float32Array(ncol);
  const thetas = new Float32Array(ncol);

  for (let c = 0; c < ncol; c++) {
    const th = t0 + ((t1 - t0) * c) / cols;
    thetas[c] = th;
    foldArr[c] = spec.folds ? foldValue(spec.folds, th) : 0;
    const top = spec.yTop(th);
    let bot = spec.yBottom(th);
    if (spec.folds?.hemWave) bot += spec.folds.hemWave * foldArr[c];
    yTopArr[c] = top;
    yBotArr[c] = bot;
  }

  const dirX = new Float32Array(ncol);
  const dirZ = new Float32Array(ncol);
  const base = new Float32Array(ncol);
  const rowY = new Float32Array(ncol);

  /** Fabric hanging under gravity bridges hollows: replace the row by its convex hull. */
  const convexify = () => {
    const n = closed ? cols : ncol;
    const pts: [number, number, number][] = [];
    for (let c = 0; c < n; c++) pts.push([dirX[c] * base[c], dirZ[c] * base[c], c]);
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: [number, number, number][] = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper: [number, number, number][] = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    const hullPts = lower.slice(0, -1).concat(upper.slice(0, -1));
    if (hullPts.length < 3) return;
    for (let c = 0; c < ncol; c++) {
      const dx = dirX[c];
      const dz = dirZ[c];
      let best = 0;
      for (let k = 0; k < hullPts.length; k++) {
        const A = hullPts[k];
        const B = hullPts[(k + 1) % hullPts.length];
        const ex = B[0] - A[0];
        const ez = B[1] - A[1];
        const den = dx * ez - dz * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = (A[0] * ez - A[1] * ex) / den;
        const u = (A[0] * dz - A[1] * dx) / den;
        if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.max(best, t);
      }
      // fade the bridging in below hangFrom: switching it on for a whole row at once left a
      // horizontal crease across the front of hanging skirts
      const fade = spec.hangFrom === undefined ? 1 : smoothstep(spec.hangFrom, spec.hangFrom - 0.08, rowY[c]);
      if (best > base[c]) base[c] += (best - base[c]) * fade;
    }
  };

  const finish = (c: number, y: number) => {
    const th = thetas[c];
    let out = base[c];
    if (spec.flare) out += spec.flare(y, th);
    if (spec.shape) out = spec.shape(y, th, out);
    if (spec.folds) {
      const f = spec.folds;
      const k = Math.pow(smoothstep(f.start, f.end, y), 1.2);
      out += f.depth * k * foldArr[c];
    }
    out += spec.lift ?? 0;
    return { x: dirX[c] * out, z: dirZ[c] * out, dirx: dirX[c], dirz: dirZ[c] };
  };

  const computeRow = (r: number) => {
    const v = r / rows;
    let hanging = 0;
    for (let c = 0; c < ncol; c++) {
      const th = thetas[c];
      const y = yTopArr[c] + (yBotArr[c] - yTopArr[c]) * v;
      rowY[c] = y;
      if (spec.hullFn) spec.hullFn(y, th, hull);
      else spec.body.hullPoint(y, th, hull, spec.coverShoulders);
      const rHull = hull.length() || 1;
      dirX[c] = hull.x / rHull;
      dirZ[c] = hull.y / rHull;
      let rr = rHull + spec.ease(y, th);
      if (spec.hangFrom !== undefined && y < spec.hangFrom && r > 0) {
        rr = Math.max(rr, prevR[c] * (spec.hangKeep ?? 1));
        hanging++;
      }
      base[c] = rr;
    }
    if (closed && hanging > 0) convexify();
    for (let c = 0; c < ncol; c++) prevR[c] = base[c];
  };

  // Rows top → bottom so the hanging logic sees the row above.
  let lastRow: { x: number; z: number; dirx: number; dirz: number }[] = [];
  for (let r = 0; r <= totalRows; r++) {
    const row: { x: number; z: number; dirx: number; dirz: number }[] = [];
    for (let c = 0; c < ncol; c++) {
      const i = r * ncol + c;
      let y: number;
      let p: { x: number; z: number; dirx: number; dirz: number };
      if (r <= rows) {
        if (c === 0) computeRow(r);
        y = rowY[c];
        p = finish(c, y);
      } else {
        // train: keep spreading outward on the floor, mostly behind the body
        const tr = spec.train!;
        const k = (r - rows) / trainRows;
        const back = Math.max(0, -Math.sin(thetas[c]));
        const step = (tr.length * Math.pow(back, 1.6) + 0.025) / trainRows;
        const prev = lastRow[c];
        y = tr.floorY + 0.006 * (1 - k);
        p = { x: prev.x + prev.dirx * step, z: prev.z + prev.dirz * step, dirx: prev.dirx, dirz: prev.dirz };
      }
      row.push(p);
      const ctr = spec.centerFn ? spec.centerFn(y) : null;
      pos[i * 3] = p.x + (ctr ? ctr.x : 0);
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = p.z + (ctr ? ctr.z : 0);
      if (spec.windFrom !== undefined) {
        const hem = Math.min(yBotArr[c], spec.windFrom - 0.05);
        weight[i] = Math.pow(Math.min(1, Math.max(0, (spec.windFrom - y) / (spec.windFrom - hem))), 1.5);
      } else weight[i] = 0;
      thetaAttr[i] = thetas[c];
    }
    lastRow = row;
  }

  // UVs in metres: u = arc length around each row, v = height. Like a garment cut on the
  // straight grain, u is measured from the centre front, so prints stay upright on the front.
  // (Measuring from the back seam made u at the front depend on the whole girth, and prints
  // sheared into diagonals wherever the girth changes, e.g. from waist to hips.)
  let frontCol = Math.round(cols / 2);
  let bd = (t1 - t0) / cols;
  for (let c = 0; c < ncol; c++) {
    let d = Math.abs(thetas[c] - Math.PI / 2) % TAU;
    if (d > Math.PI) d = TAU - d;
    if (d <= bd) {
      bd = d;
      frontCol = c;
    }
  }
  const acc = new Float32Array(ncol);
  for (let r = 0; r <= totalRows; r++) {
    for (let c = 1; c < ncol; c++) {
      const i = r * ncol + c;
      const j = i - 1;
      acc[c] = acc[c - 1] + Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 2] - pos[j * 3 + 2]);
    }
    for (let c = 0; c < ncol; c++) {
      const i = r * ncol + c;
      uv[i * 2] = acc[c] - acc[frontCol];
      uv[i * 2 + 1] = pos[i * 3 + 1];
    }
  }

  const idx: number[] = [];
  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * ncol + c;
      const b = a + 1;
      const d = a + ncol;
      const e = d + 1;
      if (spec.hole) {
        const th = (thetas[c] + thetas[c + 1]) / 2;
        const y = (pos[a * 3 + 1] + pos[e * 3 + 1]) / 2;
        if (spec.hole(th, y)) continue;
      }
      idx.push(a, d, b, b, d, e);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('weight', new THREE.BufferAttribute(weight, 1));
  g.setAttribute('theta', new THREE.BufferAttribute(thetaAttr, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (closed) weldSeamNormals(g, ncol, totalRows + 1);
  g.computeBoundingSphere();

  const pointAt = (theta: number, y: number) => {
    // nearest column, interpolate row by height
    let th = theta;
    while (th < t0) th += TAU;
    while (th > t0 + TAU) th -= TAU;
    const c = Math.max(0, Math.min(cols, Math.round(((th - t0) / (t1 - t0)) * cols)));
    let best = 0;
    let bd = Infinity;
    for (let r = 0; r <= rows; r++) {
      const d = Math.abs(pos[(r * ncol + c) * 3 + 1] - y);
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    const i = best * ncol + c;
    const n = g.getAttribute('normal');
    return {
      pos: new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]),
      normal: new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i)).normalize(),
    };
  };

  return { geometry: g, pointAt };
}

/** The first and last column of a closed shell share positions; average their normals so no seam shows. */
function weldSeamNormals(g: THREE.BufferGeometry, ncol: number, nrow: number) {
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let r = 0; r < nrow; r++) {
    const a = r * ncol;
    const b = a + ncol - 1;
    const x = n.getX(a) + n.getX(b);
    const y = n.getY(a) + n.getY(b);
    const z = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l);
    n.setXYZ(b, x / l, y / l, z / l);
  }
  n.needsUpdate = true;
}

export interface TubeSpec {
  curve: THREE.Curve<THREE.Vector3>;
  radius: (t: number) => number;
  t0?: number;
  t1?: number;
  segments?: number;
  radial?: number;
  /** pulls the cross-section centre downwards (hanging sleeves) */
  droop?: (t: number) => number;
  /** stretches the section along the "down" direction */
  stretch?: (t: number) => number;
  capStart?: boolean;
  capEnd?: boolean;
}

/** Tapered (optionally hanging) tube along a curve, with UVs in metres. */
export function buildTube(spec: TubeSpec) {
  const seg = spec.segments ?? 40;
  const rad = spec.radial ?? 28;
  const t0 = spec.t0 ?? 0;
  const t1 = spec.t1 ?? 1;
  const pos: number[] = [];
  const uvs: number[] = [];
  const weights: number[] = [];
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const D = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  const ref = new THREE.Vector3(0, 0, 1);
  let len = 0;
  const prev = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = t0 + ((t1 - t0) * i) / seg;
    spec.curve.getPointAt(t, P);
    spec.curve.getTangentAt(t, T);
    if (i > 0) len += P.distanceTo(prev);
    prev.copy(P);
    B.crossVectors(T, ref).normalize();
    N.crossVectors(B, T).normalize();
    D.copy(down).addScaledVector(T, -down.dot(T)).normalize();
    const r = spec.radius(t);
    const dr = spec.droop ? spec.droop(t) : 0;
    const st = spec.stretch ? spec.stretch(t) : 1;
    for (let j = 0; j <= rad; j++) {
      const a = (j / rad) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // section in (B, N) plane, stretched along the projected down vector
      const vx = B.x * ca * r + N.x * sa * r;
      const vy = B.y * ca * r + N.y * sa * r;
      const vz = B.z * ca * r + N.z * sa * r;
      const along = vx * D.x + vy * D.y + vz * D.z;
      const k = along > 0 ? st : 1;
      pos.push(P.x + vx + D.x * along * (k - 1) + D.x * dr, P.y + vy + D.y * along * (k - 1) + D.y * dr, P.z + vz + D.z * along * (k - 1) + D.z * dr);
      uvs.push((j / rad) * Math.PI * 2 * r, len);
      weights.push((t - t0) / (t1 - t0 || 1));
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j;
      const b = a + rad + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const addCap = (ring: number, flip: boolean) => {
    const base = ring * (rad + 1);
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let j = 0; j < rad; j++) {
      cx += pos[(base + j) * 3];
      cy += pos[(base + j) * 3 + 1];
      cz += pos[(base + j) * 3 + 2];
    }
    const ci = pos.length / 3;
    pos.push(cx / rad, cy / rad, cz / rad);
    uvs.push(0, 0);
    weights.push(ring === 0 ? 0 : 1);
    for (let j = 0; j < rad; j++) {
      if (flip) idx.push(ci, base + j + 1, base + j);
      else idx.push(ci, base + j, base + j + 1);
    }
  };
  if (spec.capStart) addCap(0, false);
  if (spec.capEnd) addCap(seg, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('weight', new THREE.Float32BufferAttribute(weights, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Flat strap that lies on the body (normal points away from `centre`). */
export function buildRibbon(points: THREE.Vector3[], width: number, centre: THREE.Vector3, segments = 32) {
  const curve = new THREE.CatmullRomCurve3(points);
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const O = new THREE.Vector3();
  const S = new THREE.Vector3();
  let len = 0;
  const prev = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, P);
    curve.getTangentAt(t, T);
    if (i) len += P.distanceTo(prev);
    prev.copy(P);
    O.copy(P).sub(centre);
    O.addScaledVector(T, -O.dot(T)).normalize();
    S.crossVectors(T, O).normalize();
    const taper = 0.75 + 0.25 * Math.sin(Math.PI * t);
    const w = (width / 2) * taper;
    pos.push(P.x + S.x * w, P.y + S.y * w, P.z + S.z * w, P.x - S.x * w, P.y - S.y * w, P.z - S.z * w);
    uvs.push(0, len, width, len);
    if (i < segments) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function ellipsoid(rx: number, ry: number, rz: number, w = 32, h = 24) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  return g;
}
