import React, { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { ColorOption, Fabric } from '../types';
import { useApp } from '../state/app';
import { href } from '../lib/router';
import { formatMoney, pricePerUnit } from '../lib/format';
import { L, UI } from '../lib/i18n';
import { ColorChip, FabricImage } from './ui/FabricImage';

interface Props {
  fabric: Fabric;
  initialColor?: ColorOption;
  eager?: boolean;
}

export function ProductCard({ fabric, initialColor, eager }: Props) {
  const { t, lang, currency, unit, hasSample, toggleSample } = useApp();
  const [color, setColor] = useState<ColorOption>(initialColor ?? fabric.colors[0]);
  const link = href('fabric', { id: fabric.id, query: { color: color.id } });
  const sampled = hasSample(fabric.id, color.id);
  const visible = fabric.colors.slice(0, 7);
  const extra = fabric.colors.length - visible.length;

  return (
    <article className="group">
      <div className="relative overflow-hidden rounded-[6px] bg-well">
        <a href={link} className="block aspect-[4/5]" aria-label={`${t(fabric.name)}, ${t(color.name)}`} tabIndex={-1}>
          <FabricImage fabric={fabric} color={color} kind="swatch" alt="" eager={eager} className="transition-transform duration-700 group-hover:scale-[1.03]" />
          {color.photos?.hang && (
            <span className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
              <FabricImage fabric={fabric} color={color} kind="hang" alt="" />
            </span>
          )}
        </a>
        <button
          type="button"
          onClick={() => toggleSample(fabric.id, color.id)}
          aria-pressed={sampled}
          className={`absolute bottom-3 left-3 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium shadow-sm transition-colors ${
            sampled ? 'bg-tape text-ink' : 'bg-paper/95 text-ink hover:bg-paper'
          }`}
        >
          {sampled ? <Check className="h-3.5 w-3.5" strokeWidth={2.2} /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />}
          {sampled ? t(UI.inSamples) : t(UI.samples)}
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-1">
        <div className="min-w-0">
          <h3 className="font-sans text-[15px] font-medium leading-snug">
            <a href={link} className="hover:underline hover:decoration-line hover:underline-offset-4">
              {t(fabric.name)}
            </a>
          </h3>
          <p className="mt-0.5 truncate text-[13px] text-graphite">
            {t(color.name)} · {fabric.gsm} g/m²
          </p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <div className="tabular text-[15px] font-medium">{formatMoney(pricePerUnit(fabric, currency, unit), currency, lang)}</div>
          <div className="text-[12px] text-muted">{t(unit === 'metric' ? UI.perMeter : UI.perYard)}</div>
        </div>
      </div>
      {fabric.colors.length > 1 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label={t(L('Ranglar', 'Цвета', 'Colours'))}>
          {visible.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColor(c)}
              aria-pressed={c.id === color.id}
              aria-label={t(c.name)}
              title={t(c.name)}
              className="rounded-full p-0.5"
            >
              <ColorChip fabric={fabric} color={c} size={20} selected={c.id === color.id} />
            </button>
          ))}
          {extra > 0 && (
            <a href={link} className="ml-1 text-[12.5px] text-graphite hover:text-ink">
              +{extra}
            </a>
          )}
        </div>
      )}
    </article>
  );
}
