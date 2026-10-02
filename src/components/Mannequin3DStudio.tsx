import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Fabric, GarmentSilhouette, ColorOption, Currency, UnitSystem, Language } from '../types';
import { RotateCw, Sparkles, Wind, Eye, ZoomIn, ZoomOut, ShoppingBag, Check, Layers, Sliders, Move, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Focus, RefreshCw, Crosshair, Compass } from 'lucide-react';

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

// Ergonomic, smooth human body profile function
// Generates continuous cross-section radii and spine offset for any vertical Y coordinate
export const getBodyProfile = (y: number, style: 'female_model' | 'stockman' | 'studio_form' | 'runway' | 'hourglass' = 'female_model') => {
  const curvy = (style === 'studio_form' || style === 'hourglass') ? 1.15 : style === 'stockman' ? 1.05 : 1.0;
  let rx = 0.14; // half width (X radius)
  let rz = 0.10; // half depth (Z radius)
  let cz = 0.0;  // Z center offset (spine lordosis / chest projection)

  if (y >= 0.44) {
    // Neck base to clavicle
    const t = Math.min(1, (y - 0.44) / 0.12);
    rx = 0.055 + (1 - t) * 0.022;
    rz = 0.052 + (1 - t) * 0.018;
    cz = 0.005;
  } else if (y >= 0.36) {
    // Shoulders & Clavicle slope
    const t = (y - 0.36) / 0.08;
    rx = 0.188 * curvy - t * 0.115;
    rz = 0.098 - t * 0.028;
    cz = 0.008;
  } else if (y >= 0.24) {
    // Bust curve
    const t = (y - 0.24) / 0.12;
    const arch = Math.sin(t * Math.PI);
    rx = (0.158 + arch * 0.018) * curvy;
    rz = (0.105 + arch * 0.038) * curvy;
    cz = 0.024 * arch;
  } else if (y >= 0.10) {
    // Underbust to waist
    const t = (y - 0.10) / 0.14;
    rx = (0.118 + t * 0.04) * curvy;
    rz = 0.080 + t * 0.025;
    cz = -0.006 * (1 - t);
  } else if (y >= -0.08) {
    // Waist to full hip
    const t = (y - (-0.08)) / 0.18;
    rx = (0.118 + (1 - t) * 0.068) * curvy;
    rz = 0.080 + (1 - t) * 0.052;
    cz = 0.0;
  } else if (y >= -0.32) {
    // Lower pelvis & thigh taper
    const t = (y - (-0.32)) / 0.24;
    rx = (0.145 + t * 0.041) * curvy;
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
  const [modelPose, setModelPose] = useState<'female_model' | 'stockman' | 'studio_form'>('female_model');
  const [lightingPreset, setLightingPreset] = useState<'daylight' | 'atelier' | 'evening'>('atelier');
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [customMeters, setCustomMeters] = useState<number>(selectedGarment.estimatedMeters);

  // Advanced Viewport Camera Interaction states: Orbit, Pan, Zoom
  const [interactionMode, setInteractionMode] = useState<'orbit' | 'pan' | 'zoom'>('orbit');
  const [activeFocus, setActiveFocus] = useState<'full' | 'neckline' | 'waist' | 'hem' | 'heels'>('full');
  const [currentZoomPercent, setCurrentZoomPercent] = useState<number>(100);

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
  const lightsRef = useRef<{
    ambient: THREE.AmbientLight;
    key: THREE.DirectionalLight;
    fill: THREE.DirectionalLight;
    rim: THREE.DirectionalLight;
  } | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  // Mouse & Touch interaction state for 360 orbit, smooth panning and pinch zoom
  const panOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0.10 });
  const isDraggingRef = useRef<boolean>(false);
  const dragModeRef = useRef<'orbit' | 'pan' | 'zoom'>('orbit');
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rotationAngleRef = useRef<{ y: number; x: number }>({ y: 0, x: 0.05 });
  const zoomLevelRef = useRef<number>(2.4);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistRef = useRef<number | null>(null);

  // Helper to generate procedural fabric bump texture
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
      // Fine satin weave lines
      for (let y = 0; y < 256; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }
    } else if (category.includes('twill')) {
      // 45-degree twill lines
      for (let i = -256; i < 512; i += 6) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 256, 256);
        ctx.stroke();
      }
    } else if (category.includes('wool')) {
      // Soft brushed noise
      for (let i = 0; i < 3500; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const grey = Math.floor(110 + Math.random() * 45);
        ctx.fillStyle = `rgb(${grey},${grey},${grey})`;
        ctx.fillRect(x, y, 2, 2);
      }
    } else {
      // Linen criss-cross weave slubs
      for (let x = 0; x < 256; x += 6) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 256);
        ctx.stroke();
      }
      for (let y = 0; y < 256; y += 6) {
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

  // Build a seamless, organic continuous torso geometry
  const createSeamlessTorsoGeometry = (style: 'runway' | 'stockman' | 'hourglass') => {
    const height = 0.82; // from y = -0.36 to +0.46
    const geo = new THREE.CylinderGeometry(0.06, 0.14, height, 56, 42, true);
    const pos = geo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < pos.count; i++) {
      const rawY = pos.getY(i);
      const absY = rawY + 0.05; // maps to -0.36 to +0.46
      const origX = pos.getX(i);
      const origZ = pos.getZ(i);
      const angle = Math.atan2(origZ, origX);

      const { rx, rz, cz } = getBodyProfile(absY, style);
      const vx = rx * Math.cos(angle);
      const vz = rz * Math.sin(angle) + cz;

      pos.setX(i, vx);
      pos.setY(i, absY);
      pos.setZ(i, vz);
    }

    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  };

  // Build a single, seamless, continuous organic human arm mesh
  const createSeamlessHumanArm = (isRight: boolean, material: THREE.Material): THREE.Mesh => {
    const sign = isRight ? 1 : -1;
    // Anatomical landmarks along the female fashion arm from shoulder to fingertips
    const landmarks = [
      { t: 0.00, cx: sign * 0.180, cy: 0.370, cz: 0.006, rx: 0.034, rz: 0.034 }, // Shoulder apex
      { t: 0.10, cx: sign * 0.198, cy: 0.330, cz: 0.006, rx: 0.032, rz: 0.032 }, // Deltoid peak
      { t: 0.24, cx: sign * 0.218, cy: 0.235, cz: 0.002, rx: 0.027, rz: 0.026 }, // Upper Bicep / Tricep
      { t: 0.42, cx: sign * 0.232, cy: 0.125, cz: -0.006, rx: 0.023, rz: 0.022 }, // Elbow joint
      { t: 0.58, cx: sign * 0.240, cy: 0.020, cz: 0.005, rx: 0.025, rz: 0.021 }, // Forearm muscle fullness
      { t: 0.74, cx: sign * 0.238, cy: -0.085, cz: 0.015, rx: 0.020, rz: 0.016 }, // Lower forearm
      { t: 0.85, cx: sign * 0.234, cy: -0.145, cz: 0.022, rx: 0.016, rz: 0.011 }, // Slender fashion wrist
      { t: 0.93, cx: sign * 0.230, cy: -0.185, cz: 0.027, rx: 0.018, rz: 0.008 }, // Delicate palm
      { t: 1.00, cx: sign * 0.226, cy: -0.235, cz: 0.032, rx: 0.005, rz: 0.003 }, // Soft fingertips
    ];

    const rings = 28;
    const radial = 18;
    const positions: number[] = [];
    const indices: number[] = [];

    const getPointAtT = (t: number) => {
      if (t <= landmarks[0].t) return landmarks[0];
      if (t >= landmarks[landmarks.length - 1].t) return landmarks[landmarks.length - 1];
      for (let i = 0; i < landmarks.length - 1; i++) {
        const p0 = landmarks[i];
        const p1 = landmarks[i + 1];
        if (t >= p0.t && t <= p1.t) {
          const f = (t - p0.t) / (p1.t - p0.t);
          const s = (1 - Math.cos(f * Math.PI)) / 2;
          return {
            cx: p0.cx + (p1.cx - p0.cx) * s,
            cy: p0.cy + (p1.cy - p0.cy) * s,
            cz: p0.cz + (p1.cz - p0.cz) * s,
            rx: p0.rx + (p1.rx - p0.rx) * s,
            rz: p0.rz + (p1.rz - p0.rz) * s,
          };
        }
      }
      return landmarks[0];
    };

    for (let r = 0; r < rings; r++) {
      const t = r / (rings - 1);
      const pt = getPointAtT(t);

      for (let a = 0; a < radial; a++) {
        const theta = (a / radial) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        positions.push(pt.cx + pt.rx * cosT, pt.cy, pt.cz + pt.rz * sinT);
      }
    }

    for (let r = 0; r < rings - 1; r++) {
      for (let a = 0; a < radial; a++) {
        const nextA = (a + 1) % radial;
        const p1 = r * radial + a;
        const p2 = (r + 1) * radial + a;
        const p3 = (r + 1) * radial + nextA;
        const p4 = r * radial + nextA;

        indices.push(p1, p2, p3);
        indices.push(p1, p3, p4);
      }
    }

    // Top cap (shoulder apex dome)
    const topCenterIdx = positions.length / 3;
    const topPt = landmarks[0];
    positions.push(topPt.cx, topPt.cy + 0.015, topPt.cz);
    for (let a = 0; a < radial; a++) {
      const nextA = (a + 1) % radial;
      indices.push(topCenterIdx, a, nextA);
    }

    // Bottom cap (fingertips)
    const bottomCenterIdx = positions.length / 3;
    const botPt = landmarks[landmarks.length - 1];
    positions.push(botPt.cx, botPt.cy - 0.005, botPt.cz);
    const lastRingStart = (rings - 1) * radial;
    for (let a = 0; a < radial; a++) {
      const nextA = (a + 1) % radial;
      indices.push(bottomCenterIdx, lastRingStart + nextA, lastRingStart + a);
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // Build a single, seamless, continuous organic human leg mesh
  const createSeamlessHumanLeg = (legSide: number, material: THREE.Material): THREE.Mesh => {
    const landmarks = [
      { t: 0.00, cx: legSide, cy: -0.32, cz: 0.000, rx: 0.062, rz: 0.058 }, // Pelvis junction
      { t: 0.22, cx: legSide, cy: -0.42, cz: 0.002, rx: 0.052, rz: 0.048 }, // Mid-Thigh
      { t: 0.44, cx: legSide, cy: -0.54, cz: 0.008, rx: 0.038, rz: 0.036 }, // Knee apex
      { t: 0.64, cx: legSide, cy: -0.68, cz: -0.006, rx: 0.040, rz: 0.036 }, // Calf muscle curve
      { t: 0.85, cx: legSide, cy: -0.84, cz: 0.000, rx: 0.026, rz: 0.023 }, // Lower shin
      { t: 1.00, cx: legSide, cy: -0.94, cz: 0.002, rx: 0.021, rz: 0.018 }, // Ankle
    ];

    const rings = 24;
    const radial = 18;
    const positions: number[] = [];
    const indices: number[] = [];

    const getPointAtT = (t: number) => {
      if (t <= landmarks[0].t) return landmarks[0];
      if (t >= landmarks[landmarks.length - 1].t) return landmarks[landmarks.length - 1];
      for (let i = 0; i < landmarks.length - 1; i++) {
        const p0 = landmarks[i];
        const p1 = landmarks[i + 1];
        if (t >= p0.t && t <= p1.t) {
          const f = (t - p0.t) / (p1.t - p0.t);
          const s = (1 - Math.cos(f * Math.PI)) / 2;
          return {
            cx: p0.cx + (p1.cx - p0.cx) * s,
            cy: p0.cy + (p1.cy - p0.cy) * s,
            cz: p0.cz + (p1.cz - p0.cz) * s,
            rx: p0.rx + (p1.rx - p0.rx) * s,
            rz: p0.rz + (p1.rz - p0.rz) * s,
          };
        }
      }
      return landmarks[0];
    };

    for (let r = 0; r < rings; r++) {
      const t = r / (rings - 1);
      const pt = getPointAtT(t);

      for (let a = 0; a < radial; a++) {
        const theta = (a / radial) * Math.PI * 2;
        positions.push(pt.cx + pt.rx * Math.cos(theta), pt.cy, pt.cz + pt.rz * Math.sin(theta));
      }
    }

    for (let r = 0; r < rings - 1; r++) {
      for (let a = 0; a < radial; a++) {
        const nextA = (a + 1) % radial;
        const p1 = r * radial + a;
        const p2 = (r + 1) * radial + a;
        const p3 = (r + 1) * radial + nextA;
        const p4 = r * radial + nextA;

        indices.push(p1, p2, p3);
        indices.push(p1, p3, p4);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // Build couture mannequin matching world-atelier standards & Sketchfab Female 2500 Base Mesh
  const buildRealisticMannequin = (style: 'female_model' | 'stockman' | 'studio_form'): THREE.Group => {
    const group = new THREE.Group();

    // Matte porcelain or ecru linen skin/fabric material
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: style === 'stockman' ? 0xF2ECE2 : 0xF6EDE4,
      roughness: style === 'stockman' ? 0.76 : 0.58,
      metalness: 0.02,
      bumpMap: style === 'stockman' ? generateFabricBumpTexture('linen') || undefined : undefined,
      bumpScale: 0.003,
    });

    // Dark walnut wood material for Stockman finial / base
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x3A2618,
      roughness: 0.45,
      metalness: 0.1,
    });

    // Brushed brass/gold metal material
    const brassMaterial = new THREE.MeshStandardMaterial({
      color: 0xD4AF37,
      roughness: 0.32,
      metalness: 0.85,
    });

    // Sleek stiletto pumps material
    const shoeMaterial = new THREE.MeshStandardMaterial({
      color: 0x141315,
      roughness: 0.25,
      metalness: 0.5,
    });

    const darkPedestalMaterial = new THREE.MeshStandardMaterial({
      color: 0x1A1715,
      roughness: 0.5,
      metalness: 0.2,
    });

    // 1. Stage Base Platform (Round luxury bevelled runway pedestal)
    const baseGeo = new THREE.CylinderGeometry(0.52, 0.56, 0.05, 40);
    const baseMesh = new THREE.Mesh(baseGeo, darkPedestalMaterial);
    baseMesh.position.y = -1.05;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // 2. Seamless Organic Torso
    const torsoGeo = createSeamlessTorsoGeometry(style === 'female_model' ? 'runway' : style === 'stockman' ? 'stockman' : 'hourglass');
    const torsoMesh = new THREE.Mesh(torsoGeo, skinMaterial);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    group.add(torsoMesh);

    if (style === 'stockman') {
      // Stockman Paris 1867 Authentic Atelier Dress Form Features:
      // Walnut turned neck cap with brass collar ring
      const neckCapGeo = new THREE.CylinderGeometry(0.048, 0.056, 0.07, 32);
      const neckCapMesh = new THREE.Mesh(neckCapGeo, woodMaterial);
      neckCapMesh.position.y = 0.495;
      neckCapMesh.castShadow = true;
      group.add(neckCapMesh);

      const finialKnobGeo = new THREE.SphereGeometry(0.038, 24, 20);
      const finialKnob = new THREE.Mesh(finialKnobGeo, woodMaterial);
      finialKnob.position.y = 0.55;
      group.add(finialKnob);

      const brassRingGeo = new THREE.TorusGeometry(0.054, 0.008, 16, 32);
      const brassRing = new THREE.Mesh(brassRingGeo, brassMaterial);
      brassRing.position.y = 0.46;
      brassRing.rotation.x = Math.PI / 2;
      group.add(brassRing);

      // Turned Walnut Shoulder End-Caps
      [-0.19, 0.19].forEach((sx) => {
        const capGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.015, 24);
        const cap = new THREE.Mesh(capGeo, woodMaterial);
        cap.position.set(sx, 0.38, 0);
        cap.rotation.z = Math.PI / 2;
        group.add(cap);
      });

      // Central Stand Rod in Antique Brass
      const standPoleGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.72, 24);
      const standPole = new THREE.Mesh(standPoleGeo, brassMaterial);
      standPole.position.y = -0.68;
      standPole.castShadow = true;
      group.add(standPole);

      // Adjustment dial wheel
      const dialWheelGeo = new THREE.TorusGeometry(0.055, 0.009, 16, 28);
      const dialWheel = new THREE.Mesh(dialWheelGeo, brassMaterial);
      dialWheel.position.y = -0.42;
      dialWheel.rotation.x = Math.PI / 2;
      group.add(dialWheel);

      // Tripod Cast-Iron Feet
      for (let a = 0; a < 3; a++) {
        const footGeo = new THREE.CylinderGeometry(0.012, 0.018, 0.38, 16);
        const foot = new THREE.Mesh(footGeo, woodMaterial);
        const ang = (a * 2 * Math.PI) / 3;
        foot.position.set(Math.cos(ang) * 0.18, -0.96, Math.sin(ang) * 0.18);
        foot.rotation.z = Math.cos(ang) * 0.35;
        foot.rotation.x = Math.sin(ang) * -0.35;
        group.add(foot);
      }
    } else if (style === 'studio_form') {
      // Studio Form: Clean dress form on modern pedestal
      const neckCapGeo = new THREE.CylinderGeometry(0.046, 0.054, 0.06, 28);
      const neckCapMesh = new THREE.Mesh(neckCapGeo, brassMaterial);
      neckCapMesh.position.y = 0.49;
      group.add(neckCapMesh);

      const standPole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.72, 24), brassMaterial);
      standPole.position.y = -0.68;
      group.add(standPole);
    } else {
      // Female 2500 Base Mesh (Sketchfab Fashion Silhouette):
      // 1. Proud Swan Neck (smoothly bridging torso and head)
      const neckGeo = new THREE.CylinderGeometry(0.044, 0.056, 0.12, 28);
      const neckMesh = new THREE.Mesh(neckGeo, skinMaterial);
      neckMesh.position.y = 0.49;
      neckMesh.castShadow = true;
      group.add(neckMesh);

      // 2. Sculpted Couture Head (Graceful oval cranial structure with delicate chin & jawline)
      const headGeo = new THREE.SphereGeometry(0.096, 36, 30);
      headGeo.scale(0.84, 1.15, 0.92);
      const headMesh = new THREE.Mesh(headGeo, skinMaterial);
      headMesh.position.set(0, 0.635, 0.01);
      headMesh.rotation.x = 0.04;
      headMesh.castShadow = true;
      group.add(headMesh);

      // Sleek Haute Couture Chignon / Hair Bun at back of head
      const bunGeo = new THREE.SphereGeometry(0.046, 24, 20);
      bunGeo.scale(1.1, 0.9, 0.85);
      const bunMesh = new THREE.Mesh(bunGeo, skinMaterial);
      bunMesh.position.set(0, 0.665, -0.075);
      group.add(bunMesh);

      // 3. Seamless Anatomical Human Arms (Single continuous mesh per arm, zero gaps or floating rods)
      group.add(createSeamlessHumanArm(true, skinMaterial));
      group.add(createSeamlessHumanArm(false, skinMaterial));

      // 4. Seamless Anatomical Human Legs (Single continuous mesh per leg + high-heel stiletto pumps)
      [-0.076, 0.076].forEach((legSide) => {
        // Continuous Leg
        group.add(createSeamlessHumanLeg(legSide, skinMaterial));

        // Black High-Heel Stiletto Pump
        const shoeBodyGeo = new THREE.ConeGeometry(0.030, 0.095, 16);
        shoeBodyGeo.scale(0.85, 0.5, 1.25);
        const shoe = new THREE.Mesh(shoeBodyGeo, shoeMaterial);
        shoe.position.set(legSide, -0.99, 0.04);
        shoe.rotation.x = Math.PI / 2 + 0.15;
        shoe.castShadow = true;
        group.add(shoe);

        // Stiletto Spike Heel
        const spikeGeo = new THREE.CylinderGeometry(0.004, 0.003, 0.10, 12);
        const spike = new THREE.Mesh(spikeGeo, shoeMaterial);
        spike.position.set(legSide, -0.985, -0.02);
        group.add(spike);
      });
    }

    return group;
  };

  // Build tailor-fitted 3D couture garment group tailored to the body profile
  const buildGarmentGroup = (
    typeKey: string,
    fabric: Fabric,
    color: ColorOption,
    wireframe: boolean,
    style: 'female_model' | 'stockman' | 'studio_form' | 'runway' | 'hourglass'
  ): THREE.Group => {
    const garmentGroup = new THREE.Group();

    // High-fidelity PBR fabric material with double-sided rendering
    const bumpTexture = generateFabricBumpTexture(fabric.category);
    const fabricMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color.hex),
      roughness: color.roughness ?? 0.8,
      metalness: color.metalness ?? 0.04,
      bumpMap: bumpTexture || undefined,
      bumpScale: 0.007,
      side: THREE.DoubleSide,
      wireframe: wireframe,
    });

    // Accent/contrast material (e.g. for buttons, lapel piping)
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0x1A1816,
      roughness: 0.4,
      metalness: 0.3,
      side: THREE.DoubleSide,
    });

    switch (typeKey) {
      case 'one_shoulder_gown': {
        // Asymmetric One-Shoulder Runway Slit Gown (matching the reference photo)
        const totalHeight = 1.44; // spans from floor y = -1.00 to shoulder y = 0.44
        const geo = new THREE.CylinderGeometry(0.12, 0.48, totalHeight, 56, 44, true);
        const pos = geo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
          const rawY = pos.getY(i);
          let absY = rawY - 0.28; // centers around body coordinates
          const origX = pos.getX(i);
          const origZ = pos.getZ(i);
          const angle = Math.atan2(origZ, origX);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          // Asymmetric diagonal couture neckline:
          // Right shoulder (cosA > 0): smoothly drapes over right shoulder up to y = 0.43
          // Front chest (sinA > 0): cleanly curves across above the bust (y = 0.365) with zero clipping
          // Left underarm (cosA < 0): drapes gracefully under left armhole at y = 0.24
          const topMaxY = 0.34 + cosA * 0.09 + (sinA > 0 ? 0.025 : -0.02);
          if (absY > topMaxY) {
            absY = topMaxY;
          }

          // Bottom hem limit at floor puddling
          if (absY < -1.02) absY = -1.02;

          const { rx, rz, cz } = getBodyProfile(Math.max(-0.32, absY), style);
          let gRx = rx + 0.018; // generous couture fitted ease
          let gRz = rz + 0.018;

          // Waist cinching around y = 0.12
          const distToWaist = Math.abs(absY - 0.12);
          if (distToWaist < 0.15) {
            const cinch = (0.15 - distToWaist) * 0.08;
            gRx -= cinch;
            gRz -= cinch;
          }

          let vx = gRx * cosA;
          let vz = gRz * sinA + cz;

          // Below hips: flare into evening column skirt
          if (absY < -0.06) {
            const t = Math.min(1, (-0.06 - absY) / 0.94);
            const flare = Math.pow(t, 1.7) * 0.24;
            vx += cosA * flare;
            vz += sinA * flare;

            // Genuine High Leg Slit on the Left Leg!
            // In left-front quadrant (cosA < -0.08 and sinA > 0.08):
            if (cosA < -0.08 && sinA > 0.08) {
              const slitProgress = Math.min(1, Math.abs(absY + 0.06) * 2.8);
              // Part the fabric outward to the side seam, cleanly opening the slit
              vx -= slitProgress * 0.09;
              vz += slitProgress * 0.025;
            }

            // Fluted drape ripples
            const fold = Math.sin(angle * 10) * 0.024 * Math.pow(t, 1.3);
            vx += cosA * fold;
            vz += sinA * fold;
          }

          if (Number.isFinite(vx)) pos.setX(i, vx);
          if (Number.isFinite(absY)) pos.setY(i, absY);
          if (Number.isFinite(vz)) pos.setZ(i, vz);
        }

        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        mainMesh.receiveShadow = true;
        garmentGroup.add(mainMesh);
        break;
      }

      case 'slip_dress': {
        // Minimalist Bias-Cut Slip Dress
        const totalHeight = 1.05; // from y = -0.70 to y = 0.35
        const geo = new THREE.CylinderGeometry(0.13, 0.32, totalHeight, 48, 36, true);
        const pos = geo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
          const rawY = pos.getY(i);
          let absY = rawY - 0.18;
          const origX = pos.getX(i);
          const origZ = pos.getZ(i);
          const angle = Math.atan2(origZ, origX);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          // Scoop/cowl neckline dipping in front center
          const topLimit = sinA > 0 ? 0.31 - Math.abs(cosA) * 0.05 : 0.27;
          if (absY > topLimit) absY = topLimit;

          const { rx, rz, cz } = getBodyProfile(Math.max(-0.32, absY), style);
          let gRx = rx + 0.014;
          let gRz = rz + 0.014;

          // Sinuous bias drape
          if (absY < -0.04) {
            const t = (-0.04 - absY) / 0.66;
            const flare = Math.pow(t, 1.4) * 0.12;
            gRx += flare;
            gRz += flare;
            const ripple = Math.sin(angle * 8 + absY * 4) * 0.018 * t;
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
        geo.computeBoundingSphere();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        garmentGroup.add(mainMesh);

        // Twin 3D Spaghetti Straps
        [-0.075, 0.075].forEach((strapX) => {
          const strapCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(strapX, 0.31, 0.11),
            new THREE.Vector3(strapX * 1.15, 0.40, 0.06),
            new THREE.Vector3(strapX * 1.25, 0.435, 0.0),
            new THREE.Vector3(strapX * 1.05, 0.38, -0.07),
            new THREE.Vector3(strapX * 0.85, 0.27, -0.09),
          ]);
          const strapGeo = new THREE.TubeGeometry(strapCurve, 24, 0.004, 8, false);
          const strapMesh = new THREE.Mesh(strapGeo, fabricMaterial);
          garmentGroup.add(strapMesh);
        });
        break;
      }

      case 'evening_gown': {
        // Architectural Evening Maxi Column / Mermaid Gown
        const totalHeight = 1.42; // from floor -1.02 to bust 0.38
        const geo = new THREE.CylinderGeometry(0.14, 0.62, totalHeight, 56, 44, true);
        const pos = geo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
          const rawY = pos.getY(i);
          let absY = rawY - 0.31;
          const origX = pos.getX(i);
          const origZ = pos.getZ(i);
          const angle = Math.atan2(origZ, origX);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          // Sweetheart neckline contour
          const topLimit = sinA > 0 ? 0.35 + Math.abs(cosA) * 0.04 : 0.32;
          if (absY > topLimit) absY = topLimit;

          const { rx, rz, cz } = getBodyProfile(Math.max(-0.32, absY), style);
          let gRx = rx + 0.015;
          let gRz = rz + 0.015;

          // Mermaid/trumpet dramatic flare expanding from knee to floor
          if (absY < -0.35) {
            const t = (-0.35 - absY) / 0.67;
            const flare = Math.pow(t, 2.0) * 0.34;
            gRx += flare;
            gRz += flare;
            // 12 deep cascading flute ripples
            const fold = Math.sin(angle * 12) * 0.038 * Math.pow(t, 1.4);
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
        geo.computeBoundingSphere();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        garmentGroup.add(mainMesh);
        break;
      }

      case 'blazer': {
        // Sharp Double-Breasted Tailored Blazer with Structured Lapels & Sleeves
        const totalHeight = 0.62; // from y = -0.18 to y = 0.44
        const geo = new THREE.CylinderGeometry(0.16, 0.22, totalHeight, 48, 32, true);
        const pos = geo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
          const rawY = pos.getY(i);
          let absY = rawY + 0.13;
          const origX = pos.getX(i);
          const origZ = pos.getZ(i);
          const angle = Math.atan2(origZ, origX);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          const { rx, rz, cz } = getBodyProfile(absY, style);
          let gRx = rx + 0.024; // structured jacket ease
          let gRz = rz + 0.024;

          // Padded shoulders
          if (absY > 0.38) {
            gRx += 0.02;
          }

          // Lapel ridge projection in front V-neck
          let vzExtra = 0;
          if (sinA > 0.4 && Math.abs(cosA) < 0.6 && absY > 0.16) {
            vzExtra = 0.022;
          }

          let vx = gRx * cosA;
          let vz = gRz * sinA + cz + vzExtra;

          if (Number.isFinite(vx)) pos.setX(i, vx);
          if (Number.isFinite(absY)) pos.setY(i, absY);
          if (Number.isFinite(vz)) pos.setZ(i, vz);
        }

        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        garmentGroup.add(mainMesh);

        // Peaked Lapels (left and right folded collar panels)
        [-0.07, 0.07].forEach((sideX) => {
          const lapelGeo = new THREE.BoxGeometry(0.045, 0.22, 0.012);
          const lapel = new THREE.Mesh(lapelGeo, fabricMaterial);
          lapel.position.set(sideX, 0.28, 0.125);
          lapel.rotation.z = sideX > 0 ? -0.22 : 0.22;
          lapel.rotation.y = sideX > 0 ? 0.15 : -0.15;
          garmentGroup.add(lapel);
        });

        // Tailored Jacket Sleeves (aligned with natural fashion A-pose arms)
        [-0.19, 0.19].forEach((armSide) => {
          const isRight = armSide > 0;
          const sign = isRight ? -1 : 1;
          const sleeveGeo = new THREE.CylinderGeometry(0.044, 0.034, 0.32, 20);
          const sleeve = new THREE.Mesh(sleeveGeo, fabricMaterial);
          sleeve.position.set(armSide + (isRight ? 0.038 : -0.038), 0.24, 0.005);
          sleeve.rotation.z = sign * 0.30;
          sleeve.castShadow = true;
          garmentGroup.add(sleeve);
        });

        // 4 Horn / Gold Buttons
        [-0.025, 0.025].forEach((bx) => {
          [0.18, 0.10].forEach((by) => {
            const btnGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.004, 16);
            const btn = new THREE.Mesh(btnGeo, accentMaterial);
            btn.position.set(bx, by, 0.11);
            btn.rotation.x = Math.PI / 2;
            garmentGroup.add(btn);
          });
        });
        break;
      }

      case 'trench': {
        // Structured Trench Coat with Notched Collar & Waist Belt
        const totalHeight = 1.15; // from y = -0.70 to y = 0.45
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

          const { rx, rz, cz } = getBodyProfile(Math.max(-0.32, absY), style);
          let gRx = rx + 0.028;
          let gRz = rz + 0.028;

          // Cinch around waist belt (y = 0.12)
          const distToWaist = Math.abs(absY - 0.12);
          if (distToWaist < 0.12) {
            const cinch = (0.12 - distToWaist) * 0.14;
            gRx -= cinch;
            gRz -= cinch;
          }

          // Flare toward mid-calf
          if (absY < 0.0) {
            const t = (-absY) / 0.70;
            const flare = Math.pow(t, 1.4) * 0.16;
            gRx += flare;
            gRz += flare;
          }

          let vx = gRx * cosA;
          let vz = gRz * sinA + cz;

          if (Number.isFinite(vx)) pos.setX(i, vx);
          if (Number.isFinite(absY)) pos.setY(i, absY);
          if (Number.isFinite(vz)) pos.setZ(i, vz);
        }

        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        garmentGroup.add(mainMesh);

        // Trench Waist Belt with Buckle
        const beltGeo = new THREE.TorusGeometry(0.138, 0.016, 16, 36);
        const beltMesh = new THREE.Mesh(beltGeo, fabricMaterial);
        beltMesh.position.set(0, 0.12, -0.005);
        beltMesh.scale.set(1.0, 1.0, 0.82);
        beltMesh.rotation.x = Math.PI / 2;
        garmentGroup.add(beltMesh);

        // Belt Buckle
        const buckleGeo = new THREE.BoxGeometry(0.042, 0.034, 0.008);
        const buckle = new THREE.Mesh(buckleGeo, accentMaterial);
        buckle.position.set(0, 0.12, 0.115);
        garmentGroup.add(buckle);

        // Trench Sleeves (aligned with natural fashion A-pose arms)
        [-0.19, 0.19].forEach((armSide) => {
          const isRight = armSide > 0;
          const sign = isRight ? -1 : 1;
          const sleeveGeo = new THREE.CylinderGeometry(0.046, 0.034, 0.36, 20);
          const sleeve = new THREE.Mesh(sleeveGeo, fabricMaterial);
          sleeve.position.set(armSide + (isRight ? 0.042 : -0.042), 0.22, 0.005);
          sleeve.rotation.z = sign * 0.30;
          sleeve.castShadow = true;
          garmentGroup.add(sleeve);
        });
        break;
      }

      case 'strapless_cocktail': {
        // Molded Bandeau Cocktail Mini with Back Waterfall Train
        const totalHeight = 0.64; // from y = -0.32 to y = 0.32
        const geo = new THREE.CylinderGeometry(0.14, 0.19, totalHeight, 48, 32, true);
        const pos = geo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
          const rawY = pos.getY(i);
          let absY = rawY;
          const origX = pos.getX(i);
          const origZ = pos.getZ(i);
          const angle = Math.atan2(origZ, origX);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          // Straight / sweetheart bandeau top line at y = 0.30
          if (absY > 0.30) absY = 0.30;

          const { rx, rz, cz } = getBodyProfile(absY, style);
          const gRx = rx + 0.014;
          const gRz = rz + 0.014;

          let vx = gRx * cosA;
          let vz = gRz * sinA + cz;

          if (Number.isFinite(vx)) pos.setX(i, vx);
          if (Number.isFinite(absY)) pos.setY(i, absY);
          if (Number.isFinite(vz)) pos.setZ(i, vz);
        }

        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        garmentGroup.add(mainMesh);

        // Cascading Back Waterfall Train (flowing down from back waist to floor)
        const trainGeo = new THREE.PlaneGeometry(0.24, 1.10, 24, 32);
        const trainPos = trainGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < trainPos.count; i++) {
          const py = trainPos.getY(i);
          const px = trainPos.getX(i);
          const t = Math.max(0, (0.55 - py) / 1.10);
          const wave = Math.sin(t * 12 + px * 8) * 0.02 * t;
          trainPos.setZ(i, -0.09 - t * 0.08 + wave);
          trainPos.setX(i, px * (1 + t * 0.6));
        }
        trainGeo.computeVertexNormals();
        const trainMesh = new THREE.Mesh(trainGeo, fabricMaterial);
        trainMesh.position.set(0, -0.42, 0);
        trainMesh.rotation.y = Math.PI;
        trainMesh.castShadow = true;
        garmentGroup.add(trainMesh);
        break;
      }

      case 'kimono': {
        // Draped Kimono Wrap Robe with Wide Obi Sash
        const totalHeight = 1.18; // from y = -0.72 to y = 0.46
        const geo = new THREE.CylinderGeometry(0.18, 0.44, totalHeight, 48, 36, true);
        const pos = geo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
          const rawY = pos.getY(i);
          let absY = rawY - 0.13;
          const origX = pos.getX(i);
          const origZ = pos.getZ(i);
          const angle = Math.atan2(origZ, origX);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          const { rx, rz, cz } = getBodyProfile(Math.max(-0.32, absY), style);
          let gRx = rx + 0.035; // relaxed fluid kimono wrap
          let gRz = rz + 0.035;

          if (absY < 0.0) {
            const t = (-absY) / 0.72;
            gRx += t * 0.14;
            gRz += t * 0.14;
          }

          let vx = gRx * cosA;
          let vz = gRz * sinA + cz;

          if (Number.isFinite(vx)) pos.setX(i, vx);
          if (Number.isFinite(absY)) pos.setY(i, absY);
          if (Number.isFinite(vz)) pos.setZ(i, vz);
        }

        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        garmentGroup.add(mainMesh);

        // Wide Obi Sash Belt
        const obiGeo = new THREE.CylinderGeometry(0.142, 0.155, 0.16, 36, 1, true);
        obiGeo.scale(1.0, 1.0, 0.82);
        const obiMesh = new THREE.Mesh(obiGeo, accentMaterial);
        obiMesh.position.set(0, 0.12, -0.005);
        garmentGroup.add(obiMesh);

        // Wide Draped Kimono Sleeves (aligned with A-pose)
        [-0.19, 0.19].forEach((armSide) => {
          const isRight = armSide > 0;
          const sign = isRight ? -1 : 1;
          const sleeveGeo = new THREE.BoxGeometry(0.08, 0.38, 0.18);
          const sleeve = new THREE.Mesh(sleeveGeo, fabricMaterial);
          sleeve.position.set(armSide + (isRight ? 0.055 : -0.055), 0.16, 0.015);
          sleeve.rotation.z = sign * 0.25;
          sleeve.castShadow = true;
          garmentGroup.add(sleeve);
        });
        break;
      }

      case 'jumpsuit': {
        // High-Waist Wide-Leg Palazzo Jumpsuit
        const totalHeight = 1.38; // from floor -0.98 to bust 0.40
        const geo = new THREE.CylinderGeometry(0.14, 0.36, totalHeight, 48, 36, true);
        const pos = geo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
          const rawY = pos.getY(i);
          let absY = rawY - 0.29;
          const origX = pos.getX(i);
          const origZ = pos.getZ(i);
          const angle = Math.atan2(origZ, origX);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          const { rx, rz, cz } = getBodyProfile(Math.max(-0.32, absY), style);
          let gRx = rx + 0.018;
          let gRz = rz + 0.018;

          // Split into two wide palazzo trouser legs below crotch (y < -0.22)
          let vx = gRx * cosA;
          if (absY < -0.22) {
            const t = (-0.22 - absY) / 0.76;
            const legSeparation = (cosA > 0 ? 0.06 : -0.06) * t;
            vx += legSeparation + cosA * (t * 0.12);
          }

          let vz = gRz * sinA + cz;

          if (Number.isFinite(vx)) pos.setX(i, vx);
          if (Number.isFinite(absY)) pos.setY(i, absY);
          if (Number.isFinite(vz)) pos.setZ(i, vz);
        }

        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        garmentGroup.add(mainMesh);
        break;
      }

      case 'pleated_dress': {
        // Accordion Sunburst Pleated Midi Dress
        const totalHeight = 1.15;
        const geo = new THREE.CylinderGeometry(0.13, 0.48, totalHeight, 64, 36, true);
        const pos = geo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
          const rawY = pos.getY(i);
          let absY = rawY - 0.18;
          const origX = pos.getX(i);
          const origZ = pos.getZ(i);
          const angle = Math.atan2(origZ, origX);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          const { rx, rz, cz } = getBodyProfile(Math.max(-0.32, absY), style);
          let gRx = rx + 0.018;
          let gRz = rz + 0.018;

          if (absY < 0.0) {
            const t = (-absY) / 0.75;
            const flare = Math.pow(t, 1.4) * 0.22;
            gRx += flare;
            gRz += flare;
            // 24-fold accordion sunburst pleat
            const pleat = Math.sin(angle * 24) * 0.024 * t;
            gRx += pleat;
            gRz += pleat;
          }

          let vx = gRx * cosA;
          let vz = gRz * sinA + cz;

          if (Number.isFinite(vx)) pos.setX(i, vx);
          if (Number.isFinite(absY)) pos.setY(i, absY);
          if (Number.isFinite(vz)) pos.setZ(i, vz);
        }

        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        garmentGroup.add(mainMesh);
        break;
      }

      case 'mondrian_dress': {
        // Geometric Shift Dress
        const totalHeight = 0.72; // from y = -0.32 to y = 0.40
        const geo = new THREE.CylinderGeometry(0.16, 0.21, totalHeight, 44, 28, true);
        const pos = geo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
          const rawY = pos.getY(i);
          let absY = rawY + 0.04;
          const origX = pos.getX(i);
          const origZ = pos.getZ(i);
          const angle = Math.atan2(origZ, origX);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          const { rx, rz, cz } = getBodyProfile(absY, style);
          const gRx = rx + 0.016;
          const gRz = rz + 0.016;

          let vx = gRx * cosA;
          let vz = gRz * sinA + cz;

          if (Number.isFinite(vx)) pos.setX(i, vx);
          if (Number.isFinite(absY)) pos.setY(i, absY);
          if (Number.isFinite(vz)) pos.setZ(i, vz);
        }

        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        garmentGroup.add(mainMesh);
        break;
      }

      case 'shirt':
      default: {
        // Relaxed Button-Down Shirt
        const totalHeight = 0.66;
        const geo = new THREE.CylinderGeometry(0.16, 0.24, totalHeight, 44, 28, true);
        const pos = geo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < pos.count; i++) {
          const rawY = pos.getY(i);
          let absY = rawY + 0.08;
          const origX = pos.getX(i);
          const origZ = pos.getZ(i);
          const angle = Math.atan2(origZ, origX);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          const { rx, rz, cz } = getBodyProfile(absY, style);
          let gRx = rx + 0.026;
          let gRz = rz + 0.026;

          // Shirttail curvature at bottom hem
          if (absY < -0.22 && Math.abs(cosA) > 0.3) {
            absY += 0.04;
          }

          let vx = gRx * cosA;
          let vz = gRz * sinA + cz;

          if (Number.isFinite(vx)) pos.setX(i, vx);
          if (Number.isFinite(absY)) pos.setY(i, absY);
          if (Number.isFinite(vz)) pos.setZ(i, vz);
        }

        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const mainMesh = new THREE.Mesh(geo, fabricMaterial);
        mainMesh.castShadow = true;
        garmentGroup.add(mainMesh);

        // Folded Collar
        const collarGeo = new THREE.TorusGeometry(0.072, 0.016, 12, 32);
        const collar = new THREE.Mesh(collarGeo, fabricMaterial);
        collar.position.set(0, 0.42, 0.01);
        collar.rotation.x = Math.PI / 2 + 0.15;
        garmentGroup.add(collar);
        break;
      }
    }

    return garmentGroup;
  };

  // Mount Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(lightingPreset === 'evening' ? 0x131215 : 0x181615);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0.15, zoomLevelRef.current);
    cameraRef.current = camera;

    // 3. Renderer with high PBR quality
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Studio Lighting System
    const ambientLight = new THREE.AmbientLight(0xfff8f0, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff2e0, 2.2);
    keyLight.position.set(2.5, 4.0, 3.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdbe7ff, 0.9);
    fillLight.position.set(-2.5, 2.0, 2.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffecd2, 1.8);
    rimLight.position.set(0, 3.2, -3.0);
    scene.add(rimLight);

    lightsRef.current = { ambient: ambientLight, key: keyLight, fill: fillLight, rim: rimLight };

    // 5. Studio Stage Floor (Circular reflective platform)
    const floorGeo = new THREE.CircleGeometry(2.8, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1A1715,
      roughness: 0.65,
      metalness: 0.2,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -1.21;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // 6. Build & Add Mannequin Group
    const mannequinGroup = new THREE.Group();
    const mannequinStructure = buildRealisticMannequin(modelPose);
    mannequinGroup.add(mannequinStructure);
    scene.add(mannequinGroup);
    mannequinGroupRef.current = mannequinGroup;

    // 7. Initial Garment Setup
    updateGarmentInScene(selectedGarment, selectedFabric, selectedColor);

    // 8. Animation Loop (smooth 360 rotation, camera pan & zoom, and soft wind drape physics)
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      // Camera positioning with pan offset & zoom
      if (cameraRef.current) {
        cameraRef.current.position.x = panOffsetRef.current.x;
        cameraRef.current.position.y = panOffsetRef.current.y;
        cameraRef.current.position.z = zoomLevelRef.current;
        cameraRef.current.lookAt(panOffsetRef.current.x, panOffsetRef.current.y, 0);
      }

      if (mannequinGroupRef.current) {
        if (isRotating && !isDraggingRef.current) {
          rotationAngleRef.current.y += 0.005;
        }
        mannequinGroupRef.current.rotation.y = rotationAngleRef.current.y;
        mannequinGroupRef.current.rotation.x = rotationAngleRef.current.x;

        // Soft organic breeze simulation when wind is active
        if (isWindActive && garmentGroupRef.current) {
          const t = clockRef.current.getElapsedTime();
          garmentGroupRef.current.rotation.z = Math.sin(t * 2.2) * 0.016;
          garmentGroupRef.current.rotation.y = Math.cos(t * 1.8) * 0.014;
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update lighting preset
  useEffect(() => {
    if (!lightsRef.current || !sceneRef.current) return;
    const { ambient, key, fill, rim } = lightsRef.current;

    if (lightingPreset === 'daylight') {
      sceneRef.current.background = new THREE.Color(0xF5EFE6);
      ambient.color.setHex(0xFFFAF0);
      ambient.intensity = 1.1;
      key.color.setHex(0xFFE8C2);
      key.intensity = 2.4;
      key.position.set(3, 4, 3);
      fill.intensity = 1.0;
      rim.intensity = 1.2;
    } else if (lightingPreset === 'atelier') {
      sceneRef.current.background = new THREE.Color(0x181513);
      ambient.color.setHex(0xFFF0DD);
      ambient.intensity = 0.85;
      key.color.setHex(0xFFE5C0);
      key.intensity = 2.1;
      key.position.set(2.5, 3.5, 2.5);
      fill.intensity = 0.9;
      rim.intensity = 2.0;
    } else if (lightingPreset === 'evening') {
      sceneRef.current.background = new THREE.Color(0x0F0E10);
      ambient.color.setHex(0x9E8DA5);
      ambient.intensity = 0.55;
      key.color.setHex(0xFFB570);
      key.intensity = 2.0;
      fill.intensity = 0.5;
      rim.intensity = 2.6;
    }
  }, [lightingPreset]);

  // Update wireframe mode
  useEffect(() => {
    if (garmentGroupRef.current) {
      garmentGroupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).material) {
          const mat = (child as THREE.Mesh).material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => { if ('wireframe' in m) m.wireframe = wireframeMode; });
          } else if ('wireframe' in mat) {
            (mat as THREE.MeshStandardMaterial).wireframe = wireframeMode;
          }
        }
      });
    }
  }, [wireframeMode]);

  // Update mannequin style/pose
  useEffect(() => {
    if (!sceneRef.current || !mannequinGroupRef.current) return;
    while (mannequinGroupRef.current.children.length > 0) {
      const child = mannequinGroupRef.current.children[0];
      mannequinGroupRef.current.remove(child);
      child.traverse?.((c: any) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach((m: any) => m.dispose());
          else c.material.dispose();
        }
      });
    }
    garmentGroupRef.current = null;
    const newMannequin = buildRealisticMannequin(modelPose);
    mannequinGroupRef.current.add(newMannequin);
    updateGarmentInScene(selectedGarment, selectedFabric, selectedColor);
  }, [modelPose]);

  // Update garment and material when selection changes
  const updateGarmentInScene = (
    garment: GarmentSilhouette,
    fabric: Fabric,
    color: ColorOption
  ) => {
    if (!mannequinGroupRef.current) return;

    // Remove existing garment group if present
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

    // Build new tailored garment group
    const newGarmentGroup = buildGarmentGroup(garment.typeKey, fabric, color, wireframeMode, modelPose);
    mannequinGroupRef.current.add(newGarmentGroup);
    garmentGroupRef.current = newGarmentGroup;
  };

  useEffect(() => {
    updateGarmentInScene(selectedGarment, selectedFabric, selectedColor);
  }, [selectedGarment, selectedFabric, selectedColor]);

  // Camera transform update helper
  const updateCameraTransform = () => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    cam.position.x = panOffsetRef.current.x;
    cam.position.y = panOffsetRef.current.y;
    cam.position.z = zoomLevelRef.current;
    cam.lookAt(panOffsetRef.current.x, panOffsetRef.current.y, 0);
  };

  // Directional Pan Step
  const panStep = (dir: 'up' | 'down' | 'left' | 'right' | 'center') => {
    if (dir === 'center') {
      panOffsetRef.current = { x: 0, y: 0.10 };
    } else if (dir === 'up') {
      panOffsetRef.current.y = Math.min(0.85, panOffsetRef.current.y + 0.14);
    } else if (dir === 'down') {
      panOffsetRef.current.y = Math.max(-0.95, panOffsetRef.current.y - 0.14);
    } else if (dir === 'left') {
      panOffsetRef.current.x = Math.min(1.2, panOffsetRef.current.x + 0.14);
    } else if (dir === 'right') {
      panOffsetRef.current.x = Math.max(-1.2, panOffsetRef.current.x - 0.14);
    }
    updateCameraTransform();
  };

  // Anatomical Focus Points for inspecting fabric drape and craftsmanship
  const setFocusPreset = (preset: 'full' | 'neckline' | 'waist' | 'hem' | 'heels') => {
    setActiveFocus(preset);
    if (preset === 'full') {
      panOffsetRef.current = { x: 0, y: 0.10 };
      zoomLevelRef.current = 2.4;
      rotationAngleRef.current = { y: 0, x: 0.05 };
    } else if (preset === 'neckline') {
      panOffsetRef.current = { x: 0, y: 0.44 };
      zoomLevelRef.current = 1.45;
      rotationAngleRef.current = { y: 0.08, x: 0.12 };
    } else if (preset === 'waist') {
      panOffsetRef.current = { x: 0, y: 0.10 };
      zoomLevelRef.current = 1.6;
      rotationAngleRef.current = { y: 0.35, x: 0.04 };
    } else if (preset === 'hem') {
      panOffsetRef.current = { x: 0, y: -0.58 };
      zoomLevelRef.current = 1.6;
      rotationAngleRef.current = { y: -0.25, x: -0.15 };
    } else if (preset === 'heels') {
      panOffsetRef.current = { x: 0, y: -0.88 };
      zoomLevelRef.current = 1.5;
      rotationAngleRef.current = { y: 0.35, x: -0.18 };
    }
    setCurrentZoomPercent(Math.round(((2.4 / zoomLevelRef.current) * 100)));
    updateCameraTransform();
    if (mannequinGroupRef.current) {
      mannequinGroupRef.current.rotation.y = rotationAngleRef.current.y;
      mannequinGroupRef.current.rotation.x = rotationAngleRef.current.x;
    }
  };

  // Camera viewpoint angles
  const setCameraAngle = (view: 'front' | 'back' | 'side' | 'three_quarter' | 'top' | 'bottom') => {
    if (view === 'front') {
      rotationAngleRef.current = { y: 0, x: 0.05 };
    } else if (view === 'three_quarter') {
      rotationAngleRef.current = { y: 0.72, x: 0.08 }; // 40 degree runway perspective
    } else if (view === 'back') {
      rotationAngleRef.current = { y: Math.PI, x: 0.05 };
    } else if (view === 'side') {
      rotationAngleRef.current = { y: Math.PI / 2, x: 0.05 };
    } else if (view === 'top') {
      rotationAngleRef.current = { y: 0, x: 1.25 }; // Bird's eye looking down
    } else if (view === 'bottom') {
      rotationAngleRef.current = { y: 0, x: -1.05 }; // Low angle looking up at hem
    }
    if (mannequinGroupRef.current) {
      mannequinGroupRef.current.rotation.y = rotationAngleRef.current.y;
      mannequinGroupRef.current.rotation.x = rotationAngleRef.current.x;
    }
  };

  // Zoom handlers
  const handleZoom = (direction: 'in' | 'out') => {
    const newZoom = direction === 'in'
      ? Math.max(1.0, zoomLevelRef.current - 0.35)
      : Math.min(4.2, zoomLevelRef.current + 0.35);
    zoomLevelRef.current = newZoom;
    setCurrentZoomPercent(Math.round(((2.4 / newZoom) * 100)));
    updateCameraTransform();
  };

  const handleZoomSlider = (scale: number) => {
    const newZoom = Math.max(1.0, Math.min(4.2, 2.4 / scale));
    zoomLevelRef.current = newZoom;
    setCurrentZoomPercent(Math.round(scale * 100));
    updateCameraTransform();
  };

  // Wheel zoom handler for desktop trackpad & mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * 0.0016;
    const newZoom = Math.max(1.0, Math.min(4.2, zoomLevelRef.current + delta));
    zoomLevelRef.current = newZoom;
    setCurrentZoomPercent(Math.round(((2.4 / newZoom) * 100)));
    updateCameraTransform();
  };

  // Pointer Interaction Handlers for 360 Orbit, Pan & Zoom
  const handlePointerDown = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 1) {
      isDraggingRef.current = true;
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };

      // Right-click (button 2), middle-click (button 1), Shift key, or active Pan mode activates pan
      if (e.button === 2 || e.button === 1 || e.shiftKey || interactionMode === 'pan') {
        dragModeRef.current = 'pan';
      } else if (interactionMode === 'zoom') {
        dragModeRef.current = 'zoom';
      } else {
        dragModeRef.current = 'orbit';
      }
    } else if (activePointersRef.current.size === 2) {
      // Touchscreen two-finger touch: handle simultaneous pan & pinch zoom
      const pts = Array.from(activePointersRef.current.values());
      pinchStartDistRef.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      prevMousePosRef.current = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 1) {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - prevMousePosRef.current.x;
      const deltaY = e.clientY - prevMousePosRef.current.y;

      if (dragModeRef.current === 'pan') {
        const panFactor = 0.0022 * (zoomLevelRef.current / 2.4);
        panOffsetRef.current.x = Math.max(-1.2, Math.min(1.2, panOffsetRef.current.x - deltaX * panFactor));
        panOffsetRef.current.y = Math.max(-0.95, Math.min(0.85, panOffsetRef.current.y + deltaY * panFactor));
        updateCameraTransform();
      } else if (dragModeRef.current === 'zoom') {
        const zoomFactor = deltaY * 0.005;
        const newZoom = Math.max(1.0, Math.min(4.2, zoomLevelRef.current + zoomFactor));
        zoomLevelRef.current = newZoom;
        setCurrentZoomPercent(Math.round(((2.4 / newZoom) * 100)));
        updateCameraTransform();
      } else {
        // Unconstrained 360-degree orbit
        rotationAngleRef.current.y += deltaX * 0.009;
        rotationAngleRef.current.x = Math.max(-1.42, Math.min(1.42, rotationAngleRef.current.x + deltaY * 0.007));
        if (mannequinGroupRef.current) {
          mannequinGroupRef.current.rotation.y = rotationAngleRef.current.y;
          mannequinGroupRef.current.rotation.x = rotationAngleRef.current.x;
        }
      }
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    } else if (activePointersRef.current.size === 2) {
      // Two-finger touch gesture
      const pts = Array.from(activePointersRef.current.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;

      const deltaX = midX - prevMousePosRef.current.x;
      const deltaY = midY - prevMousePosRef.current.y;
      const panFactor = 0.0022 * (zoomLevelRef.current / 2.4);
      panOffsetRef.current.x = Math.max(-1.2, Math.min(1.2, panOffsetRef.current.x - deltaX * panFactor));
      panOffsetRef.current.y = Math.max(-0.95, Math.min(0.85, panOffsetRef.current.y + deltaY * panFactor));

      if (pinchStartDistRef.current) {
        const pinchDelta = pinchStartDistRef.current - currentDist;
        const newZoom = Math.max(1.0, Math.min(4.2, zoomLevelRef.current + pinchDelta * 0.004));
        zoomLevelRef.current = newZoom;
        pinchStartDistRef.current = currentDist;
        setCurrentZoomPercent(Math.round(((2.4 / newZoom) * 100)));
      }
      updateCameraTransform();
      prevMousePosRef.current = { x: midX, y: midY };
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    if (activePointersRef.current.size === 0) {
      isDraggingRef.current = false;
      pinchStartDistRef.current = null;
    }
  };

  const resetView = () => {
    panOffsetRef.current = { x: 0, y: 0.10 };
    rotationAngleRef.current = { y: 0, x: 0.05 };
    zoomLevelRef.current = 2.4;
    setCurrentZoomPercent(100);
    setActiveFocus('full');
    updateCameraTransform();
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
    <section id="studio3d" className="relative bg-[#141210] text-[#EDE7DE] py-16 lg:py-24 border-b border-[#28231F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between pb-10 border-b border-[#2A2420] gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#CF6E4C] mb-2 font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>3D AI Drape &amp; Haute Couture Studio</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
              {lang === 'uz' ? 'Virtual Maneken & Fason Studiyasi' : lang === 'ru' ? '3D Манекен & Студия Силуэтов' : 'Interactive 3D Mannequin Atelier'}
            </h2>
            <p className="text-xs sm:text-sm text-[#A89D91] mt-2 max-w-2xl leading-relaxed">
              {lang === 'uz'
                ? 'Anatomik proporsiyalarga ega yuqori kutyur manekeni. Tanlagan matongizning yorug‘likdagi tovlanishi, nozik burmalari va libosning qomatga o‘tirishini 360° erkin tomosha qiling.'
                : lang === 'ru'
                ? 'Анатомический кутюрный манекен. Оцените пластику ткани, складки и безупречную посадку платья со всех углов.'
                : 'Anatomically sculpted couture mannequin. Inspect cloth drape, grainline physics, and fitted silhouette from any 360° perspective.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#D4AF37] px-3 py-1.5 rounded-xl bg-[#231F1C] border border-[#3A332C]">
              {selectedFabric.certifications[0]}
            </span>
          </div>
        </div>

        {/* Studio Grid: Controls & 3D Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-10 items-stretch">
          
          {/* Left Controls: Fabric & Dedicated Color Selector */}
          <div className="lg:col-span-4 bg-[#1C1815] border border-[#2D2621] rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xl">
            
            {/* Step 1: Fabric Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono uppercase tracking-wider text-[#A89D91] font-bold">
                  {lang === 'uz' ? '1. Matoni tanlang:' : lang === 'ru' ? '1. Выберите ткань:' : '1. Select Textile:'}
                </label>
                <span className="text-[11px] font-mono text-[#CF6E4C]">{selectedFabric.gsm} GSM</span>
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
                className="w-full bg-[#13110F] border border-[#3A322A] rounded-2xl px-4 py-3 text-xs font-medium text-white focus:outline-none focus:border-[#CF6E4C] transition cursor-pointer"
              >
                {fabrics.map((f) => (
                  <option key={f.id} value={f.id} className="bg-[#1C1815] text-white">
                    {f.name} ({f.origin}) — {f.gsm} gsm
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Dedicated Separate Color Selection via Select & Swatches */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono uppercase tracking-wider text-[#A89D91] font-bold">
                  {lang === 'uz' ? '2. Rang tanlash (Variantlar):' : lang === 'ru' ? '2. Выбор цвета:' : '2. Colorway Selection:'}
                </label>
                <span className="text-[11px] text-white font-medium">{selectedColor.name[lang]}</span>
              </div>

              {/* Color Select Dropdown */}
              <select
                value={selectedColor.id}
                onChange={(e) => {
                  const col = selectedFabric.colors.find((c) => c.id === e.target.value);
                  if (col) onSelectColor(col);
                }}
                className="w-full bg-[#13110F] border border-[#3A322A] rounded-2xl px-4 py-2.5 text-xs font-medium text-white focus:outline-none focus:border-[#CF6E4C] transition mb-3 cursor-pointer"
              >
                {selectedFabric.colors.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#1C1815] text-white">
                    {c.name[lang]} ({c.hex})
                  </option>
                ))}
              </select>

              {/* Color Swatch Tiles */}
              <div className="grid grid-cols-4 gap-2">
                {selectedFabric.colors.map((c) => {
                  const isActive = selectedColor.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => onSelectColor(c)}
                      className={`group relative p-2 rounded-2xl border transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'border-[#CF6E4C] bg-[#29221C] shadow-md ring-1 ring-[#CF6E4C]'
                          : 'border-[#332A23] bg-[#14110E] hover:border-[#4D3F35]'
                      }`}
                      title={c.name[lang]}
                    >
                      <span
                        className="w-7 h-7 rounded-xl shadow-inner border border-white/20 flex items-center justify-center transition-transform group-hover:scale-105"
                        style={{ backgroundColor: c.hex }}
                      >
                        {isActive && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                      </span>
                      <span className="text-[10px] text-[#A89D91] group-hover:text-white truncate max-w-full text-center">
                        {c.name[lang].split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Model Stance & Aesthetic Style */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono uppercase tracking-wider text-[#A89D91] font-bold">
                  {lang === 'uz' ? '3. Maneken Qomati & Modeli:' : lang === 'ru' ? '3. Модель манекена:' : '3. Mannequin Style & Form:'}
                </label>
                <span className="text-[11px] font-mono text-[#D4AF37]">
                  {modelPose === 'female_model' ? 'Female Fashion Model' : modelPose === 'stockman' ? 'Stockman Paris 1867' : 'Studio Dress Form'}
                </span>
              </div>
              <select
                value={modelPose}
                onChange={(e) => setModelPose(e.target.value as any)}
                className="w-full bg-[#13110F] border border-[#3A322A] rounded-2xl px-4 py-2.5 text-xs font-medium text-white focus:outline-none focus:border-[#CF6E4C] transition cursor-pointer"
              >
                <option value="female_model">
                  {lang === 'uz'
                    ? '👗 Moda Modeli (Runway Female Model • Sketchfab Base Mesh)'
                    : lang === 'ru'
                    ? '👗 Женская Модель (Runway Female Model • Sketchfab)'
                    : '👗 Runway Female Fashion Model (Sketchfab Base Mesh)'}
                </option>
                <option value="stockman">
                  {lang === 'uz'
                    ? '🏛️ Parij Kutyur Manekeni (Stockman Paris 1867 • Yog‘och Finial & Shtativ)'
                    : lang === 'ru'
                    ? '🏛️ Парижский Манекен (Stockman Paris 1867 • Французский Лён)'
                    : '🏛️ Stockman Paris 1867 Haute Couture Form (Walnut & Cast Iron)'}
                </option>
                <option value="studio_form">
                  {lang === 'uz'
                    ? '✨ Atelye Bichiq Manekeni (Studio Couture Dress Form)'
                    : lang === 'ru'
                    ? '✨ Студийный Портновский Манекен (Studio Form)'
                    : '✨ Studio Atelier Dress Form (Brushed Brass)'}
                </option>
              </select>
            </div>

            {/* Step 4: Garment Silhouette Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono uppercase tracking-wider text-[#A89D91] font-bold">
                  {lang === 'uz' ? '4. Kiyim fasoni (Model Tanlash):' : lang === 'ru' ? '4. Фасон одежды:' : '4. Garment Silhouette:'}
                </label>
                <span className="text-[11px] font-mono text-[#D4AF37]">
                  {unit === 'metric' ? `${selectedGarment.estimatedMeters}m` : `${selectedGarment.estimatedYards}yd`}
                </span>
              </div>

              <select
                value={selectedGarment.id}
                onChange={(e) => {
                  const g = garments.find((gar) => gar.id === e.target.value);
                  if (g) onSelectGarment(g);
                }}
                className="w-full bg-[#13110F] border border-[#3A322A] rounded-2xl px-4 py-2.5 text-xs font-medium text-white focus:outline-none focus:border-[#CF6E4C] transition cursor-pointer mb-3"
              >
                {garments.map((g) => (
                  <option key={g.id} value={g.id} className="bg-[#1C1815] text-white">
                    {g.name[lang]} — {g.difficulty[lang]}
                  </option>
                ))}
              </select>

              {/* Quick silhouette chip selector */}
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                {garments.map((g) => {
                  const isActive = selectedGarment.id === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => onSelectGarment(g)}
                      className={`text-left p-2.5 rounded-xl border text-xs transition cursor-pointer ${
                        isActive
                          ? 'border-[#CF6E4C] bg-[#29221C] text-white font-bold'
                          : 'border-[#302720] bg-[#151210] text-[#9A8F82] hover:text-white hover:border-[#44382E]'
                      }`}
                    >
                      <span className="block truncate">{g.name[lang]}</span>
                      <span className="text-[10px] text-[#A89D91] font-mono">
                        {unit === 'metric' ? `~${g.estimatedMeters}m` : `~${g.estimatedYards}yd`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Spec Sheet & Meterage Input */}
            <div className="p-4 rounded-2xl bg-[#12100E] border border-[#2B231D] space-y-2 text-xs">
              <div className="flex justify-between text-[#A89D91]">
                <span>{lang === 'uz' ? 'Drape koeffitsiyenti:' : lang === 'ru' ? 'Индекс пластичности:' : 'Drape Index:'}</span>
                <span className="font-mono text-[#CF6E4C] font-bold">{selectedFabric.drapeFactor} / 10</span>
              </div>
              <div className="flex justify-between text-[#A89D91]">
                <span>{lang === 'uz' ? 'Standart eni:' : lang === 'ru' ? 'Ширина рулона:' : 'Bolt Width:'}</span>
                <span className="font-mono text-white">
                  {unit === 'metric' ? `${selectedFabric.widthCm} sm` : `${selectedFabric.widthInches}"`}
                </span>
              </div>
              <div className="flex justify-between text-[#A89D91] pt-1 border-t border-[#26201B]">
                <span className="font-medium">{lang === 'uz' ? 'Kerakli metraj:' : lang === 'ru' ? 'Метраж:' : 'Yardage:'}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCustomMeters((m) => Math.max(0.5, Math.round((m - 0.5) * 10) / 10))}
                    className="w-5 h-5 rounded bg-[#2A231D] text-white text-xs flex items-center justify-center hover:bg-[#3E332A] cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-white px-1">
                    {customMeters.toFixed(1)} {unit === 'metric' ? 'm' : 'yd'}
                  </span>
                  <button
                    onClick={() => setCustomMeters((m) => Math.round((m + 0.5) * 10) / 10)}
                    className="w-5 h-5 rounded bg-[#2A231D] text-white text-xs flex items-center justify-center hover:bg-[#3E332A] cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Add to Cart Button */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#A89D91]">{lang === 'uz' ? 'Jami hisob:' : lang === 'ru' ? 'Итого:' : 'Total Estimate:'}</span>
                <span className="font-serif font-bold text-lg text-white">{formatCurrency(subtotal)}</span>
              </div>
              <button
                onClick={() => onAddToCart(selectedFabric, selectedColor, customMeters)}
                className="w-full bg-[#CF6E4C] hover:bg-[#B85D3B] text-white font-bold py-3.5 px-4 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg text-xs uppercase tracking-wider cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>
                  {lang === 'uz' ? 'Ushbu fasonni savatga olish' : lang === 'ru' ? 'В корзину для пошива' : 'Order Fabric for Silhouette'}
                </span>
              </button>
            </div>

          </div>

          {/* Right 3D Viewport Stage */}
          <div className="lg:col-span-8 bg-[#181513] border border-[#2D2621] rounded-3xl p-4 sm:p-6 flex flex-col justify-between relative overflow-hidden shadow-2xl min-h-[540px] lg:min-h-[660px]">
            
            {/* 3D Top Bar Controls */}
            <div className="flex flex-col gap-3 border-b border-[#2C241F] pb-4 z-20">
              
              {/* Row 1: Viewport Title, Lighting Presets, and Studio Tools */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-xs font-mono text-white font-semibold">
                    Three.js 3D Mannequin Viewport (360° Orbit &amp; Pan)
                  </span>
                </div>

                {/* Viewport Action Toggles */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  
                  {/* Model Form Switcher Pills */}
                  <div className="flex items-center bg-[#100E0C] border border-[#302821] rounded-xl p-0.5 text-xs">
                    <button
                      onClick={() => setModelPose('female_model')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition font-medium text-[11px] cursor-pointer ${
                        modelPose === 'female_model' ? 'bg-[#CF6E4C] text-white font-bold shadow-xs' : 'text-[#8A7F73] hover:text-white'
                      }`}
                      title={lang === 'uz' ? 'Anatomik tabiiy inson qomati & silliq qo‘llar' : 'Natural Human Runway Model'}
                    >
                      👗 {lang === 'uz' ? 'Inson Modeli' : lang === 'ru' ? 'Модель' : 'Human Model'}
                    </button>
                    <button
                      onClick={() => setModelPose('stockman')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition font-medium text-[11px] cursor-pointer ${
                        modelPose === 'stockman' ? 'bg-[#CF6E4C] text-white font-bold shadow-xs' : 'text-[#8A7F73] hover:text-white'
                      }`}
                      title={lang === 'uz' ? 'Parij kutyur manekeni (Stockman Paris 1867)' : 'Stockman Paris 1867'}
                    >
                      🏛️ {lang === 'uz' ? 'Parij Manekeni' : lang === 'ru' ? 'Манекен' : 'Stockman Form'}
                    </button>
                  </div>

                  {/* Lighting Presets */}
                  <div className="flex items-center bg-[#100E0C] border border-[#302821] rounded-xl p-0.5 text-xs">
                    <button
                      onClick={() => setLightingPreset('daylight')}
                      className={`px-2.5 py-1 rounded-lg transition font-medium text-[11px] cursor-pointer ${
                        lightingPreset === 'daylight' ? 'bg-[#2E251E] text-white' : 'text-[#8A7F73] hover:text-white'
                      }`}
                    >
                      {lang === 'uz' ? 'Quyosh' : lang === 'ru' ? 'День' : 'Sunlight'}
                    </button>
                    <button
                      onClick={() => setLightingPreset('atelier')}
                      className={`px-2.5 py-1 rounded-lg transition font-medium text-[11px] cursor-pointer ${
                        lightingPreset === 'atelier' ? 'bg-[#2E251E] text-white' : 'text-[#8A7F73] hover:text-white'
                      }`}
                    >
                      {lang === 'uz' ? 'Atelier' : lang === 'ru' ? 'Ателье' : 'Atelier'}
                    </button>
                    <button
                      onClick={() => setLightingPreset('evening')}
                      className={`px-2.5 py-1 rounded-lg transition font-medium text-[11px] cursor-pointer ${
                        lightingPreset === 'evening' ? 'bg-[#2E251E] text-white' : 'text-[#8A7F73] hover:text-white'
                      }`}
                    >
                      {lang === 'uz' ? 'Kechki' : lang === 'ru' ? 'Вечер' : 'Evening'}
                    </button>
                  </div>

                  {/* Gentle Wind / Drape Animation Toggle */}
                  <button
                    onClick={() => setIsWindActive(!isWindActive)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs transition cursor-pointer ${
                      isWindActive ? 'bg-[#3A2A45] border-[#9368B7] text-[#D8B4F8]' : 'bg-[#12100E] border-[#302821] text-[#9A8F82]'
                    }`}
                    title={lang === 'uz' ? 'Mayin shabada tebranishi (Mato to‘lqini)' : 'Breeze Simulation'}
                  >
                    <Wind className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">{lang === 'uz' ? 'Shamol' : lang === 'ru' ? 'Ветер' : 'Breeze'}</span>
                  </button>

                  {/* Auto Rotate Toggle */}
                  <button
                    onClick={() => setIsRotating(!isRotating)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs transition cursor-pointer ${
                      isRotating ? 'bg-[#CF6E4C] border-[#CF6E4C] text-white' : 'bg-[#12100E] border-[#302821] text-[#9A8F82]'
                    }`}
                    title={isRotating ? 'Aylanishni to‘xtatish' : '360° Avto aylantirish'}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">{lang === 'uz' ? '360° Aylantirish' : 'Auto 360°'}</span>
                  </button>

                  {/* Wireframe Inspector Toggle */}
                  <button
                    onClick={() => setWireframeMode(!wireframeMode)}
                    className={`p-2 rounded-xl border text-xs transition cursor-pointer ${
                      wireframeMode ? 'bg-[#D4AF37] border-[#D4AF37] text-black font-bold' : 'bg-[#12100E] border-[#302821] text-[#9A8F82]'
                    }`}
                    title="Mesh sim karkas rejimi"
                  >
                    <Layers className="w-3.5 h-3.5" />
                  </button>

                  {/* Reset View */}
                  <button
                    onClick={resetView}
                    className="p-2 rounded-xl bg-[#12100E] border border-[#302821] text-[#9A8F82] hover:text-white transition cursor-pointer"
                    title="Boshlang‘ich markazga qaytarish"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                </div>
              </div>

              {/* Row 2: Interaction Mode Switcher (Orbit / Pan / Zoom) & Anatomical Focus Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#251E19]">
                
                {/* Mouse / Touch Drag Mode Switcher */}
                <div className="flex items-center bg-[#0F0D0B] border border-[#2B231D] rounded-xl p-1 text-xs">
                  <span className="text-[10px] font-mono text-[#A89D91] px-2 font-bold uppercase hidden md:inline">
                    {lang === 'uz' ? 'Rejim:' : lang === 'ru' ? 'Режим:' : 'Mode:'}
                  </span>
                  <button
                    onClick={() => setInteractionMode('orbit')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      interactionMode === 'orbit'
                        ? 'bg-[#CF6E4C] text-white shadow-sm'
                        : 'text-[#8A7F73] hover:text-white'
                    }`}
                    title="360° Erkin burish (Orbit)"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>{lang === 'uz' ? '360° Aylantirish' : lang === 'ru' ? '360° Вращение' : '360° Orbit'}</span>
                  </button>
                  <button
                    onClick={() => setInteractionMode('pan')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      interactionMode === 'pan'
                        ? 'bg-[#CF6E4C] text-white shadow-sm'
                        : 'text-[#8A7F73] hover:text-white'
                    }`}
                    title="Surish & Ko‘chirish (Pan) • Yoki sichqonchaning o‘ng tugmasi"
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span>{lang === 'uz' ? 'Surish (Pan)' : lang === 'ru' ? 'Сдвиг (Pan)' : 'Pan'}</span>
                  </button>
                  <button
                    onClick={() => setInteractionMode('zoom')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      interactionMode === 'zoom'
                        ? 'bg-[#CF6E4C] text-white shadow-sm'
                        : 'text-[#8A7F73] hover:text-white'
                    }`}
                    title="Yaqinlashtirish (Zoom)"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>{lang === 'uz' ? 'Masshtab' : lang === 'ru' ? 'Масштаб' : 'Zoom'}</span>
                  </button>
                </div>

                {/* Anatomical Drape Inspection Focus Points */}
                <div className="flex items-center gap-1 bg-[#0F0D0B] border border-[#2B231D] rounded-xl p-1 text-[11px] overflow-x-auto no-scrollbar">
                  <span className="text-[10px] font-mono text-[#D4AF37] px-2 font-bold uppercase hidden lg:inline">
                    {lang === 'uz' ? 'Fokus:' : lang === 'ru' ? 'Фокус:' : 'Focus:'}
                  </span>
                  <button
                    onClick={() => setFocusPreset('full')}
                    className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                      activeFocus === 'full' ? 'bg-[#2E251E] text-white font-bold' : 'text-[#8A7F73] hover:text-white'
                    }`}
                  >
                    🌟 {lang === 'uz' ? 'To‘liq' : lang === 'ru' ? 'Общий' : 'Full'}
                  </button>
                  <button
                    onClick={() => setFocusPreset('neckline')}
                    className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                      activeFocus === 'neckline' ? 'bg-[#2E251E] text-white font-bold' : 'text-[#8A7F73] hover:text-white'
                    }`}
                  >
                    🪡 {lang === 'uz' ? 'Yoqa' : lang === 'ru' ? 'Ворот' : 'Neckline'}
                  </button>
                  <button
                    onClick={() => setFocusPreset('waist')}
                    className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                      activeFocus === 'waist' ? 'bg-[#2E251E] text-white font-bold' : 'text-[#8A7F73] hover:text-white'
                    }`}
                  >
                    ⏳ {lang === 'uz' ? 'Bel' : lang === 'ru' ? 'Талия' : 'Waist'}
                  </button>
                  <button
                    onClick={() => setFocusPreset('hem')}
                    className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                      activeFocus === 'hem' ? 'bg-[#2E251E] text-white font-bold' : 'text-[#8A7F73] hover:text-white'
                    }`}
                  >
                    👗 {lang === 'uz' ? 'Etek' : lang === 'ru' ? 'Подол' : 'Hemline'}
                  </button>
                  <button
                    onClick={() => setFocusPreset('heels')}
                    className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                      activeFocus === 'heels' ? 'bg-[#2E251E] text-white font-bold' : 'text-[#8A7F73] hover:text-white'
                    }`}
                  >
                    👠 {lang === 'uz' ? 'Oyoq' : lang === 'ru' ? 'Обувь' : 'Shoes'}
                  </button>
                </div>

              </div>

            </div>

            {/* Three.js Canvas Container */}
            <div
              ref={mountRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
              onContextMenu={(e) => e.preventDefault()}
              className={`relative flex-grow w-full h-[480px] sm:h-[520px] lg:h-[580px] select-none ${
                interactionMode === 'pan'
                  ? 'cursor-move'
                  : interactionMode === 'zoom'
                  ? 'cursor-ns-resize'
                  : 'cursor-grab active:cursor-grabbing'
              }`}
            >
              {/* Floating Camera Angle Selector Strip (Top, Bottom, Front, Side, Back) */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-black/75 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 text-[11px] shadow-lg flex-wrap">
                <span className="text-[10px] font-mono text-[#D4AF37] px-2 font-bold uppercase hidden sm:inline">
                  {lang === 'uz' ? 'Rakurs:' : lang === 'ru' ? 'Ракурс:' : 'Angle:'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setCameraAngle('front'); }}
                  className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-[#CF6E4C] text-white transition font-medium cursor-pointer"
                  title="Oldidan ko‘rish (Front view)"
                >
                  👤 {lang === 'uz' ? 'Oldidan' : lang === 'ru' ? 'Спереди' : 'Front'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setCameraAngle('three_quarter'); }}
                  className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-[#CF6E4C] text-white transition font-medium cursor-pointer"
                  title="3/4 Podium rakursi"
                >
                  📐 {lang === 'uz' ? '3/4 Podium' : '3/4 Runway'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setCameraAngle('side'); }}
                  className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-[#CF6E4C] text-white transition font-medium cursor-pointer"
                  title="Yonidan ko‘rish (Side view)"
                >
                  ↔️ {lang === 'uz' ? 'Yonidan' : lang === 'ru' ? 'Сбоку' : 'Side'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setCameraAngle('back'); }}
                  className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-[#CF6E4C] text-white transition font-medium cursor-pointer"
                  title="Orqasidan ko‘rish (Back view)"
                >
                  🔄 {lang === 'uz' ? 'Orqadan' : lang === 'ru' ? 'Сзади' : 'Back'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setCameraAngle('top'); }}
                  className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-[#CF6E4C] text-white transition font-medium cursor-pointer"
                  title="Tepadan ko‘rish (Bird's eye view from above)"
                >
                  ⬆️ {lang === 'uz' ? 'Tepadan' : lang === 'ru' ? 'Сверху' : 'Top'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setCameraAngle('bottom'); }}
                  className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-[#CF6E4C] text-white transition font-medium cursor-pointer"
                  title="Pastdan ko‘rish (Low angle from below)"
                >
                  ⬇️ {lang === 'uz' ? 'Pastdan' : lang === 'ru' ? 'Снизу' : 'Bottom'}
                </button>
              </div>

              {/* Floating Material Info & Anatomical Status Badge */}
              <div className="absolute top-4 right-4 z-10 bg-black/75 backdrop-blur-md p-3 rounded-2xl border border-white/15 max-w-[210px] text-xs pointer-events-none">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border border-white/30" style={{ backgroundColor: selectedColor.hex }}></span>
                  <span className="font-bold text-white truncate">{selectedColor.name[lang]}</span>
                </div>
                <div className="text-[11px] text-[#A89D91] space-y-0.5">
                  <div>{selectedFabric.name}</div>
                  <div className="text-emerald-400 font-mono text-[10px] font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Anatomical Zero-Clip Drape</span>
                  </div>
                </div>
              </div>

              {/* Interactive Tactical D-Pad Pan HUD (Bottom-Right) */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-4 right-4 z-20 bg-black/80 backdrop-blur-md p-2.5 rounded-2xl border border-white/15 shadow-2xl flex flex-col items-center gap-1.5"
              >
                <span className="text-[9px] font-mono text-[#D4AF37] font-bold uppercase tracking-wider mb-0.5">
                  {lang === 'uz' ? 'Panoramali Surish' : 'Pan Controls'}
                </span>
                
                {/* D-Pad Buttons */}
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <button
                    onClick={() => panStep('up')}
                    className="absolute top-0 w-7 h-7 rounded-lg bg-white/15 hover:bg-[#CF6E4C] text-white flex items-center justify-center transition cursor-pointer active:scale-95"
                    title="Yuqoriga surish (Bo‘yin & Yoqa)"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => panStep('down')}
                    className="absolute bottom-0 w-7 h-7 rounded-lg bg-white/15 hover:bg-[#CF6E4C] text-white flex items-center justify-center transition cursor-pointer active:scale-95"
                    title="Pastga surish (Etek & Poyabzal)"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => panStep('left')}
                    className="absolute left-0 w-7 h-7 rounded-lg bg-white/15 hover:bg-[#CF6E4C] text-white flex items-center justify-center transition cursor-pointer active:scale-95"
                    title="Chapga surish"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => panStep('right')}
                    className="absolute right-0 w-7 h-7 rounded-lg bg-white/15 hover:bg-[#CF6E4C] text-white flex items-center justify-center transition cursor-pointer active:scale-95"
                    title="O‘ngga surish"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => panStep('center')}
                    className="w-7 h-7 rounded-full bg-[#CF6E4C] hover:bg-[#B85D3B] text-white flex items-center justify-center transition cursor-pointer active:scale-90 shadow-md"
                    title="Markazga qaytarish"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Floating Zoom Bar HUD (Bottom-Left) */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-4 left-4 z-20 bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15 shadow-2xl flex items-center gap-3"
              >
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleZoom('out')}
                    className="w-7 h-7 rounded-lg bg-white/15 hover:bg-[#CF6E4C] text-white flex items-center justify-center transition cursor-pointer"
                    title="Uzoqlashtirish"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>

                  <input
                    type="range"
                    min="0.6"
                    max="2.4"
                    step="0.05"
                    value={2.4 / zoomLevelRef.current}
                    onChange={(e) => handleZoomSlider(parseFloat(e.target.value))}
                    className="w-20 sm:w-28 accent-[#CF6E4C] cursor-pointer"
                    title="Masshtab slayderi"
                  />

                  <button
                    onClick={() => handleZoom('in')}
                    className="w-7 h-7 rounded-lg bg-white/15 hover:bg-[#CF6E4C] text-white flex items-center justify-center transition cursor-pointer"
                    title="Yaqinlashtirish"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="border-l border-white/20 pl-2.5">
                  <span className="font-mono text-xs text-[#D4AF37] font-bold">
                    {currentZoomPercent}%
                  </span>
                </div>
              </div>

              {/* Floating Navigation Gesture Tooltip */}
              <div className="absolute top-16 left-4 z-10 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[10px] text-[#C4B9AD] pointer-events-none hidden sm:flex items-center gap-1.5">
                <Sliders className="w-3 h-3 text-[#CF6E4C]" />
                <span>
                  {lang === 'uz'
                    ? 'Chap tugma: Aylantirish • O‘ng tugma / Shift: Surish (Pan) • G‘ildirakcha: Masshtab'
                    : lang === 'ru'
                    ? 'ЛКМ: Вращение • ПКМ / Shift: Сдвиг • Колесо мыши: Зум'
                    : 'Left-click: 360° Orbit • Right-click / Shift: Pan • Wheel: Zoom'}
                </span>
              </div>
            </div>

            {/* Bottom Status Ticker */}
            <div className="border-t border-[#2C241F] pt-3 mt-2 flex flex-wrap items-center justify-between text-xs text-[#A89D91] gap-2 z-20">
              <div className="flex items-center gap-3">
                <span>
                  {lang === 'uz' ? 'Fason:' : lang === 'ru' ? 'Силуэт:' : 'Silhouette:'}{' '}
                  <strong className="text-white">{selectedGarment.name[lang]}</strong>
                </span>
                <span>•</span>
                <span>
                  {lang === 'uz' ? 'Tarkib:' : lang === 'ru' ? 'Состав:' : 'Composition:'}{' '}
                  <span className="text-white">{selectedFabric.composition[lang]}</span>
                </span>
              </div>

              <div className="font-mono text-[#D4AF37] text-[11px]">
                Haute Couture Anatomical Standard (Zero-Gap Fit)
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
