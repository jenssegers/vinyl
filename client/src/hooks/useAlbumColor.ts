import { getColorSync } from 'colorthief';
import { useEffect, useState } from 'react';

interface AlbumColor {
  color: [number, number, number];
  loadedArt: string;
}

const DEFAULT_COLOR: [number, number, number] = [24, 22, 20];

export function useAlbumColor(albumArt: string): AlbumColor {
  const [state, setState] = useState<AlbumColor>({ color: DEFAULT_COLOR, loadedArt: '' });

  useEffect(() => {
    if (!albumArt) {
      setState({ color: DEFAULT_COLOR, loadedArt: '' });
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      const extracted = getColorSync(img);
      const color: [number, number, number] = extracted
        ? [extracted.rgb().r, extracted.rgb().g, extracted.rgb().b]
        : DEFAULT_COLOR;
      setState({ color, loadedArt: albumArt });
    };
    img.src = albumArt;
    return () => {
      cancelled = true;
    };
  }, [albumArt]);

  return state;
}
