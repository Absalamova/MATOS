import React, { useMemo, useState } from 'react';
import { ColorOption, Fabric, FabricPhotos } from '../../types';
import { photoSources, tinyPhoto } from '../../lib/format';
import { weaveThumb } from '../../lib/weave';

interface Props {
  fabric: Fabric;
  color: ColorOption;
  kind?: keyof FabricPhotos;
  alt: string;
  className?: string;
  eager?: boolean;
  /** Rendered width hint for the browser's srcSet choice. */
  sizes?: string;
}

/** Real photo when the colourway has one, otherwise a drawn swatch in the same colour and weave. */
export function FabricImage({ fabric, color, kind = 'swatch', alt, className = '', eager, sizes = '(min-width: 768px) 33vw, 50vw' }: Props) {
  const [failed, setFailed] = useState(false);
  const photo = color.photos?.[kind] || (kind !== 'swatch' ? color.photos?.swatch : undefined);
  const drawn = useMemo(() => (!photo || failed ? weaveThumb(fabric, color, 360) : ''), [photo, failed, fabric, color]);
  const sources = photo && !failed ? photoSources(photo) : { src: drawn };
  return (
    <img
      src={sources.src}
      srcSet={sources.srcSet}
      sizes={sources.srcSet ? sizes : undefined}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      decoding="async"
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

/** Small round colour chip that shows the actual cloth (photo crop or drawn weave). */
export function ColorChip({ fabric, color, size = 28, selected, className = '' }: { fabric: Fabric; color: ColorOption; size?: number; selected?: boolean; className?: string }) {
  const photo = color.photos?.tile || color.photos?.ruler;
  const bg = useMemo(() => (photo ? `url("${tinyPhoto(photo)}")` : `url("${weaveThumb(fabric, color, 96)}")`), [photo, fabric, color]);
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full bg-cover bg-center ring-offset-2 ring-offset-paper ${selected ? 'ring-2 ring-ink' : 'ring-1 ring-black/10'} ${className}`}
      style={{ width: size, height: size, backgroundColor: color.hex, backgroundImage: bg, backgroundSize: photo ? '220%' : 'cover' }}
    />
  );
}
