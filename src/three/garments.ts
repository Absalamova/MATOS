import * as THREE from 'three';
import { Body } from './body';
import { buildRibbon, buildShell, buildTube, FoldSpec, hashString, smoothstep, ShellSpec } from './geometry';
import { Fabric, GarmentTypeKey } from '../types';

const PI = Math.PI;
const FRONT = PI / 2;
const BACK = -PI / 2;

/** Angular distance between two angles, 0…PI */
const angDist = (a: number, b: number) => {
  let d = Math.abs(a - b) % (2 * PI);
  if (d > PI) d = 2 * PI - d;
  return d;
};

export interface GarmentMaterials {
  main: THREE.Material;
  /** slightly darker facing for lapels, collars, cuffs */
  trim: THREE.Material;
  /** contrasting colour (obi belt, colour-block panel, camisole) */
  contrast: THREE.Material;
  hardware: THREE.Material;
  /** Mondrian dress only */
  mondrian?: THREE.Material;
}

export interface GarmentBuild {
  group: THREE.Group;
  /** meshes whose vertices sway in the wind; value = amplitude multiplier */
  animated: { mesh: THREE.Mesh; amp: number }[];
}

interface Ctx {
  body: Body;
  fabric: Fabric;
  mats: GarmentMaterials;
  /** 0 = stiff canvas … 1 = liquid silk */
  fluid: number;
  seed: number;
  group: THREE.Group;
  animated: { mesh: THREE.Mesh; amp: number }[];
}

function add(ctx: Ctx, g: THREE.BufferGeometry, mat: THREE.Material, amp = 0) {
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  ctx.group.add(m);
  if (amp > 0) ctx.animated.push({ mesh: m, amp });
  return m;
}

function shell(ctx: Ctx, spec: Omit<ShellSpec, 'body'>, mat: THREE.Material, amp = 0) {
  const res = buildShell({ body: ctx.body, ...spec });
  add(ctx, res.geometry, mat, amp);
  return res;
}

function folds(ctx: Ctx, f: Omit<FoldSpec, 'seed'>): FoldSpec {
  return { ...f, seed: ctx.seed };
}

function sleeve(ctx: Ctx, side: 1 | -1, opts: { t0?: number; t1: number; ease: number; extra?: (t: number) => number; droop?: (t: number) => number; stretch?: (t: number) => number }, mat?: THREE.Material, amp = 0) {
  const arm = ctx.body.arm(side);
  const g = buildTube({
    curve: arm.curve,
    t0: opts.t0 ?? 0.0,
    t1: opts.t1,
    radius: (t) => arm.radius(t) + opts.ease + (opts.extra ? opts.extra(t) : 0),
    droop: opts.droop,
    stretch: opts.stretch,
    segments: 36,
    radial: 30,
  });
  return add(ctx, g, mat ?? ctx.mats.main, amp);
}

function strap(ctx: Ctx, pts: THREE.Vector3[], radius: number, mat?: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, 24, radius, 8, false);
  return add(ctx, g, mat ?? ctx.mats.main);
}

/** Wide flat strap over the shoulder. */
function band(ctx: Ctx, pts: THREE.Vector3[], width: number, side: 1 | -1, mat?: THREE.Material) {
  const b = ctx.body;
  const centre = new THREE.Vector3(side * b.section(b.at(1.45)).rx * 0.6, b.at(1.3), 0);
  return add(ctx, buildRibbon(pts, width, centre), mat ?? ctx.mats.main);
}

function button(ctx: Ctx, p: { pos: THREE.Vector3; normal: THREE.Vector3 }, r = 0.009) {
  const g = new THREE.CylinderGeometry(r, r, 0.004, 20);
  g.rotateX(PI / 2);
  const m = new THREE.Mesh(g, ctx.mats.hardware);
  m.position.copy(p.pos).addScaledVector(p.normal, 0.004);
  m.lookAt(m.position.clone().add(p.normal));
  m.castShadow = true;
  ctx.group.add(m);
}

/** Point over the top of the shoulder, between neck and shoulder tip. */
function shoulderTop(ctx: Ctx, side: 1 | -1, out = 0.036) {
  const b = ctx.body;
  const y = b.at(1.418);
  const s = b.section(y);
  return new THREE.Vector3(side * (b.section(b.at(1.45)).rx + out), y + 0.012, (s.zf - s.zb) * 0.3);
}

// ── Neckline helpers ────────────────────────────────────────────────────────

/** V or scoop: dips toward `center` within `half` radians. */
const dip = (theta: number, center: number, half: number, depth: number, power = 1) => {
  const d = angDist(theta, center);
  if (d >= half) return 0;
  return depth * Math.pow(1 - d / half, power);
};

/** Smoothly changes ease from `above` to `below` around a reference level (no visible step). */
const easeAt = (b: Body, ref: number, above: number, below: number) => (y: number) =>
  above + (below - above) * smoothstep(b.at(ref) + 0.05, b.at(ref) - 0.05, y);

// ── Garments ────────────────────────────────────────────────────────────────

function slipDress(ctx: Ctx) {
  const b = ctx.body;
  const top = (th: number) => b.at(1.27) - dip(th, FRONT, 0.75, 0.05, 1.4) - dip(th, BACK, 1.1, 0.07, 1.2);
  const hem = b.at(0.36);
  const flareK = 0.8 + 0.5 * (1 - ctx.fluid);
  const res = shell(
    ctx,
    {
      yTop: top,
      yBottom: () => hem,
      ease: easeAt(b, 0.95, 0.006, 0.01),
      hangFrom: b.at(0.88),
      hangKeep: 0.999,
      flare: (y) => Math.pow(Math.max(0, (b.at(0.88) - y) / 0.52), 1.3) * 0.085 * flareK,
      folds: folds(ctx, { start: b.at(0.86), end: hem, depth: 0.012 + 0.012 * ctx.fluid, count: 8 + Math.round(4 * ctx.fluid), irregular: 0.6, hemWave: 0.01 }),
      windFrom: b.at(0.95),
    },
    ctx.mats.main,
    1,
  );
  for (const side of [1, -1] as const) {
    const f = res.pointAt(FRONT - side * 0.55, top(FRONT - side * 0.55));
    const bk = res.pointAt(BACK + side * 0.55, top(BACK + side * 0.55));
    strap(ctx, [f.pos, shoulderTop(ctx, side, 0.03), bk.pos], 0.0032);
  }
}

function eveningGown(ctx: Ctx) {
  const b = ctx.body;
  const top = (th: number) => b.at(1.31) - dip(th, FRONT, 0.8, 0.13, 1.2) - dip(th, BACK, 1.0, 0.12, 1.1);
  const floor = b.at(0) + 0.012;
  const flareK = 0.85 + 0.4 * (1 - ctx.fluid);
  const res = shell(
    ctx,
    {
      rows: 90,
      cols: 120,
      yTop: top,
      yBottom: () => floor,
      ease: easeAt(b, 0.9, 0.007, 0.012),
      hangFrom: b.at(0.86),
      flare: (y) => Math.pow(Math.max(0, (b.at(0.84) - y) / 0.84), 1.55) * 0.3 * flareK,
      folds: folds(ctx, { start: b.at(0.82), end: floor + 0.1, depth: 0.018 + 0.02 * ctx.fluid, count: 10 + Math.round(5 * ctx.fluid), irregular: 0.7, hemWave: 0.006 }),
      train: { length: 0.42, floorY: floor - 0.006, rows: 10 },
      windFrom: b.at(0.9),
    },
    ctx.mats.main,
    1,
  );
  // wide straps
  for (const side of [1, -1] as const) {
    const f = res.pointAt(FRONT - side * 0.62, top(FRONT - side * 0.62));
    const bk = res.pointAt(BACK + side * 0.62, top(BACK + side * 0.62));
    band(ctx, [f.pos, shoulderTop(ctx, side, 0.04), bk.pos], 0.03, side);
  }
  // waist seam
  shell(ctx, { cols: 96, rows: 3, yTop: () => b.at(1.07), yBottom: () => b.at(1.04), ease: () => 0.011 }, ctx.mats.trim);
}

function oneShoulderGown(ctx: Ctx) {
  const b = ctx.body;
  // high over the left shoulder (theta = PI), down under the right arm (theta = 0)
  const top = (th: number) => b.at(1.255) + 0.15 * b.sy * Math.pow((1 + Math.cos(th - PI)) / 2, 1.3);
  const floor = b.at(0) + 0.012;
  const slitTheta = FRONT - 0.55;
  const res = shell(
    ctx,
    {
      rows: 90,
      cols: 120,
      yTop: top,
      yBottom: () => floor,
      ease: easeAt(b, 0.9, 0.007, 0.011),
      hangFrom: b.at(0.88),
      hangKeep: 0.9995,
      flare: (y) => Math.pow(Math.max(0, (b.at(0.6) - y) / 0.6), 1.4) * 0.07,
      folds: folds(ctx, { start: b.at(0.8), end: floor + 0.1, depth: 0.012 + 0.014 * ctx.fluid, count: 9 + Math.round(4 * ctx.fluid), irregular: 0.6, hemWave: 0.005 }),
      hole: (th, y) => y < b.at(0.62) && angDist(th, slitTheta) < 0.16 * (1 - Math.max(0, y - b.at(0.4)) / b.at(0.62) * 0.4),
      train: { length: 0.2, floorY: floor - 0.006, rows: 6 },
      windFrom: b.at(0.88),
    },
    ctx.mats.main,
    1,
  );
  // shoulder strap over the left shoulder
  const f = res.pointAt(FRONT + 0.7, top(FRONT + 0.7));
  const bk = res.pointAt(BACK - 0.7 + 2 * PI, top(BACK - 0.7));
  band(ctx, [f.pos, shoulderTop(ctx, -1, 0.045), bk.pos], 0.06, -1);
}

function straplessCocktail(ctx: Ctx) {
  const b = ctx.body;
  const top = (th: number) => b.at(1.262) - dip(th, BACK, 1.2, 0.02);
  const hem = (th: number) => b.at(0.6) + 0.015 * Math.sin(th);
  shell(
    ctx,
    {
      yTop: top,
      yBottom: hem,
      ease: easeAt(b, 0.9, 0.005, 0.009),
      hangFrom: b.at(0.86),
      flare: (y) => Math.max(0, (b.at(0.86) - y) / 0.26) * 0.03,
      folds: folds(ctx, { start: b.at(0.82), end: b.at(0.6), depth: 0.005, count: 10, irregular: 0.4 }),
      windFrom: b.at(0.8),
    },
    ctx.mats.main,
    0.4,
  );
  // vertical colour-block panel at centre front, a shade darker
  shell(ctx, { cols: 18, rows: 50, thetaRange: [FRONT - 0.2, FRONT + 0.2], yTop: top, yBottom: hem, ease: easeAt(b, 0.9, 0.005, 0.009), hangFrom: b.at(0.86), flare: (y) => Math.max(0, (b.at(0.86) - y) / 0.26) * 0.03, lift: 0.0025 }, ctx.mats.trim);
  // waterfall drape falling from the back waist to the floor
  const floor = b.at(0) + 0.01;
  shell(
    ctx,
    {
      cols: 60,
      rows: 70,
      thetaRange: [BACK - 0.85, BACK + 0.85],
      yTop: () => b.at(1.06),
      yBottom: (th) => floor + 0.04 * angDist(th, BACK),
      ease: (y) => 0.02 + Math.max(0, b.at(1.0) - y) * 0.05,
      hangFrom: b.at(0.9),
      flare: (y) => Math.pow(Math.max(0, (b.at(0.9) - y) / 0.9), 1.3) * 0.14,
      folds: folds(ctx, { start: b.at(1.0), end: floor + 0.1, depth: 0.02 + 0.015 * ctx.fluid, count: 7, irregular: 0.7, hemWave: 0.01 }),
      train: { length: 0.22, floorY: floor - 0.004, rows: 6 },
      windFrom: b.at(1.02),
    },
    ctx.mats.main,
    1.2,
  );
}

function pleatedDress(ctx: Ctx) {
  const b = ctx.body;
  const top = (th: number) => b.at(1.405) - dip(th, FRONT, 0.75, 0.06, 1.6) - dip(th, BACK, 0.6, 0.02);
  const hem = b.at(0.5);
  const flareK = 0.85 + 0.45 * (1 - ctx.fluid);
  shell(
    ctx,
    {
      rows: 80,
      yTop: top,
      yBottom: () => hem,
      ease: easeAt(b, 1.06, 0.01, 0.012),
      hangFrom: b.at(1.04),
      flare: (y) => Math.max(0, (b.at(1.04) - y) / 0.54) * 0.12 * flareK,
      folds: folds(ctx, { start: b.at(1.04), end: b.at(0.92), depth: 0.009, count: 28, pleats: true }),
      windFrom: b.at(1.0),
      coverShoulders: true,
    },
    ctx.mats.main,
    0.8,
  );
  shell(ctx, { cols: 96, rows: 3, yTop: () => b.at(1.075), yBottom: () => b.at(1.035), ease: () => 0.015 }, ctx.mats.main);
}

function mondrianDress(ctx: Ctx) {
  const b = ctx.body;
  // armholes at the sides, round neck in front
  const top = (th: number) => {
    const side = Math.min(angDist(th, 0), angDist(th, PI));
    const arm = side < 0.75 ? (1 - side / 0.75) : 0;
    return b.at(1.41) - Math.pow(arm, 0.8) * 0.12 * b.sy - dip(th, FRONT, 0.55, 0.05, 1.5);
  };
  shell(
    ctx,
    {
      rows: 76,
      yTop: top,
      yBottom: () => b.at(0.6),
      ease: () => 0.014,
      hangFrom: b.at(1.2),
      hangKeep: 1,
      flare: (y) => Math.max(0, (b.at(0.85) - y) / 0.25) * 0.02,
      windFrom: b.at(0.8),
    },
    ctx.mats.mondrian ?? ctx.mats.main,
    0.3,
  );
}

function shirt(ctx: Ctx) {
  const b = ctx.body;
  const top = (th: number) => b.at(1.448) - dip(th, FRONT, 0.45, 0.035, 1.2);
  const hem = (th: number) => b.at(0.8) + 0.055 * Math.pow(Math.abs(Math.cos(th)), 1.4);
  const res = shell(
    ctx,
    {
      rows: 76,
      yTop: top,
      yBottom: hem,
      ease: (y) => 0.012 + 0.022 * smoothstep(b.at(1.43), b.at(1.36), y),
      hangFrom: b.at(1.22),
      hangKeep: 0.9993,
      shape: (y, th, r) => {
        const pad = smoothstep(b.at(1.3), b.at(1.37), y) * (1 - smoothstep(b.at(1.4), b.at(1.43), y));
        return r + pad * 0.012 * Math.pow(Math.abs(Math.cos(th)), 3);
      },
      folds: folds(ctx, { start: b.at(1.15), end: b.at(0.82), depth: 0.006, count: 7, irregular: 0.5 }),
      windFrom: b.at(1.0),
      coverShoulders: true,
    },
    ctx.mats.main,
    0.35,
  );
  for (const side of [1, -1] as const) {
    sleeve(ctx, side, { t0: 0.04, t1: 0.7, ease: 0.02, extra: (t) => 0.012 * (1 - t) });
    sleeve(ctx, side, { t0: 0.66, t1: 0.71, ease: 0.026 }, ctx.mats.trim);
  }
  // collar: stand + fall, open at the front
  shell(
    ctx,
    {
      cols: 80,
      rows: 10,
      thetaRange: [FRONT + 0.12, FRONT + 2 * PI - 0.12],
      yTop: () => b.at(1.475),
      yBottom: (th) => b.at(1.425) - dip(th, FRONT, 0.7, 0.03),
      ease: (y) => 0.008 + Math.pow(Math.max(0, b.at(1.475) - y) / 0.05, 1.5) * 0.03,
    },
    ctx.mats.trim,
  );
  // placket + buttons
  shell(ctx, { cols: 4, rows: 40, thetaRange: [FRONT - 0.05, FRONT + 0.05], yTop: (th) => top(th) - 0.01, yBottom: hem, ease: (y) => 0.012 + 0.022 * smoothstep(b.at(1.43), b.at(1.36), y), hangFrom: b.at(1.22), hangKeep: 0.9993, lift: 0.002, coverShoulders: true }, ctx.mats.main);
  for (let i = 0; i < 6; i++) {
    const y = b.at(1.38) - i * 0.1 * b.sy;
    const p = res.pointAt(FRONT, y);
    button(ctx, p, 0.0055);
  }
}

function jumpsuit(ctx: Ctx) {
  const b = ctx.body;
  // halter: low at the sides and back, two panels rising over the bust into a deep V
  const top = (th: number) => {
    const panel = Math.max(0, 1 - Math.abs(angDist(th, FRONT) - 0.5) / 0.42);
    const lift = panel * panel * (3 - 2 * panel);
    return b.at(1.255) + lift * 0.08 * b.sy - dip(th, FRONT, 0.42, 0.11, 1.2) - dip(th, BACK, 1.1, 0.05);
  };
  shell(ctx, { rows: 76, yTop: top, yBottom: () => b.at(0.7), ease: (y) => easeAt(b, 1.0, 0.01, 0.014)(y) - 0.008 * smoothstep(b.at(0.8), b.at(0.74), y) }, ctx.mats.main);
  // halter straps
  for (const side of [1, -1] as const) {
    const th = FRONT - side * 0.5;
    const p = buildShell({ body: b, cols: 8, rows: 2, yTop: top, yBottom: top, ease: () => 0.01 }).pointAt(th, top(th));
    const neckBack = new THREE.Vector3(side * 0.03, b.at(1.47), -b.section(b.at(1.47)).zb - 0.004);
    strap(ctx, [p.pos, shoulderTop(ctx, side, -0.005).add(new THREE.Vector3(0, 0.02, 0.01)), neckBack], 0.008);
  }
  // palazzo legs
  const wide = 0.06 + 0.04 * (1 - ctx.fluid);
  for (const side of [1, -1] as const) {
    const legTop = b.at(0.775);
    const floor = b.at(0) + 0.008;
    const hull = (y: number, th: number, out: THREE.Vector2) => {
      const L = b.leg(y);
      const t = Math.max(0, (legTop - y) / (legTop - floor));
      const R = L.r + 0.004 + 0.02 * smoothstep(legTop, legTop - 0.1, y) + (wide + 0.03) * Math.pow(t, 0.9);
      let x = R * Math.cos(th);
      const z = R * Math.sin(th) * 0.92;
      // flatten the inner side so both legs meet at the centre seam
      const maxIn = L.x + 0.003;
      if (x * side < -maxIn) x = -side * maxIn;
      return out.set(x, z);
    };
    shell(
      ctx,
      {
        cols: 64,
        rows: 70,
        yTop: () => legTop,
        yBottom: (th) => floor + 0.008 * Math.sin(th),
        hullFn: hull,
        centerFn: (y) => ({ x: side * b.leg(y).x, z: 0 }),
        ease: () => 0,
        folds: folds(ctx, { start: b.at(0.7), end: floor + 0.1, depth: 0.01 + 0.008 * ctx.fluid, count: 5, irregular: 0.5, hemWave: 0.004 }),
        windFrom: b.at(0.7),
      },
      ctx.mats.main,
      0.7,
    );
  }
  shell(ctx, { cols: 96, rows: 3, yTop: () => b.at(1.08), yBottom: () => b.at(1.035), ease: () => 0.016 }, ctx.mats.trim);
}

function kimono(ctx: Ctx) {
  const b = ctx.body;
  const vHalf = 0.95;
  const neck = (th: number) => {
    const d = angDist(th, FRONT);
    if (d < vHalf) return b.at(1.06) + (b.at(1.455) - b.at(1.06)) * Math.pow(d / vHalf, 0.85);
    return b.at(1.455) - dip(th, BACK, 0.9, 0.012);
  };
  const hem = b.at(0.32);
  shell(
    ctx,
    {
      rows: 90,
      yTop: neck,
      yBottom: () => hem,
      ease: (y) => 0.012 + 0.03 * smoothstep(b.at(1.42), b.at(1.3), y),
      hangFrom: b.at(1.22),
      hangKeep: 0.9996,
      flare: (y) => Math.max(0, (b.at(0.9) - y) / 0.58) * 0.03,
      folds: folds(ctx, { start: b.at(0.95), end: hem, depth: 0.008 + 0.01 * ctx.fluid, count: 6, irregular: 0.5, hemWave: 0.006 }),
      windFrom: b.at(0.95),
      coverShoulders: true,
    },
    ctx.mats.main,
    0.8,
  );
  // collar band along the neckline
  shell(ctx, { cols: 120, rows: 6, yTop: neck, yBottom: (th) => neck(th) - 0.045 * b.sy, ease: (y) => 0.014 + 0.03 * smoothstep(b.at(1.42), b.at(1.3), y), hangFrom: b.at(1.22), hangKeep: 0.9996, lift: 0.004, coverShoulders: true }, ctx.mats.contrast);
  // wide hanging sleeves
  for (const side of [1, -1] as const) {
    sleeve(
      ctx,
      side,
      {
        t0: 0.0,
        t1: 0.52,
        ease: 0.016,
        extra: (t) => 0.075 * smoothstep(0.08, 0.42, t),
        droop: (t) => 0.05 * smoothstep(0.1, 0.5, t),
        stretch: (t) => 1 + 0.9 * smoothstep(0.1, 0.45, t),
      },
      ctx.mats.main,
      0.5,
    );
  }
  // obi belt
  shell(ctx, { cols: 96, rows: 6, yTop: () => b.at(1.11), yBottom: () => b.at(0.99), ease: () => 0.04, lift: 0.006 }, ctx.mats.contrast);
}

function tailoredJacket(ctx: Ctx, long: boolean) {
  const b = ctx.body;
  const stance = long ? b.at(1.17) : b.at(1.09);
  const vHalf = long ? 0.72 : 0.78;
  const neck = (th: number) => {
    const d = angDist(th, FRONT);
    if (d < vHalf) return stance + (b.at(1.452) - stance) * Math.pow(d / vHalf, 0.9);
    return b.at(1.452);
  };
  const hem = long ? b.at(0.42) : b.at(0.84);
  const easeFn = (y: number) => 0.012 + (long ? 0.026 : 0.02) * smoothstep(b.at(1.43), b.at(1.35), y);
  const pads = (y: number, th: number, r: number) => {
    const k = smoothstep(b.at(1.28), b.at(1.36), y) * (1 - smoothstep(b.at(1.4), b.at(1.44), y));
    return r + k * (long ? 0.012 : 0.018) * Math.pow(Math.abs(Math.cos(th)), 3);
  };
  const common = {
    ease: easeFn,
    shape: pads,
    coverShoulders: true,
    hangFrom: long ? b.at(0.88) : undefined,
    flare: long ? (y: number) => Math.max(0, (b.at(0.88) - y) / 0.46) * 0.065 : undefined,
  };
  const res = shell(
    ctx,
    {
      rows: long ? 96 : 70,
      yTop: neck,
      yBottom: () => hem,
      ...common,
      folds: long ? folds(ctx, { start: b.at(0.85), end: hem, depth: 0.007, count: 6, irregular: 0.5, hemWave: 0.004 }) : undefined,
      windFrom: long ? b.at(0.85) : undefined,
    },
    ctx.mats.main,
    long ? 0.5 : 0,
  );
  // lapels lying on the chest along the V
  const lapelW = (th: number) => (long ? 0.09 : 0.075) * b.sy * smoothstep(0.05, 0.45, angDist(th, FRONT));
  shell(ctx, { cols: 60, rows: 8, thetaRange: [FRONT - vHalf, FRONT + vHalf], yTop: neck, yBottom: (th) => neck(th) - lapelW(th), ...common, lift: 0.008 }, ctx.mats.trim);
  // collar around the back of the neck
  shell(
    ctx,
    {
      cols: 60,
      rows: 8,
      thetaRange: [BACK - (PI - vHalf) + 0.02, BACK + (PI - vHalf) - 0.02],
      yTop: () => b.at(long ? 1.49 : 1.48),
      yBottom: () => b.at(1.43),
      ease: (y) => 0.012 + Math.max(0, b.at(1.49) - y) * 0.3,
    },
    ctx.mats.trim,
  );
  // camisole under the V
  shell(ctx, { cols: 30, rows: 16, thetaRange: [FRONT - 0.7, FRONT + 0.7], yTop: () => b.at(1.33), yBottom: () => stance - 0.02, ease: () => 0.004 }, ctx.mats.contrast);
  // sleeves
  for (const side of [1, -1] as const) {
    sleeve(ctx, side, { t0: 0.0, t1: 0.71, ease: long ? 0.026 : 0.022, extra: (t) => (long ? 0.016 : 0.02) * (1 - smoothstep(0, 0.2, t)) });
    if (long) sleeve(ctx, side, { t0: 0.62, t1: 0.66, ease: 0.031 }, ctx.mats.trim);
  }
  // double-breasted buttons
  const rows = long ? [b.at(1.13), b.at(0.98), b.at(0.88)] : [b.at(1.05), b.at(0.97)];
  for (const y of rows) {
    for (const s of [1, -1]) button(ctx, res.pointAt(FRONT + s * 0.2, y), long ? 0.0095 : 0.0085);
  }
  if (long) {
    // belt + buckle
    shell(ctx, { cols: 96, rows: 3, yTop: () => b.at(1.08), yBottom: () => b.at(1.035), ...common, lift: 0.006 }, ctx.mats.main);
    const p = res.pointAt(FRONT, b.at(1.057));
    const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 8, 4), ctx.mats.hardware);
    buckle.rotation.z = PI / 4;
    buckle.scale.set(1.2, 0.9, 1);
    buckle.position.copy(p.pos).addScaledVector(p.normal, 0.012);
    buckle.lookAt(buckle.position.clone().add(p.normal));
    ctx.group.add(buckle);
    // storm flap on the right chest
    shell(ctx, { cols: 16, rows: 8, thetaRange: [FRONT - 0.95, FRONT - 0.45], yTop: neck, yBottom: () => b.at(1.24), ...common, lift: 0.004 }, ctx.mats.main);
  } else {
    // pocket flaps
    for (const s of [1, -1]) {
      shell(ctx, { cols: 10, rows: 3, thetaRange: s > 0 ? [FRONT + 0.5, FRONT + 0.85] : [FRONT - 0.85, FRONT - 0.5], yTop: () => b.at(0.945), yBottom: () => b.at(0.915), ...common, lift: 0.004 }, ctx.mats.trim);
    }
  }
}

const BUILDERS: Record<GarmentTypeKey, (ctx: Ctx) => void> = {
  slip_dress: slipDress,
  evening_gown: eveningGown,
  one_shoulder_gown: oneShoulderGown,
  strapless_cocktail: straplessCocktail,
  pleated_dress: pleatedDress,
  mondrian_dress: mondrianDress,
  shirt,
  jumpsuit,
  kimono,
  blazer: (ctx) => tailoredJacket(ctx, false),
  trench: (ctx) => tailoredJacket(ctx, true),
};

export function buildGarment(key: GarmentTypeKey, body: Body, fabric: Fabric, mats: GarmentMaterials): GarmentBuild {
  const group = new THREE.Group();
  group.name = `garment:${key}`;
  const ctx: Ctx = {
    body,
    fabric,
    mats,
    fluid: Math.min(1, Math.max(0, (fabric.drapeFactor - 6) / 4)),
    seed: hashString(`${key}:${fabric.id}`),
    group,
    animated: [],
  };
  (BUILDERS[key] ?? slipDress)(ctx);
  return { group, animated: ctx.animated };
}
