import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Fabric, GarmentSilhouette, ColorOption, Currency, UnitSystem, Language } from '../types';
import { RotateCw, Sparkles, Wind, Eye, ShoppingBag, Check, Sparkle, Shirt, Compass } from 'lucide-react';

interface Props {
  fabrics: Fabric[];
  garments: GarmentSilhouette[];
  selectedFabric: Fabric;
  selectedGarment: GarmentSilhouette;
  selectedColor: ColorOption;
  onSelectFabric: (fabric: Fabric) => void;
  onSelectGarment: (garment: GarmentSilhouette) => void;
  onSelectColor: (color: ColorOption) => void;
  onAddToCart: (fabric: Fabric, color: ColorOption, meters: number) => void;
  currency: Currency;
  unit: UnitSystem;
  lang: Language;
}

// Ergonomic smooth female mannequin body profile curve
const getBodyProfile = (y: number) => {
  let rx = 0.14; // half width (X radius)
  let rz = 0.10; // half depth (Z radius)
  let cz = 0.0;  // Z center offset

  if (y >= 0.44) {
    // Neck base
    const t = Math.min(1, (y - 0.44) / 0.12);
    rx = 0.055 + (1 - t) * 0.02;
    rz = 0.052 + (1 - t) * 0.018;
    cz = 0.005;
  } else if (y >= 0.36) {
    // Shoulders
    const t = (y - 0.36) / 0.08;
    rx = 0.19 - t * 0.115;
    rz = 0.10 - t * 0.03;
    cz = 0.008;
  } else if (y >= 0.22) {
    // Bust curve
    const t = (y - 0.22) / 0.14;
    const arch = Math.sin(t * Math.PI);
    rx = 0.16 + arch * 0.016;
    rz = 0.105 + arch * 0.036;
    cz = 0.022 * arch;
  } else if (y >= 0.08) {
    // Underbust to waist
    const t = (y - 0.08) / 0.14;
    rx = 0.12 + t * 0.04;
    rz = 0.082 + t * 0.023;
    cz = -0.004 * (1 - t);
  } else if (y >= -0.12) {
    // Waist to hip curve
    const t = (y - (-0.12)) / 0.20;
    rx = 0.12 + (1 - t) * 0.068;
    rz = 0.082 + (1 - t) * 0.05;
    cz = 0.0;
  } else if (y >= -0.40) {
    // Lower pelvis & thigh transition
    const t = (y - (-0.40)) / 0.28;
    rx = 0.148 + t * 0.04;
    rz = 0.105 + t * 0.027;
    cz = 0.0;
  } else {
    rx = 0.14;
    rz = 0.10;
    cz = 0.0;
  }

  return { rx, rz, cz };
};

export const Mannequin3DStudio: React.FC<Props> = ({
  fabrics,
  garments,
  selectedFabric,
  selectedGarment,
  selectedColor,
  onSelectFabric,
  onSelectGarment,
  onSelectColor,
  onAddToCart,
  currency,
  unit,
  lang,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [isWindActive, setIsWindActive] = useState<boolean>(false);
  const [customMeters, setCustomMeters] = useState<number>(selectedGarment.estimatedMeters);

  // Sync custom meters when garment changes
  useEffect(() => {
    setCustomMeters(unit === 'metric' ? selectedGarment.estimatedMeters : selectedGarment.estimatedYards);
  }, [selectedGarment, unit]);

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const mannequinGroupRef = useRef<THREE.Group | null>(null);
  const garmentGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  // Mouse & Touch interaction state for natural 360 orbit & zoom
  const isDraggingRef = useRef<boolean>(false);
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rotationAngleRef = useRef<{ y: number; x: number }>({ y: 0, x: 0.05 });
  const zoomLevelRef = useRef<number>(2.4);

  // Helper to generate fine procedural fabric bump texture
  const generateFabricBumpTexture = (category: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#A0A0A0';
    ctx.strokeStyle = '#606060';
    ctx.lineWidth = 1;

    if (category.includes('silk')) {
      for (let y = 0; y < 256; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }
    } else if (category.includes('twill')) {
      for (let i = -256; i < 512; i += 6) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 256, 256);
        ctx.stroke();
      }
    } else {
      // Crisp linen weave
      for (let x = 0; x < 256; x += 5) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 256);
        ctx.stroke();
      }
      for (let y = 0; y < 256; y += 5) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    return texture;
  };

  // Build a sculpted mannequin form with smooth torso, neck, arms, and pedestal
  const buildRealisticMannequin = (): THREE.Group => {
    const group = new THREE.Group();

    // High-end matte porcelain mannequin material
    const mannequinMaterial = new THREE.MeshStandardMaterial({
      color: 0xF2EAE1,
      roughness: 0.65,
      metalness: 0.05,
    });

    const brassMaterial = new THREE.MeshStandardMaterial({
      color: 0x9E7E52,
      roughness: 0.35,
      metalness: 0.85,
    });

    const castIronMaterial = new THREE.MeshStandardMaterial({
      color: 0x1A1816,
      roughness: 0.7,
      metalness: 0.4,
    });

    // 1. Smooth Continuous Torso
    const height = 0.84;
    const geo = new THREE.CylinderGeometry(0.06, 0.14, height, 56, 42, true);
    const pos = geo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < pos.count; i++) {
      const rawY = pos.getY(i);
      const absY = rawY + 0.04;
      const origX = pos.getX(i);
      const origZ = pos.getZ(i);
      const angle = Math.atan2(origZ, origX);

      const { rx, rz, cz } = getBodyProfile(absY);
      const vx = rx * Math.cos(angle);
      const vz = rz * Math.sin(angle) + cz;

      pos.setX(i, vx);
      pos.setY(i, absY);
      pos.setZ(i, vz);
    }
    geo.computeVertexNormals();
    const torsoMesh = new THREE.Mesh(geo, mannequinMaterial);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    group.add(torsoMesh);

    // 2. Head & Swan Neck
    const neckGeo = new THREE.CylinderGeometry(0.044, 0.055, 0.12, 28);
    const neckMesh = new THREE.Mesh(neckGeo, mannequinMaterial);
    neckMesh.position.y = 0.49;
    neckMesh.castShadow = true;
    group.add(neckMesh);

    const headGeo = new THREE.SphereGeometry(0.092, 32, 28);
    headGeo.scale(0.85, 1.16, 0.92);
    const headMesh = new THREE.Mesh(headGeo, mannequinMaterial);
    headMesh.position.set(0, 0.63, 0.01);
    headMesh.castShadow = true;
    group.add(headMesh);

    // 3. Smooth Arms in Natural Couture Pose
    [-1, 1].forEach((sign) => {
      const armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sign * 0.18, 0.36, 0.01),
        new THREE.Vector3(sign * 0.22, 0.22, 0.01),
        new THREE.Vector3(sign * 0.235, 0.08, -0.01),
        new THREE.Vector3(sign * 0.23, -0.08, 0.015),
        new THREE.Vector3(sign * 0.22, -0.22, 0.03),
      ]);
      const armGeo = new THREE.TubeGeometry(armCurve, 28, 0.024, 16, false);
      const armMesh = new THREE.Mesh(armGeo, mannequinMaterial);
      armMesh.castShadow = true;
      group.add(armMesh);
    });

    // 4. Smooth Legs
    [-0.075, 0.075].forEach((legX) => {
      const legCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(legX, -0.38, 0.0),
        new THREE.Vector3(legX * 0.95, -0.60, 0.01),
        new THREE.Vector3(legX * 0.90, -0.82, -0.01),
        new THREE.Vector3(legX * 0.88, -0.98, 0.01),
      ]);
      const legGeo = new THREE.TubeGeometry(legCurve, 24, 0.038, 16, false);
      const legMesh = new THREE.Mesh(legGeo, mannequinMaterial);
      legMesh.castShadow = true;
      group.add(legMesh);
    });

    // 5. Atelier Stand Pedestal & Brass Collar
    const neckCollarGeo = new THREE.CylinderGeometry(0.046, 0.054, 0.04, 28);
    const neckCollar = new THREE.Mesh(neckCollarGeo, brassMaterial);
    neckCollar.position.y = 0.54;
    group.add(neckCollar);

    const basePlatformGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.04, 36);
    const basePlatform = new THREE.Mesh(basePlatformGeo, castIronMaterial);
    basePlatform.position.y = -1.02;
    basePlatform.receiveShadow = true;
    group.add(basePlatform);

    const standPoleGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.65, 20);
    const standPole = new THREE.Mesh(standPoleGeo, brassMaterial);
    standPole.position.y = -0.68;
    group.add(standPole);

    return group;
  };

  // Build tailor-fitted 3D couture garment group
  const buildGarmentGroup = (
    typeKey: string,
    fabric: Fabric,
    color: ColorOption
  ): THREE.Group => {
    const garmentGroup = new THREE.Group();

    // High-fidelity PBR fabric material
    const bumpTexture = generateFabricBumpTexture(fabric.category);
    const fabricMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color.hex),
      roughness: color.roughness ?? 0.85,
      metalness: color.metalness ?? 0.05,
      clearcoat: fabric.category.includes('silk') ? 0.35 : 0.0,
      clearcoatRoughness: 0.15,
      sheen: 1.0,
      sheenColor: new THREE.Color(color.hex).offsetHSL(0, 0, 0.2),
      bumpMap: bumpTexture || undefined,
      bumpScale: 0.006,
      side: THREE.DoubleSide,
    });

    switch (typeKey) {
      // 1. Slip Dress
      case 'slip_dress': {
        const totalHeight = 1.08;
        const geo = new THREE.CylinderGeometry(0.13, 0.36, totalHeight, 48, 36, true);
        const pos = geo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
          const rawY = pos.getY(i);
          let absY = rawY - 0.16;
          const origX = pos.getX(i);
          const origZ = pos.getZ(i);
          const angle = Math.atan2(origZ, origX);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          const topLimit = sinA > 0 ? 0.32 - Math.abs(cosA) * 0.04 : 0.28;
          if (absY > topLimit) absY = topLimit;

          const { rx, rz, cz } = getBodyProfile(Math.max(-0.32, absY));
          let gRx = rx + 0.016;
          let gRz = rz + 0.016;

          if (absY < -0.05) {
            const t = (-0.05 - absY) / 0.65;
            const flare = Math.pow(t, 1.4) * 0.16;
            gRx += flare;
            gRz += flare;
            const ripple = Math.sin(angle * 8) * 0.016 * t;
            gRx += ripple;
            gRz += ripple;
          }

          let vx = gRx * cosA;
          let vz = gRz * sinA + cz;

          if (Number.isFinite(vx)) pos.setX(i, vx);
          if (Number.isFinite(absY)) pos.setY(i, absY);
          if (Number.isFinite(vz)) pos.setZ(i, vz);
        }

        geo.computeVertexNormals();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        garmentGroup.add(mainMesh);

        // Thin Straps
        [-0.075, 0.075].forEach((strapX) => {
          const strapCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(strapX, 0.31, 0.11),
            new THREE.Vector3(strapX * 1.15, 0.40, 0.05),
            new THREE.Vector3(strapX * 1.25, 0.43, -0.01),
            new THREE.Vector3(strapX * 0.95, 0.36, -0.07),
            new THREE.Vector3(strapX * 0.85, 0.28, -0.09),
          ]);
          const strapGeo = new THREE.TubeGeometry(strapCurve, 20, 0.004, 8, false);
          garmentGroup.add(new THREE.Mesh(strapGeo, fabricMaterial));
        });
        break;
      }

      // 2. Evening Gown (Maxi)
      case 'evening_gown': {
        const totalHeight = 1.44;
        const geo = new THREE.CylinderGeometry(0.14, 0.64, totalHeight, 56, 44, true);
        const pos = geo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
          const rawY = pos.getY(i);
          let absY = rawY - 0.30;
          const origX = pos.getX(i);
          const origZ = pos.getZ(i);
          const angle = Math.atan2(origZ, origX);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          const topLimit = sinA > 0 ? 0.36 + Math.abs(cosA) * 0.03 : 0.32;
          if (absY > topLimit) absY = topLimit;

          const { rx, rz, cz } = getBodyProfile(Math.max(-0.32, absY));
          let gRx = rx + 0.016;
          let gRz = rz + 0.016;

          // Mermaid Flare from knee to floor
          if (absY < -0.28) {
            const t = (-0.28 - absY) / 0.74;
            const flare = Math.pow(t, 1.8) * 0.32;
            gRx += flare;
            gRz += flare;
            const fold = Math.sin(angle * 10) * 0.032 * Math.pow(t, 1.2);
            gRx += fold;
            gRz += fold;
          }

          let vx = gRx * cosA;
          let vz = gRz * sinA + cz;

          if (Number.isFinite(vx)) pos.setX(i, vx);
          if (Number.isFinite(absY)) pos.setY(i, absY);
          if (Number.isFinite(vz)) pos.setZ(i, vz);
        }

        geo.computeVertexNormals();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        garmentGroup.add(mainMesh);
        break;
      }

      // 3. Tailored Blazer (Smooth, integrated sleeves)
      case 'blazer': {
        const totalHeight = 0.68;
        const geo = new THREE.CylinderGeometry(0.16, 0.23, totalHeight, 48, 36, true);
        const pos = geo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
          const rawY = pos.getY(i);
          let absY = rawY + 0.10;
          const origX = pos.getX(i);
          const origZ = pos.getZ(i);
          const angle = Math.atan2(origZ, origX);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          const { rx, rz, cz } = getBodyProfile(Math.max(-0.32, absY));
          let gRx = rx + 0.024;
          let gRz = rz + 0.024;

          // Structured shoulder pads
          if (absY > 0.36) {
            gRx += 0.022;
          }

          let vx = gRx * cosA;
          let vz = gRz * sinA + cz;

          if (Number.isFinite(vx)) pos.setX(i, vx);
          if (Number.isFinite(absY)) pos.setY(i, absY);
          if (Number.isFinite(vz)) pos.setZ(i, vz);
        }

        geo.computeVertexNormals();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        garmentGroup.add(mainMesh);

        // Smoothly fitted arm sleeves
        [-1, 1].forEach((sign) => {
          const sleeveCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(sign * 0.19, 0.36, 0.01),
            new THREE.Vector3(sign * 0.228, 0.22, 0.01),
            new THREE.Vector3(sign * 0.24, 0.08, -0.01),
            new THREE.Vector3(sign * 0.236, -0.04, 0.015),
          ]);
          const sleeveGeo = new THREE.TubeGeometry(sleeveCurve, 20, 0.034, 16, false);
          garmentGroup.add(new THREE.Mesh(sleeveGeo, fabricMaterial));
        });
        break;
      }

      // 4. Belted Trench Coat
      case 'trench': {
        const totalHeight = 1.18;
        const geo = new THREE.CylinderGeometry(0.16, 0.38, totalHeight, 48, 36, true);
        const pos = geo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
          const rawY = pos.getY(i);
          let absY = rawY - 0.12;
          const origX = pos.getX(i);
          const origZ = pos.getZ(i);
          const angle = Math.atan2(origZ, origX);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          const { rx, rz, cz } = getBodyProfile(Math.max(-0.32, absY));
          let gRx = rx + 0.026;
          let gRz = rz + 0.026;

          if (absY < -0.08) {
            const t = (-0.08 - absY) / 0.70;
            gRx += t * 0.18;
            gRz += t * 0.18;
          }

          let vx = gRx * cosA;
          let vz = gRz * sinA + cz;

          if (Number.isFinite(vx)) pos.setX(i, vx);
          if (Number.isFinite(absY)) pos.setY(i, absY);
          if (Number.isFinite(vz)) pos.setZ(i, vz);
        }

        geo.computeVertexNormals();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        garmentGroup.add(mainMesh);

        // Trench Sleeves
        [-1, 1].forEach((sign) => {
          const sleeveCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(sign * 0.19, 0.36, 0.01),
            new THREE.Vector3(sign * 0.23, 0.20, 0.01),
            new THREE.Vector3(sign * 0.24, 0.04, -0.01),
            new THREE.Vector3(sign * 0.235, -0.10, 0.015),
          ]);
          const sleeveGeo = new THREE.TubeGeometry(sleeveCurve, 20, 0.036, 16, false);
          garmentGroup.add(new THREE.Mesh(sleeveGeo, fabricMaterial));
        });

        // Belt Buckle Loop
        const beltGeo = new THREE.TorusGeometry(0.14, 0.015, 12, 32);
        const beltMesh = new THREE.Mesh(beltGeo, fabricMaterial);
        beltMesh.rotation.x = Math.PI / 2;
        beltMesh.position.set(0, 0.10, 0.01);
        garmentGroup.add(beltMesh);
        break;
      }

      // Default: Fallback to Elegant Dress
      default: {
        const totalHeight = 1.15;
        const geo = new THREE.CylinderGeometry(0.14, 0.42, totalHeight, 48, 36, true);
        const pos = geo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
          const rawY = pos.getY(i);
          let absY = rawY - 0.16;
          const origX = pos.getX(i);
          const origZ = pos.getZ(i);
          const angle = Math.atan2(origZ, origX);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          const { rx, rz, cz } = getBodyProfile(Math.max(-0.32, absY));
          let gRx = rx + 0.018;
          let gRz = rz + 0.018;

          if (absY < -0.04) {
            const t = (-0.04 - absY) / 0.68;
            gRx += t * 0.20;
            gRz += t * 0.20;
            gRx += Math.sin(angle * 8) * 0.02 * t;
            gRz += Math.sin(angle * 8) * 0.02 * t;
          }

          let vx = gRx * cosA;
          let vz = gRz * sinA + cz;

          if (Number.isFinite(vx)) pos.setX(i, vx);
          if (Number.isFinite(absY)) pos.setY(i, absY);
          if (Number.isFinite(vz)) pos.setZ(i, vz);
        }

        geo.computeVertexNormals();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        garmentGroup.add(mainMesh);
        break;
      }
    }

    return garmentGroup;
  };

  // Update garment in Three.js scene
  const updateGarmentInScene = (
    garment: GarmentSilhouette,
    fabric: Fabric,
    color: ColorOption
  ) => {
    if (!mannequinGroupRef.current) return;

    if (garmentGroupRef.current) {
      mannequinGroupRef.current.remove(garmentGroupRef.current);
      garmentGroupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
        if ((child as THREE.Mesh).material) {
          const mat = (child as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      garmentGroupRef.current = null;
    }

    const newGarmentGroup = buildGarmentGroup(garment.typeKey, fabric, color);
    mannequinGroupRef.current.add(newGarmentGroup);
    garmentGroupRef.current = newGarmentGroup;
  };

  // Mount Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x181513);
    sceneRef.current = scene;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const aspect = height > 0 ? width / height : 1.33;

    const camera = new THREE.PerspectiveCamera(36, aspect, 0.1, 100);
    camera.position.set(0, 0.08, zoomLevelRef.current);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xfff3e6, 0.95);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.2);
    keyLight.position.set(2.5, 4.0, 3.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdce7f8, 0.9);
    fillLight.position.set(-2.5, 2.0, 2.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffedd8, 1.8);
    rimLight.position.set(0, 3.0, -3.0);
    scene.add(rimLight);

    // Floor Platform
    const floorGeo = new THREE.CircleGeometry(2.4, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1E1B18,
      roughness: 0.6,
      metalness: 0.2,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -1.04;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Mannequin Setup
    const mannequinGroup = new THREE.Group();
    mannequinGroup.add(buildRealisticMannequin());
    scene.add(mannequinGroup);
    mannequinGroupRef.current = mannequinGroup;

    updateGarmentInScene(selectedGarment, selectedFabric, selectedColor);

    // Animation Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      if (cameraRef.current) {
        cameraRef.current.position.z = zoomLevelRef.current;
        cameraRef.current.lookAt(0, -0.05, 0);
      }

      if (mannequinGroupRef.current) {
        if (isRotating && !isDraggingRef.current) {
          rotationAngleRef.current.y += 0.006;
        }
        mannequinGroupRef.current.rotation.y = rotationAngleRef.current.y;
        mannequinGroupRef.current.rotation.x = rotationAngleRef.current.x;

        if (isWindActive && garmentGroupRef.current) {
          const t = clockRef.current.getElapsedTime();
          garmentGroupRef.current.rotation.z = Math.sin(t * 2.2) * 0.018;
          garmentGroupRef.current.rotation.y = Math.cos(t * 1.8) * 0.015;
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update garment whenever props change
  useEffect(() => {
    updateGarmentInScene(selectedGarment, selectedFabric, selectedColor);
  }, [selectedGarment, selectedFabric, selectedColor]);

  // Touch and mouse drag handlers for 360 orbit
  const handlePointerDown = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    isDraggingRef.current = true;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - prevMousePosRef.current.x;
    const deltaY = e.clientY - prevMousePosRef.current.y;

    rotationAngleRef.current.y += deltaX * 0.009;
    rotationAngleRef.current.x = Math.max(-0.45, Math.min(0.45, rotationAngleRef.current.x + deltaY * 0.007));

    if (mannequinGroupRef.current) {
      mannequinGroupRef.current.rotation.y = rotationAngleRef.current.y;
      mannequinGroupRef.current.rotation.x = rotationAngleRef.current.x;
    }
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * 0.0015;
    zoomLevelRef.current = Math.max(1.3, Math.min(3.8, zoomLevelRef.current + delta));
  };

  const resetView = () => {
    rotationAngleRef.current = { y: 0, x: 0.05 };
    zoomLevelRef.current = 2.4;
    if (mannequinGroupRef.current) {
      mannequinGroupRef.current.rotation.y = 0;
      mannequinGroupRef.current.rotation.x = 0.05;
    }
  };

  // Pricing calculations
  const unitPrice = currency === 'UZS' ? selectedFabric.priceUZS : currency === 'USD' ? selectedFabric.priceUSD : selectedFabric.priceEUR;
  const subtotal = Math.round(unitPrice * customMeters * 10) / 10;
  const formatCurrency = (val: number) => {
    if (currency === 'UZS') return `${new Intl.NumberFormat('uz-UZ').format(val)} so‘m`;
    if (currency === 'USD') return `$${val.toFixed(2)}`;
    return `€${val.toFixed(2)}`;
  };

  return (
    <section id="studio3d" className="relative bg-[#141210] text-[#EDE7DE] py-8 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Studio Grid: Clean Uzum Market Style Step-by-Step Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-stretch">
          
          {/* Left Panel: Intuitive Controls for Buyers & Sellers */}
          <div className="lg:col-span-5 bg-[#1C1815] border border-[#2D2621] rounded-3xl p-5 sm:p-7 flex flex-col justify-between space-y-6 shadow-xl">
            
            <div className="space-y-6">
              
              {/* Step 1: Fabric Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-[#A89D91] font-bold">
                    {lang === 'uz' ? '1. Matoni tanlang:' : lang === 'ru' ? '1. Выберите ткань:' : '1. Select Fabric:'}
                  </label>
                  <span className="text-[11px] font-mono text-[#CF6E4C] font-bold">{selectedFabric.gsm} GSM</span>
                </div>
                <select
                  value={selectedFabric.id}
                  onChange={(e) => {
                    const fab = fabrics.find((f) => f.id === e.target.value);
                    if (fab) {
                      onSelectFabric(fab);
                      onSelectColor(fab.colors[0]);
                    }
                  }}
                  className="w-full bg-[#13110F] border border-[#3A322A] rounded-2xl px-4 py-3 text-xs font-semibold text-white focus:outline-none focus:border-[#CF6E4C] transition cursor-pointer"
                >
                  {fabrics.map((f) => {
                    const fPrice = currency === 'UZS' ? f.priceUZS : currency === 'USD' ? f.priceUSD : f.priceEUR;
                    return (
                      <option key={f.id} value={f.id} className="bg-[#1C1815] text-white">
                        {f.name} — {f.gsm} GSM ({formatCurrency(fPrice)} /m)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Step 2: Color Swatches - Uzum Market Style 1-Click Changing */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-[#A89D91] font-bold">
                    {lang === 'uz' ? '2. Rangini tanlang:' : lang === 'ru' ? '2. Выберите цвет:' : '2. Select Colorway:'}
                  </label>
                  <span className="text-xs text-white font-bold">{selectedColor.name[lang]}</span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5 pt-1">
                  {selectedFabric.colors.map((c) => {
                    const isSelected = selectedColor.id === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => onSelectColor(c)}
                        className={`p-2 rounded-2xl border transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'border-[#CF6E4C] bg-[#2A221C] ring-2 ring-[#CF6E4C]/50 shadow-md scale-105'
                            : 'border-[#332A23] bg-[#14110E] hover:border-[#524438] hover:scale-102'
                        }`}
                        title={c.name[lang]}
                      >
                        <span
                          className="w-8 h-8 rounded-full border-2 border-white/80 shadow-md flex items-center justify-center transition-transform"
                          style={{ backgroundColor: c.hex }}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                        </span>
                        <span className="text-[10px] text-[#DDD5C7] truncate max-w-full text-center font-medium">
                          {c.name[lang].split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Garment Silhouette Selection (Clean Cards) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-[#A89D91] font-bold">
                    {lang === 'uz' ? '3. Kiyim fasoni (Model):' : lang === 'ru' ? '3. Фасон изделия:' : '3. Garment Silhouette:'}
                  </label>
                  <span className="text-[11px] font-mono text-[#CF6E4C]">
                    ~{selectedGarment.estimatedMeters} {unit === 'metric' ? 'metr' : 'yd'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {garments.slice(0, 6).map((g) => {
                    const isSelected = selectedGarment.id === g.id;
                    return (
                      <button
                        key={g.id}
                        onClick={() => onSelectGarment(g)}
                        className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'border-[#CF6E4C] bg-[#2A221C] ring-1 ring-[#CF6E4C]'
                            : 'border-[#332A23] bg-[#14110E] hover:border-[#524438]'
                        }`}
                      >
                        <span className="font-serif font-bold text-xs text-white line-clamp-1">
                          {g.name[lang]}
                        </span>
                        <span className="text-[10px] text-[#A89D91] font-mono mt-1">
                          ~{unit === 'metric' ? `${g.estimatedMeters} m` : `${g.estimatedYards} yd`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* More Garments Dropdown */}
                {garments.length > 6 && (
                  <select
                    value={selectedGarment.id}
                    onChange={(e) => {
                      const g = garments.find((item) => item.id === e.target.value);
                      if (g) onSelectGarment(g);
                    }}
                    className="w-full mt-2.5 bg-[#13110F] border border-[#3A322A] rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-[#CF6E4C] transition cursor-pointer"
                  >
                    <option value="" disabled>Boshqa fasonlar ro‘yxati...</option>
                    {garments.map((g) => (
                      <option key={g.id} value={g.id} className="bg-[#1C1815] text-white">
                        {g.name[lang]} (~{g.estimatedMeters}m)
                      </option>
                    ))}
                  </select>
                )}
              </div>

            </div>

            {/* Step 4: Meterage Adjuster & Add To Cart Button */}
            <div className="bg-[#14110E] p-4 sm:p-5 rounded-2xl border border-[#2D251F] space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">
                  {lang === 'uz' ? 'Kerakli metraj:' : 'Required yardage:'}
                </span>
                <span className="font-serif font-bold text-base text-[#CF6E4C]">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCustomMeters((m) => Math.max(0.5, Math.round((m - 0.5) * 10) / 10))}
                  className="w-10 h-10 rounded-xl bg-[#221D18] hover:bg-[#302821] text-white font-bold text-base transition flex items-center justify-center cursor-pointer border border-[#3A322A]"
                >
                  -
                </button>
                <div className="flex-grow bg-[#0F0D0B] border border-[#3A322A] rounded-xl py-2 text-center">
                  <span className="font-mono font-bold text-base text-white">{customMeters.toFixed(1)}</span>
                  <span className="text-xs text-[#A89D91] ml-1">{unit === 'metric' ? 'metr' : 'yard'}</span>
                </div>
                <button
                  onClick={() => setCustomMeters((m) => Math.round((m + 0.5) * 10) / 10)}
                  className="w-10 h-10 rounded-xl bg-[#221D18] hover:bg-[#302821] text-white font-bold text-base transition flex items-center justify-center cursor-pointer border border-[#3A322A]"
                >
                  +
                </button>
              </div>

              <button
                onClick={() => onAddToCart(selectedFabric, selectedColor, customMeters)}
                className="w-full bg-[#CF6E4C] hover:bg-[#B85D3B] text-white font-bold py-3.5 px-4 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg text-xs uppercase tracking-wider cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>
                  {lang === 'uz' ? 'Savatga qo‘shish' : lang === 'ru' ? 'В корзину для пошива' : 'Add to Shopping Bag'}
                </span>
              </button>
            </div>

          </div>

          {/* Right 3D Viewport Stage */}
          <div className="lg:col-span-7 bg-[#181513] border border-[#2D2621] rounded-3xl p-4 sm:p-6 flex flex-col justify-between relative overflow-hidden shadow-2xl min-h-[500px] lg:min-h-[620px]">
            
            {/* Viewport Top Bar: Friendly, Non-Technical Controls */}
            <div className="flex items-center justify-between gap-2 border-b border-[#2C241F] pb-3.5 z-20">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-mono text-white font-bold">
                  3D Drape Studio (360°)
                </span>
              </div>

              {/* Simplified Action Buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Auto-Rotate */}
                <button
                  onClick={() => setIsRotating(!isRotating)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    isRotating ? 'bg-[#CF6E4C] border-[#CF6E4C] text-white shadow-xs' : 'bg-[#12100E] border-[#302821] text-[#A89D91]'
                  }`}
                  title="360° Avto aylantirish"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">{lang === 'uz' ? 'Aylantirish' : 'Auto 360°'}</span>
                </button>

                {/* Wind Breeze */}
                <button
                  onClick={() => setIsWindActive(!isWindActive)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    isWindActive ? 'bg-[#3A2A45] border-[#9368B7] text-[#D8B4F8]' : 'bg-[#12100E] border-[#302821] text-[#A89D91]'
                  }`}
                  title="Shamol tebranishi"
                >
                  <Wind className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">{lang === 'uz' ? 'Shamol' : 'Breeze'}</span>
                </button>

                {/* Reset View */}
                <button
                  onClick={resetView}
                  className="p-2 rounded-xl bg-[#12100E] border border-[#302821] text-[#A89D91] hover:text-white transition cursor-pointer"
                  title="Boshlang‘ich markazga qaytarish"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 3D WebGL Canvas Container */}
            <div
              ref={mountRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              className="flex-grow w-full h-[400px] sm:h-[480px] lg:h-full relative cursor-grab active:cursor-grabbing select-none touch-none rounded-2xl overflow-hidden my-2"
            >
              {/* User Instruction Banner */}
              <div className="absolute bottom-3 left-3 z-20 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 text-[11px] text-[#D8CFBF] pointer-events-none flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#CF6E4C]" />
                <span>{lang === 'uz' ? '360° burish uchun suring' : 'Drag to rotate 360°'}</span>
              </div>
            </div>

            {/* Fabric Details Footer Bar */}
            <div className="pt-3 border-t border-[#2A221C] flex items-center justify-between text-xs text-[#A89D91] z-20">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{selectedFabric.name}</span>
                <span>•</span>
                <span className="text-[#CF6E4C] font-mono">{selectedColor.name[lang]}</span>
              </div>
              <span className="font-mono text-[11px] text-[#887D70]">
                Drape: {selectedFabric.drapeFactor}/10
              </span>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
