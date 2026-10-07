import React from 'react';
import { GarmentTypeKey } from '../../types';

/** Flat line sketches of each silhouette, like the ones on a tailor's order sheet. */
const PATHS: Record<GarmentTypeKey, string[]> = {
  slip_dress: ['M19 5 L17.5 16', 'M29 5 L30.5 16', 'M17 16 Q24 21 31 16 L32 30 L37 55 Q24 58 11 55 L16 30 Z'],
  evening_gown: ['M18 5 L17 16', 'M30 5 L31 16', 'M17 16 L24 24 L31 16 L31 30 Q33 42 43 60 Q24 64 5 60 Q15 42 17 30 Z', 'M17 30 H31'],
  one_shoulder_gown: ['M16 18 L28 7 L31.5 9.5 L31 30 Q32 44 35 60 L13 60 Q16 44 17 30 Z', 'M27 60 L25.5 44'],
  strapless_cocktail: ['M15 18 H33 L32 30 L35 42 H13 L16 30 Z', 'M32.5 31 Q40 44 43 60', 'M15.5 31 Q8 44 5 60', 'M24 18 V42'],
  pleated_dress: ['M18 8 Q24 13 30 8', 'M18 8 L14 10 L16.5 14 L17 26 H31 L31.5 14 L34 10 L30 8', 'M17 26 L9 50 H39 L31 26', 'M20.5 26 L16 50', 'M24 26 V50', 'M27.5 26 L32 50'],
  mondrian_dress: ['M16 8 Q24 12.5 32 8 L33 14 L33 50 H15 L15 14 Z', 'M15 25 H33', 'M22 14 V50', 'M22 38 H33', 'M27 25 V38'],
  shirt: ['M19 6 L24 11 L29 6', 'M19 6 L10 10 L4 31 L9 33 L13.5 20 L14 46 Q24 49 34 46 L34.5 20 L39 33 L44 31 L38 10 L29 6', 'M24 11 V47'],
  jumpsuit: ['M18 5 L24 17 L30 5', 'M17 10 L16 25 H32 L31 10', 'M16 25 L12 61 H22 L24 35 L26 61 H36 L32 25', 'M16 28 H32'],
  kimono: ['M18 6 L24 23 L30 6', 'M18 6 L4 12 V27 H14 V57 H34 V27 H44 V12 L30 6', 'M14 28 H34', 'M14 32 H34'],
  blazer: ['M18 6 L24 27 L30 6', 'M18 6 L9 10 L6 41 L11 41 L13 20 L13 43 H35 L35 20 L37 41 L42 41 L39 10 L30 6', 'M18 6 L21.5 16 L19 18', 'M30 6 L26.5 16 L29 18'],
  trench: ['M18 6 L24 21 L30 6', 'M18 6 L9 10 L6 45 L11 45 L13 22 L11 61 H37 L35 22 L37 45 L42 45 L39 10 L30 6', 'M12.5 29 H35.5', 'M15 3.5 L18 6', 'M33 3.5 L30 6'],
};

const DOTS: Partial<Record<GarmentTypeKey, [number, number][]>> = {
  blazer: [[21, 31], [27, 31], [21, 36], [27, 36]],
  trench: [[20, 24], [28, 24], [20, 35], [28, 35]],
  shirt: [[24, 18], [24, 25], [24, 32], [24, 39]],
};

export function GarmentIcon({ type, className = 'h-14 w-10' }: { type: GarmentTypeKey; className?: string }) {
  return (
    <svg viewBox="0 0 48 64" className={className} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      {PATHS[type].map((d, i) => (
        <path key={i} d={d} />
      ))}
      {DOTS[type]?.map(([x, y], i) => (
        <circle key={`d${i}`} cx={x} cy={y} r={0.9} fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}
