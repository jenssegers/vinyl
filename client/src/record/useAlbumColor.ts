import { getColorSync } from 'colorthief';
import { useEffect, useState } from 'react';

interface AlbumColor {
  /** The album's dominant color as a CSS color, which tints the grooves. */
  color: string;
  /** The album art once it loaded, or empty for a blank label. */
  loadedArt: string;
}

const BLANK_RECORD: AlbumColor = { color: 'rgb(24 22 20)', loadedArt: '' };

export function useAlbumColor(albumArt: string): AlbumColor {
  const [albumColor, setAlbumColor] = useState<AlbumColor>(BLANK_RECORD);

  useEffect(() => {
    // No artwork, e.g. a local file: a blank record.
    if (!albumArt) {
      setAlbumColor(BLANK_RECORD);
      return;
    }

    // Load the art before showing it, so the label and grooves change together.
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (cancelled) return;
      const color = getColorSync(image)?.css() ?? BLANK_RECORD.color;
      setAlbumColor({ color, loadedArt: albumArt });
    };

    // Unloadable art shows a blank record, rather than the previous album's.
    image.onerror = () => {
      if (!cancelled) setAlbumColor(BLANK_RECORD);
    };
    image.src = albumArt;

    return () => {
      cancelled = true;
    };
  }, [albumArt]);

  return albumColor;
}
