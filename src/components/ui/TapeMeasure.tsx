import React, { useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Language, UnitSystem } from '../../types';
import { formatNumber, fromUnit, toUnit, unitLabel } from '../../lib/format';

interface Props {
  meters: number;
  onChange: (meters: number) => void;
  unit: UnitSystem;
  lang: Language;
  label: string;
  min?: number;
  max?: number;
  /** marker for a recommended length (e.g. what the chosen garment needs) */
  hint?: { meters: number; label: string };
}

const PX = 110; // pixels per unit on the tape

/**
 * Length picker drawn as a tailor's tape that slides under a fixed marker.
 * Drag it, use the arrow keys, or the − / + buttons.
 */
export function TapeMeasure({ meters, onChange, unit, lang, label, min = 0.5, max = 12, hint }: Props) {
  const drag = useRef<{ x: number; v: number } | null>(null);
  const v = toUnit(meters, unit);
  const vMin = toUnit(min, unit);
  const vMax = toUnit(max, unit);
  const set = (val: number) => {
    const clamped = Math.min(vMax, Math.max(vMin, Math.round(val * 10) / 10));
    onChange(fromUnit(clamped, unit));
  };
  const ticks: React.ReactNode[] = [];
  const start = Math.floor(vMin);
  const end = Math.ceil(vMax);
  for (let i = start * 10; i <= end * 10; i++) {
    const x = (i / 10 - vMin) * PX;
    const major = i % 10 === 0;
    const half = i % 5 === 0;
    ticks.push(<line key={i} x1={x} x2={x} y1={0} y2={major ? 22 : half ? 15 : 9} stroke="#191b20" strokeWidth={major ? 1.4 : 1} />);
    if (half && i / 10 >= vMin)
      ticks.push(
        <text key={`t${i}`} x={x + 3} y={major ? 36 : 31} fontSize={major ? 12 : 10} fill="#191b20" fontFamily="Golos Text, sans-serif">
          {major ? i / 10 : formatNumber(i / 10, lang, 1)}
        </text>,
      );
  }
  const width = (end - vMin) * PX + 40;
  const unitText = unitLabel(unit, lang);
  const hintV = hint ? toUnit(hint.meters, unit) : null;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="label mb-0">{label}</span>
        <span className="tabular text-[22px] font-medium leading-none" aria-hidden="true">
          {formatNumber(v, lang, 1)} <span className="text-[15px] text-graphite">{unitText}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="icon-btn border border-line" onClick={() => set(v - 0.1)} aria-label={`−0,1 ${unitText}`}>
          <Minus className="h-4 w-4" />
        </button>
        <div
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={vMin}
          aria-valuemax={vMax}
          aria-valuenow={Math.round(v * 10) / 10}
          aria-valuetext={`${formatNumber(v, lang, 1)} ${unitText}`}
          onKeyDown={(e) => {
            const step = e.key === 'PageUp' || e.key === 'PageDown' ? 0.5 : 0.1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') set(v + step);
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') set(v - step);
            else if (e.key === 'Home') set(vMin);
            else if (e.key === 'End') set(vMax);
            else return;
            e.preventDefault();
          }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, v };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            set(drag.current.v - (e.clientX - drag.current.x) / PX);
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          className="relative h-[52px] flex-1 cursor-ew-resize touch-none select-none overflow-hidden rounded-[6px] bg-tape"
          style={{ maskImage: 'linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)' }}
        >
          <svg
            className="absolute left-1/2 top-0 h-full"
            width={width}
            height={52}
            style={{ transform: `translateX(${-(v - vMin) * PX}px)`, transition: drag.current ? 'none' : 'transform 0.18s ease-out' }}
            aria-hidden="true"
          >
            {ticks}
            {hintV !== null && (
              <g>
                <line x1={(hintV - vMin) * PX} x2={(hintV - vMin) * PX} y1={40} y2={52} stroke="#191b20" strokeWidth={2} />
                <circle cx={(hintV - vMin) * PX} cy={46} r={3} fill="#191b20" />
              </g>
            )}
          </svg>
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-ink" aria-hidden="true" />
        </div>
        <button type="button" className="icon-btn border border-line" onClick={() => set(v + 0.1)} aria-label={`+0,1 ${unitText}`}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {hint && (
        <button type="button" className="mt-2 text-[13px] text-graphite underline decoration-line underline-offset-4 hover:text-ink" onClick={() => onChange(hint.meters)}>
          {hint.label}
        </button>
      )}
    </div>
  );
}
