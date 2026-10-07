import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Backdrop, Outfit, StudioScene, ViewName } from '../../three/scene';
import { BodyMeasurements, LightingPreset } from '../../types';

export interface ViewerHandle {
  view: (v: ViewName) => void;
  zoom: (f: number) => void;
  reset: () => void;
  capture: () => string | null;
}

interface Props {
  outfit: Outfit;
  measurements: BodyMeasurements;
  lighting: LightingPreset;
  backdrop: Backdrop;
  autoRotate: boolean;
  wind: boolean;
  onBusy?: (busy: boolean) => void;
  onInteract?: () => void;
  fallback: React.ReactNode;
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl');
  } catch {
    return false;
  }
}

/** React wrapper around the three.js StudioScene. The scene lives for the lifetime of the component. */
export const StudioViewer = forwardRef<ViewerHandle, Props>(function StudioViewer(
  { outfit, measurements, lighting, backdrop, autoRotate, wind, onBusy, onInteract, fallback },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<StudioScene | null>(null);
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(onBusy);
  busyRef.current = onBusy;

  useEffect(() => {
    if (!host.current) return;
    if (!webglAvailable()) {
      setFailed(true);
      return;
    }
    let alive = true;
    let s: StudioScene | null = null;
    import('../../three/scene')
      .then(({ StudioScene }) => {
        if (!alive || !host.current) return;
        try {
          s = new StudioScene(host.current);
        } catch {
          setFailed(true);
          return;
        }
        s.onBusy = (b) => busyRef.current?.(b);
        scene.current = s;
        s.setMeasurements(measurements);
        s.setLighting(lighting);
        s.setBackdrop(backdrop);
        s.setAutoRotate(autoRotate);
        s.setWind(wind);
        s.setOutfit(outfit);
      })
      .catch(() => setFailed(true));
    return () => {
      alive = false;
      s?.dispose();
      scene.current = null;
    };
    // the scene is created once; later changes go through the effects below
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scene.current?.setOutfit(outfit);
  }, [outfit.fabric, outfit.color, outfit.garment]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = window.setTimeout(() => scene.current?.setMeasurements(measurements), 120);
    return () => window.clearTimeout(id);
  }, [measurements]);
  useEffect(() => scene.current?.setLighting(lighting), [lighting]);
  useEffect(() => scene.current?.setBackdrop(backdrop), [backdrop]);
  useEffect(() => scene.current?.setAutoRotate(autoRotate), [autoRotate]);
  useEffect(() => scene.current?.setWind(wind), [wind]);

  useImperativeHandle(ref, () => ({
    view: (v) => scene.current?.view(v),
    zoom: (f) => scene.current?.zoom(f),
    reset: () => scene.current?.reset(),
    capture: () => scene.current?.capture() ?? null,
  }));

  if (failed) return <>{fallback}</>;
  return <div ref={host} className="absolute inset-0 touch-none" onPointerDown={onInteract} onWheel={onInteract} />;
});
