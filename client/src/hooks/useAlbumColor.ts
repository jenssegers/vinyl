import { getColorSync } from 'colorthief';
import { useEffect, useState } from 'react';

export function useAlbumColor(albumArt: string) {
  const [color, setColor] = useState<[number, number, number]>([24, 22, 20]);

  useEffect(() => {
    if (!albumArt) return;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      const extracted = getColorSync(img);
      if (extracted) {
        const { r, g, b } = extracted.rgb();
        setColor([r, g, b]);
      }
    };
    img.src = albumArt;
    return () => {
      cancelled = true;
    };
  }, [albumArt]);

  return color;
}
