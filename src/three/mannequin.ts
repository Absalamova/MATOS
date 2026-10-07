import * as THREE from 'three';
import { Body, BASE_LIFT } from './body';
import { buildTube, ellipsoid } from './geometry';

function torsoGeometry(body: Body) {
  const cols = 80;
  const rows = 90;
  const y0 = body.torsoBottom - 0.015;
  const y1 = body.torsoTop;
  const ncol = cols + 1;
  const pos: number[] = [];
  const p = new THREE.Vector2();
  for (let r = 0; r <= rows; r++) {
    const y = y0 + ((y1 - y0) * r) / rows;
    const s = body.section(y);
    for (let c = 0; c < ncol; c++) {
      const th = -Math.PI / 2 + (2 * Math.PI * c) / cols;
      Body.sectionPoint(s, th, 'body', p);
      pos.push(p.x, y, p.y);
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * ncol + c;
      idx.push(a, a + ncol, a + 1, a + 1, a + ncol, a + ncol + 1);
    }
  }
  // close the bottom with a shallow dome
  const centre = pos.length / 3;
  pos.push(0, y0 - 0.02, -0.01);
  for (let c = 0; c < cols; c++) idx.push(centre, c + 1, c);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // weld the back seam normals
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let r = 0; r <= rows; r++) {
    const a = r * ncol;
    const b = a + cols;
    const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
  }
  return g;
}

export interface MannequinMaterials {
  skin: THREE.MeshStandardMaterial;
  base: THREE.MeshStandardMaterial;
}

export function buildMannequin(body: Body, mats: MannequinMaterials) {
  const group = new THREE.Group();
  group.name = 'mannequin';
  const addMesh = (g: THREE.BufferGeometry, m: THREE.Material = mats.skin) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  addMesh(torsoGeometry(body));

  const head = addMesh(ellipsoid(0.071, 0.1, 0.084, 40, 32));
  head.position.set(0, body.at(1.615), 0.01);
  head.rotation.x = -0.08;
  head.scale.multiplyScalar(Math.pow(body.sy, 0.4));

  for (const side of [1, -1] as const) {
    const arm = body.arm(side);
    addMesh(buildTube({ curve: arm.curve, radius: arm.radius, segments: 48, radial: 24, capEnd: true }));
    const shoulder = addMesh(ellipsoid(1, 1, 1, 24, 18));
    const start = arm.curve.getPointAt(0.01);
    const r = arm.radius(0.01) * 0.94;
    shoulder.scale.set(r, r * 1.05, r);
    shoulder.position.copy(start);

    const ys = [0.86, 0.76, 0.62, 0.47, 0.32, 0.2, 0.07].map((v) => body.at(v));
    const pts = ys.map((y) => new THREE.Vector3(side * body.leg(y).x, y, y < body.at(0.5) ? 0.006 : -0.004));
    const curve = new THREE.CatmullRomCurve3(pts);
    const legLen = ys[0] - ys[ys.length - 1];
    addMesh(
      buildTube({
        curve,
        radius: (t) => body.leg(ys[0] - legLen * t).r,
        segments: 60,
        radial: 28,
        capEnd: true,
      }),
    );
    const foot = addMesh(ellipsoid(0.038, 0.026, 0.1, 24, 16));
    foot.position.set(side * body.leg(body.at(0.05)).x, BASE_LIFT + 0.024, 0.04);
    foot.rotation.x = -0.12;
  }

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.31, BASE_LIFT, 72), mats.base);
  base.position.y = BASE_LIFT / 2;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);
  return group;
}
