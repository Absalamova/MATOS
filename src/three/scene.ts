import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BodyMeasurements, ColorOption, Fabric, GarmentTypeKey, LightingPreset } from '../types';
import { Body, DEFAULT_MEASUREMENTS } from './body';
import { buildMannequin, MannequinMaterials } from './mannequin';
import { buildGarment, GarmentBuild, GarmentMaterials } from './garments';
import { fabricMaps, mondrianMap, setMaxAnisotropy } from './fabricTexture';

export type Backdrop = 'light' | 'dark';
export type ViewName = 'front' | 'side' | 'back';

export interface Outfit {
  fabric: Fabric;
  color: ColorOption;
  garment: GarmentTypeKey;
}

const luminance = (hex: string) => {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

/** Everything a fabric needs to look like itself under light. */
function fabricMaterial(fabric: Fabric, color: ColorOption) {
  const silk = fabric.category === 'silk';
  const wool = fabric.category === 'wool';
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color.hex),
    roughness: color.roughness,
    metalness: 0,
    sheen: silk ? 0.9 : wool ? 0.8 : 0.45,
    sheenRoughness: silk ? 0.32 : wool ? 0.75 : 0.6,
    sheenColor: new THREE.Color(color.hex).lerp(new THREE.Color('#ffffff'), silk ? 0.25 : 0.2),
    specularIntensity: silk ? 0.7 : 0.25,
    side: THREE.DoubleSide,
  });
  if (silk) {
    m.anisotropy = 0.35;
    m.clearcoat = fabric.pattern === 'ikat' ? 0.15 : 0.08;
    m.clearcoatRoughness = 0.4;
  }
  return m;
}

const PRESETS: Record<LightingPreset, { key: [number, number, THREE.ColorRepresentation]; fill: [number, THREE.ColorRepresentation]; rim: [number, THREE.ColorRepresentation]; hemi: number; env: number; exposure: number }> = {
  daylight: { key: [2.4, 1, '#ffffff'], fill: [0.8, '#eef3ff'], rim: [0.9, '#ffffff'], hemi: 0.9, env: 0.55, exposure: 1.0 },
  atelier: { key: [2.6, 1, '#ffe4c8'], fill: [0.45, '#d5e2ff'], rim: [1.8, '#ffd9b0'], hemi: 0.45, env: 0.35, exposure: 1.05 },
  evening: { key: [0.35, 0, '#ffd2a8'], fill: [0.18, '#a9b6d6'], rim: [2.2, '#c9d2ff'], hemi: 0.14, env: 0.2, exposure: 1.05 },
};

export class StudioScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private body: Body;
  private mannequin: THREE.Group | null = null;
  private garment: GarmentBuild | null = null;
  private garmentMats: THREE.Material[] = [];
  private garmentTextures: THREE.Texture[] = [];
  private base: Float32Array[] = [];
  private outfit: Outfit | null = null;
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private spot: THREE.SpotLight;
  private hemi: THREE.HemisphereLight;
  private floor: THREE.Mesh;
  private skin: MannequinMaterials;
  private wind = false;
  private windT = 0;
  private visible = true;
  private resizeObs: ResizeObserver;
  private io: IntersectionObserver;
  private clock = new THREE.Timer();
  private envTex: THREE.Texture;
  private disposed = false;
  private buildToken = 0;
  private tween: { from: number; to: number; t: number } | null = null;
  onBusy?: (busy: boolean) => void;

  constructor(private container: HTMLElement) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);
    this.renderer = renderer;
    setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

    const pm = new THREE.PMREMGenerator(renderer);
    this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.scene.environment = this.envTex;

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
    this.body = new Body(DEFAULT_MEASUREMENTS);

    this.hemi = new THREE.HemisphereLight('#ffffff', '#cfc8bd', 0.9);
    this.scene.add(this.hemi);
    this.keyLight = new THREE.DirectionalLight('#ffffff', 2.4);
    this.keyLight.position.set(1.6, 3.2, 2.4);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    const sc = this.keyLight.shadow.camera;
    sc.left = -1.3;
    sc.right = 1.3;
    sc.top = 2.2;
    sc.bottom = -0.4;
    sc.near = 0.5;
    sc.far = 8;
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.02;
    this.keyLight.shadow.radius = 4;
    this.scene.add(this.keyLight);
    this.fillLight = new THREE.DirectionalLight('#eef3ff', 0.8);
    this.fillLight.position.set(-2.4, 1.6, 1.6);
    this.scene.add(this.fillLight);
    this.rimLight = new THREE.DirectionalLight('#ffffff', 0.9);
    this.rimLight.position.set(-0.6, 2.6, -2.6);
    this.scene.add(this.rimLight);
    this.spot = new THREE.SpotLight('#ffd7ad', 0, 8, 0.42, 0.65, 1.2);
    this.spot.position.set(0.4, 3.6, 1.6);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.bias = -0.0004;
    this.scene.add(this.spot);
    this.scene.add(this.spot.target);

    this.floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    this.skin = {
      skin: new THREE.MeshStandardMaterial({ color: '#E7E1D8', roughness: 0.52, metalness: 0 }),
      base: new THREE.MeshStandardMaterial({ color: '#D8D2C9', roughness: 0.45, metalness: 0.05 }),
    };

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.9;
    this.controls.maxDistance = 5;
    this.controls.minPolarAngle = Math.PI * 0.18;
    this.controls.maxPolarAngle = Math.PI * 0.56;
    this.controls.screenSpacePanning = true;
    this.controls.autoRotateSpeed = 1.6;
    this.controls.addEventListener('start', () => {
      this.tween = null;
    });

    this.rebuildMannequin();

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.frame();
    this.io = new IntersectionObserver((e) => {
      this.visible = e[0]?.isIntersecting ?? true;
    });
    this.io.observe(container);
    renderer.setAnimationLoop(this.tick);
    this.setLighting('daylight');
  }

  private tick = () => {
    if (this.disposed || !this.visible || document.hidden) return;
    this.clock.update();
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt * 2.2);
      const e = tw.t < 0.5 ? 2 * tw.t * tw.t : 1 - Math.pow(-2 * tw.t + 2, 2) / 2;
      const az = tw.from + (tw.to - tw.from) * e;
      const off = this.camera.position.clone().sub(this.controls.target);
      const r = Math.hypot(off.x, off.z);
      off.x = Math.sin(az) * r;
      off.z = Math.cos(az) * r;
      this.camera.position.copy(this.controls.target).add(off);
      if (tw.t >= 1) this.tween = null;
    }
    this.controls.update(dt);
    // keep panning near the mannequin
    const t = this.controls.target;
    t.x = THREE.MathUtils.clamp(t.x, -0.35, 0.35);
    t.z = THREE.MathUtils.clamp(t.z, -0.35, 0.35);
    t.y = THREE.MathUtils.clamp(t.y, 0.15, this.body.height + 0.05);
    if (this.wind && this.garment) this.animateWind(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private animateWind(dt: number) {
    this.windT += dt;
    const t = this.windT;
    const strength = this.outfit ? 0.028 * (0.55 + this.outfit.fabric.drapeFactor / 20) * Math.sqrt(180 / this.outfit.fabric.gsm) : 0.03;
    this.garment!.animated.forEach(({ mesh, amp }, i) => {
      const g = mesh.geometry as THREE.BufferGeometry;
      const pos = g.getAttribute('position') as THREE.BufferAttribute;
      const w = g.getAttribute('weight') as THREE.BufferAttribute;
      const thA = g.getAttribute('theta') as THREE.BufferAttribute | undefined;
      const base = this.base[i];
      if (!base) return;
      const a = strength * amp;
      for (let v = 0; v < pos.count; v++) {
        const k = w.getX(v);
        if (k <= 0) continue;
        const x = base[v * 3];
        const y = base[v * 3 + 1];
        const z = base[v * 3 + 2];
        const th = thA ? thA.getX(v) : Math.atan2(z, x);
        const gust = 0.6 + 0.4 * Math.sin(t * 0.7);
        pos.setXYZ(
          v,
          x + a * k * gust * (0.55 + 0.45 * Math.sin(t * 2.1 + th * 2 + y * 5)),
          y + a * k * 0.18 * Math.sin(t * 2.6 + th * 3),
          z + a * k * 0.4 * Math.sin(t * 1.5 + th * 3 + y * 4),
        );
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
    });
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // fit the whole figure on narrow screens
    const fitH = this.body.height + 0.62;
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const distV = fitH / 2 / Math.tan(vfov / 2);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const distH = 1.0 / 2 / Math.tan(hfov / 2);
    this.fitDistance = Math.max(distV, distH);
    this.camera.updateProjectionMatrix();
  }
  private fitDistance = 3.6;

  /** Places the camera in front of the figure. */
  private frame() {
    const ty = this.body.height * 0.5 - 0.04;
    this.controls.target.set(0, ty, 0);
    const d = this.fitDistance;
    this.camera.position.set(d * 0.12, ty + 0.12, d);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  reset() {
    this.tween = null;
    this.resize();
    this.frame();
  }

  view(v: ViewName) {
    const off = this.camera.position.clone().sub(this.controls.target);
    const from = Math.atan2(off.x, off.z);
    let to = v === 'front' ? 0.12 : v === 'side' ? Math.PI / 2 : Math.PI;
    while (to - from > Math.PI) to -= Math.PI * 2;
    while (from - to > Math.PI) to += Math.PI * 2;
    this.tween = { from, to, t: 0 };
  }

  zoom(factor: number) {
    const off = this.camera.position.clone().sub(this.controls.target);
    const len = THREE.MathUtils.clamp(off.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(off.setLength(len));
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on;
  }

  setWind(on: boolean) {
    this.wind = on;
    if (!on) this.restoreBase();
  }

  setBackdrop(b: Backdrop) {
    (this.floor.material as THREE.ShadowMaterial).opacity = b === 'dark' ? 0.45 : 0.18;
    this.skin.base.color.set(b === 'dark' ? '#2B2926' : '#D8D2C9');
  }

  setLighting(p: LightingPreset) {
    const c = PRESETS[p];
    this.keyLight.intensity = c.key[0];
    this.keyLight.castShadow = c.key[1] > 0;
    this.keyLight.color.set(c.key[2]);
    this.fillLight.intensity = c.fill[0];
    this.fillLight.color.set(c.fill[1]);
    this.rimLight.intensity = c.rim[0];
    this.rimLight.color.set(c.rim[1]);
    this.hemi.intensity = c.hemi;
    this.scene.environmentIntensity = c.env;
    this.renderer.toneMappingExposure = c.exposure;
    this.spot.intensity = p === 'evening' ? 30 : 0;
    this.spot.target.position.set(0, this.body.height * 0.55, 0);
  }

  setMeasurements(m: BodyMeasurements) {
    const same = this.body.m.heightCm === m.heightCm && this.body.m.bustCm === m.bustCm && this.body.m.waistCm === m.waistCm && this.body.m.hipsCm === m.hipsCm;
    if (same) return;
    this.body = new Body(m);
    this.rebuildMannequin();
    if (this.outfit) this.setOutfit(this.outfit, true);
    this.resize();
    this.controls.target.y = this.body.height * 0.5 - 0.04;
  }

  private rebuildMannequin() {
    if (this.mannequin) {
      this.scene.remove(this.mannequin);
      this.mannequin.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    this.mannequin = buildMannequin(this.body, this.skin);
    this.scene.add(this.mannequin);
  }

  private restoreBase() {
    this.garment?.animated.forEach(({ mesh }, i) => {
      const base = this.base[i];
      if (!base) return;
      const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      (pos.array as Float32Array).set(base);
      pos.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    });
  }

  private disposeGarment() {
    if (!this.garment) return;
    this.scene.remove(this.garment.group);
    this.garment.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.garmentMats.forEach((m) => m.dispose());
    this.garmentTextures.forEach((t) => t.dispose());
    this.garmentMats = [];
    this.garmentTextures = [];
    this.base = [];
    this.garment = null;
  }

  async setOutfit(o: Outfit, force = false) {
    const prev = this.outfit;
    if (!force && prev && prev.fabric.id === o.fabric.id && prev.color.id === o.color.id && prev.garment === o.garment) return;
    this.outfit = o;
    const token = ++this.buildToken;

    // Mannequin tone keeps contrast with very light fabrics.
    const light = luminance(o.color.hex) > 0.62;
    this.skin.skin.color.set(light ? '#4A4743' : '#E7E1D8');

    const main = fabricMaterial(o.fabric, o.color);
    const trim = main.clone();
    trim.color.multiplyScalar(0.82);
    const contrastHex = luminance(o.color.hex) > 0.45 ? '#2A2724' : '#EFEAE1';
    const contrast = new THREE.MeshPhysicalMaterial({ color: contrastHex, roughness: 0.6, sheen: 0.4, sheenRoughness: 0.6, side: THREE.DoubleSide });
    const hardware = new THREE.MeshStandardMaterial({
      color: o.garment === 'shirt' ? '#EEE8DC' : o.garment === 'trench' ? '#B08D57' : '#2B2622',
      roughness: o.garment === 'trench' ? 0.35 : 0.4,
      metalness: o.garment === 'trench' ? 0.8 : 0,
    });
    const mats: GarmentMaterials = { main, trim, contrast, hardware };
    const extraTex: THREE.Texture[] = [];
    if (o.garment === 'mondrian_dress') {
      const tex = mondrianMap(o.color.hex);
      // u = 0 is the centre front; the layout was drawn with the front at u ≈ 0.5
      tex.offset.set(0.5, -0.5);
      extraTex.push(tex);
      mats.mondrian = new THREE.MeshPhysicalMaterial({ map: tex, roughness: o.color.roughness, sheen: 0.35, sheenRoughness: 0.6, side: THREE.DoubleSide });
    }

    const build = buildGarment(o.garment, this.body, o.fabric, mats);
    if (token !== this.buildToken || this.disposed) {
      [main, trim, contrast, hardware, mats.mondrian].forEach((m) => m?.dispose());
      return;
    }
    this.disposeGarment();
    this.garment = build;
    this.garmentMats = [main, trim, contrast, hardware, ...(mats.mondrian ? [mats.mondrian] : [])];
    this.garmentTextures = extraTex;
    this.base = build.animated.map(({ mesh }) => Float32Array.from((mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array));
    this.scene.add(build.group);

    // Real fabric texture arrives a moment later.
    this.onBusy?.(true);
    try {
      const maps = await fabricMaps(o.fabric, o.color);
      if (token !== this.buildToken || this.disposed) return;
      const rep = 1 / maps.tileMeters;
      for (const m of [main, trim]) {
        const map = maps.map.clone();
        const nrm = maps.normalMap.clone();
        map.repeat.set(rep, rep);
        nrm.repeat.set(rep, rep);
        map.needsUpdate = true;
        nrm.needsUpdate = true;
        this.garmentTextures.push(map, nrm);
        m.map = map;
        m.normalMap = nrm;
        m.normalScale.set(0.6, 0.6);
        // the map carries the colour now
        m.color.set(m === trim ? '#d1d1d1' : '#ffffff');
        m.needsUpdate = true;
      }
      if (mats.mondrian) {
        const nrm = maps.normalMap.clone();
        nrm.repeat.set(rep, rep);
        nrm.needsUpdate = true;
        this.garmentTextures.push(nrm);
        (mats.mondrian as THREE.MeshPhysicalMaterial).normalMap = nrm;
        mats.mondrian.needsUpdate = true;
      }
    } catch {
      /* keep the flat colour */
    } finally {
      if (token === this.buildToken) this.onBusy?.(false);
    }
  }

  /** PNG of the current view (for sharing with a tailor). */
  capture() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObs.disconnect();
    this.io.disconnect();
    this.controls.dispose();
    this.disposeGarment();
    if (this.mannequin) this.mannequin.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.skin.skin.dispose();
    this.skin.base.dispose();
    (this.floor.material as THREE.Material).dispose();
    this.floor.geometry.dispose();
    this.envTex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
