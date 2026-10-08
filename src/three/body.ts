/**
 * Parametric female mannequin, in metres. The body is described by horizontal
 * cross-sections (half width, front depth, back depth) that are interpolated
 * with Catmull–Rom splines, plus tapered limbs. Every garment is built on top
 * of the same functions, so clothes follow the customer's measurements.
 */
import * as THREE from 'three';
import { BodyMeasurements } from '../types';
import { DEFAULT_MEASUREMENTS } from '../lib/measure';

export { DEFAULT_MEASUREMENTS };

const BASE_H = 1.68;
/** Height of the display base the mannequin stands on. */
export const BASE_LIFT = 0.02;

interface Key {
  y: number; // metres for a 1.68 m body
  rx: number;
  zf: number;
  zb: number;
  /** influence of bust / waist / hip measurement on this level */
  b?: number;
  w?: number;
  h?: number;
  /** bust lobes depth (only on the bare mannequin) */
  lobe?: number;
  /** superellipse exponent: 2 = ellipse, higher = boxier (hips) */
  n?: number;
}

// Torso keyframes, bottom (crotch) to top (neck).
const TORSO: Key[] = [
  { y: 0.76, rx: 0.164, zf: 0.088, zb: 0.102, h: 1, n: 2.7 },
  { y: 0.82, rx: 0.17, zf: 0.09, zb: 0.118, h: 1, n: 2.7 },
  { y: 0.88, rx: 0.174, zf: 0.093, zb: 0.126, h: 1, n: 2.5 },
  { y: 0.96, rx: 0.16, zf: 0.088, zb: 0.11, h: 0.6, w: 0.4, n: 2.25 },
  { y: 1.05, rx: 0.128, zf: 0.08, zb: 0.085, w: 1 },
  { y: 1.13, rx: 0.133, zf: 0.092, zb: 0.085, w: 0.5, b: 0.5 },
  { y: 1.205, rx: 0.156, zf: 0.142, zb: 0.09, b: 1, lobe: 0.018 },
  { y: 1.25, rx: 0.158, zf: 0.135, zb: 0.092, b: 1, lobe: 0.012 },
  { y: 1.3, rx: 0.152, zf: 0.105, zb: 0.09, b: 0.6 },
  { y: 1.35, rx: 0.172, zf: 0.078, zb: 0.082, b: 0.3 },
  { y: 1.395, rx: 0.138, zf: 0.062, zb: 0.066, b: 0.2 },
  { y: 1.43, rx: 0.066, zf: 0.055, zb: 0.056 },
  { y: 1.47, rx: 0.051, zf: 0.049, zb: 0.051 },
  { y: 1.53, rx: 0.047, zf: 0.046, zb: 0.05 },
];

export const LEVELS = {
  crotch: 0.76,
  hips: 0.88,
  waist: 1.05,
  underbust: 1.13,
  bust: 1.215,
  armpit: 1.29,
  shoulder: 1.36,
  neckBase: 1.43,
  knee: 0.47,
  floor: 0,
};

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export interface Section {
  rx: number;
  zf: number;
  zb: number;
  lobe: number;
  n?: number;
}

export interface LimbPath {
  curve: THREE.CatmullRomCurve3;
  radius: (t: number) => number;
}

export class Body {
  readonly m: BodyMeasurements;
  /** vertical scale relative to the 1.68 m reference */
  readonly sy: number;
  readonly height: number;
  private keys: Key[];
  private legRScale: number;
  private armRScale: number;

  constructor(m: BodyMeasurements = DEFAULT_MEASUREMENTS) {
    this.m = m;
    this.sy = m.heightCm / 100 / BASE_H;
    this.height = m.heightCm / 100;
    const rb = m.bustCm / DEFAULT_MEASUREMENTS.bustCm;
    const rw = m.waistCm / DEFAULT_MEASUREMENTS.waistCm;
    const rh = m.hipsCm / DEFAULT_MEASUREMENTS.hipsCm;
    const avg = (rb + rw + rh) / 3;
    // Taller bodies are a little wider overall too.
    const hw = Math.pow(this.sy, 0.35);
    this.keys = TORSO.map((k) => {
      const wsum = (k.b || 0) + (k.w || 0) + (k.h || 0);
      const s =
        wsum > 0
          ? 1 + (k.b || 0) * (rb - 1) + (k.w || 0) * (rw - 1) + (k.h || 0) * (rh - 1)
          : 1 + 0.35 * (avg - 1);
      return { ...k, y: k.y * this.sy + BASE_LIFT, rx: k.rx * s * hw, zf: k.zf * s * hw, zb: k.zb * s * hw, lobe: (k.lobe || 0) * rb };
    });
    this.legRScale = Math.pow(rh, 0.85) * hw;
    this.armRScale = Math.pow(avg, 0.6) * hw;
  }

  /** Level helper: converts a reference height (1.68 m body) to this body. */
  at(refY: number) {
    return refY * this.sy + BASE_LIFT;
  }

  get torsoBottom() {
    return this.keys[0].y;
  }
  get torsoTop() {
    return this.keys[this.keys.length - 1].y;
  }

  /** Torso cross-section at height y (clamped to the torso range). */
  section(y: number): Section {
    const k = this.keys;
    if (y <= k[0].y) return { rx: k[0].rx, zf: k[0].zf, zb: k[0].zb, lobe: 0, n: k[0].n };
    if (y >= k[k.length - 1].y) {
      const l = k[k.length - 1];
      return { rx: l.rx, zf: l.zf, zb: l.zb, lobe: 0 };
    }
    let i = 0;
    while (i < k.length - 2 && y > k[i + 1].y) i++;
    const a = k[Math.max(0, i - 1)];
    const b = k[i];
    const c = k[i + 1];
    const d = k[Math.min(k.length - 1, i + 2)];
    const t = (y - b.y) / (c.y - b.y);
    return {
      rx: catmull(a.rx, b.rx, c.rx, d.rx, t),
      zf: catmull(a.zf, b.zf, c.zf, d.zf, t),
      zb: catmull(a.zb, b.zb, c.zb, d.zb, t),
      lobe: Math.max(0, catmull(a.lobe || 0, b.lobe || 0, c.lobe || 0, d.lobe || 0, t)),
      n: Math.max(2, catmull(a.n || 2, b.n || 2, c.n || 2, d.n || 2, t)),
    };
  }

  /** Point on an elliptical section; theta = 0 is the right side (+x), PI/2 the front (+z). */
  static sectionPoint(s: Section, theta: number, lobes: 'none' | 'body' | 'bridge', out = new THREE.Vector2()) {
    const c = Math.cos(theta);
    const sn = Math.sin(theta);
    const k = smooth(-0.35, 0.35, sn);
    const e = 2 / (s.n || 2);
    const cx = Math.sign(c) * Math.pow(Math.abs(c), e);
    const sz = Math.sign(sn) * Math.pow(Math.abs(sn), e);
    let z = sz * (s.zf * k + s.zb * (1 - k));
    if (lobes !== 'none' && s.lobe > 0 && sn > 0) {
      // two soft bumps either side of the centre front; fabric bridges the gap between them
      const off = Math.abs(c) - 0.42;
      const g = lobes === 'bridge' && off < 0 ? 1 : Math.exp(-(off * off) / 0.03);
      z += s.lobe * g * sn * (lobes === 'bridge' ? 1.15 : 1);
    }
    return out.set(s.rx * cx, z);
  }

  /** Leg centre-line x and radius at height y (one leg, positive side). */
  leg(y: number) {
    const sy = this.sy;
    const t = (y - BASE_LIFT) / sy; // back to reference metres
    const keys = [
      [0.0, 0.066, 0.03],
      [0.08, 0.066, 0.034],
      [0.2, 0.069, 0.044],
      [0.32, 0.072, 0.056],
      [0.47, 0.075, 0.052],
      [0.62, 0.081, 0.07],
      [0.76, 0.086, 0.086],
      [0.84, 0.08, 0.062],
    ];
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const a = keys[Math.max(0, i - 1)];
    const b = keys[i];
    const c = keys[i + 1];
    const d = keys[Math.min(keys.length - 1, i + 2)];
    const u = Math.min(1, Math.max(0, (t - b[0]) / (c[0] - b[0])));
    const x = catmull(a[1], b[1], c[1], d[1], u);
    const r = catmull(a[2], b[2], c[2], d[2], u);
    const rs = t > 0.55 ? this.legRScale : 1 + (this.legRScale - 1) * Math.max(0, (t - 0.3) / 0.25);
    return { x: x * Math.pow(this.legRScale, 0.5), r: r * rs };
  }

  /**
   * Radius of the body "hull" seen by a garment at height y and angle theta: the
   * torso above the crotch, the envelope around both legs below it.
   */
  hullPoint(y: number, theta: number, out = new THREE.Vector2(), coverShoulders = false) {
    if (y >= this.torsoBottom) {
      const s = this.section(y);
      // sleeved garments drape over the shoulder joint, not through it
      const sh = coverShoulders ? this.shoulderExtent(y) : 0;
      if (sh > s.rx) s.rx = s.rx + (sh - s.rx) * Math.pow(Math.abs(Math.cos(theta)), 0.5);
      Body.sectionPoint(s, theta, 'bridge', out);
    } else {
      const L = this.leg(y);
      const top = this.section(this.torsoBottom);
      const blend = smooth(this.torsoBottom - 0.12 * this.sy, this.torsoBottom, y);
      const ex = L.x + L.r;
      const s: Section = {
        rx: ex + (top.rx - ex) * blend,
        zf: L.r * 1.02 + (top.zf - L.r * 1.02) * blend,
        zb: L.r * 1.06 + (top.zb - L.r * 1.06) * blend,
        lobe: 0,
        // keep the hip squareness continuous across the crotch: a jump here moves every
        // garment column sideways and crumples hanging skirts into ridges
        n: 2 + ((top.n ?? 2) - 2) * blend,
      };
      Body.sectionPoint(s, theta, 'none', out);
    }
    // Below the crotch the fabric must still clear both thighs. The thighs together form a
    // "stadium" (convex hull of two circles); use its true radial distance. (Using the support
    // function here instead overshoots diagonally and puts two lumps on the front of the hips.)
    const w = smooth(this.torsoBottom + 0.02, this.torsoBottom - 0.05, y);
    if (w > 0) {
      const L = this.leg(Math.min(y, this.at(0.84)));
      const r = out.length() || 1;
      const need = Body.stadiumRadius(L.x, L.r * 1.03, out.x / r, out.y / r);
      if (need > r) out.multiplyScalar(1 + ((need - r) / r) * w);
    }
    return out;
  }

  /** Distance from the centre to the edge of the convex hull of two circles (±a, 0) of radius r, along (c, s). */
  static stadiumRadius(a: number, r: number, c: number, s: number) {
    const ac = Math.abs(c);
    const as = Math.abs(s);
    if (as > 1e-6 && (r / as) * ac <= a) return r / as;
    return a * ac + Math.sqrt(Math.max(0, r * r - a * a * s * s));
  }

  /** Outer x of the shoulder ball at height y (0 outside its range). */
  shoulderExtent(y: number) {
    const cx = this.section(this.at(1.35)).rx - 0.012;
    const cy = this.at(1.365);
    const r = 0.05 * this.armRScale * 1.04 + 0.006;
    const dy = y - cy;
    // below the ball centre the arm continues, keep the envelope wide down to the armpit
    if (dy < 0) {
      // the arm continues below the ball: keep the envelope wide, then let it ease back into
      // the torso over the armhole instead of stepping in (a boxy ledge on sleeved garments)
      return (cx + r * 0.95) * smooth(this.at(1.24), this.at(1.34), y);
    }
    // Above it, fabric runs in a straight line from the base of the neck to the top of the
    // shoulder ball (tangent), like a real shoulder seam, instead of following the ball's
    // cap and leaving a horizontal shelf next to the neck.
    const ny = this.at(1.46);
    const nx = this.section(ny).rx + 0.004;
    if (y >= ny) return 0;
    const dx0 = cx - nx;
    const dy0 = cy - ny;
    const d = Math.hypot(dx0, dy0);
    if (d <= r) return cx + Math.sqrt(Math.max(0, r * r - dy * dy));
    const alpha = Math.asin(r / d);
    const base = Math.atan2(dy0, dx0);
    const len = Math.sqrt(d * d - r * r);
    // the upper of the two tangent lines
    const a1 = base + alpha;
    const a2 = base - alpha;
    const t1 = { x: nx + Math.cos(a1) * len, y: ny + Math.sin(a1) * len };
    const t2 = { x: nx + Math.cos(a2) * len, y: ny + Math.sin(a2) * len };
    const T = t1.y > t2.y ? t1 : t2;
    if (y <= T.y) return cx + Math.sqrt(Math.max(0, r * r - dy * dy));
    return nx + ((y - ny) * (T.x - nx)) / (T.y - ny);
  }

  arm(side: 1 | -1): LimbPath {
    const s = this.sy;
    const y = (v: number) => v * s + BASE_LIFT;
    const sec = this.section(y(1.35));
    const sx = (sec.rx - 0.012) * side;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, y(1.365), -0.004),
      new THREE.Vector3(sx + 0.022 * side, y(1.25), -0.012),
      new THREE.Vector3(sx + 0.056 * side, y(1.07), -0.018),
      new THREE.Vector3(sx + 0.094 * side, y(0.9), 0.004),
      new THREE.Vector3(sx + 0.108 * side, y(0.82), 0.016),
      new THREE.Vector3(sx + 0.112 * side, y(0.74), 0.022),
    ]);
    const k = this.armRScale;
    const radius = (t: number) => {
      // shoulder → elbow → wrist → hand → fingertips
      const pts: [number, number][] = [
        [0, 0.05],
        [0.12, 0.046],
        [0.36, 0.034],
        [0.5, 0.036],
        [0.72, 0.025],
        [0.8, 0.029],
        [0.9, 0.027],
        [1, 0.01],
      ];
      let i = 0;
      while (i < pts.length - 2 && t > pts[i + 1][0]) i++;
      const u = (t - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
      const e = u * u * (3 - 2 * u);
      return (pts[i][1] + (pts[i + 1][1] - pts[i][1]) * e) * k;
    };
    return { curve, radius };
  }

  /** Neck radius used by collars. */
  neck(y: number) {
    const s = this.section(y);
    return { rx: s.rx, rz: (s.zf + s.zb) / 2 };
  }
}
