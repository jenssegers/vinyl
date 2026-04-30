import chroma from 'chroma-js';
import { useEffect, useState } from 'react';
import { useAlbumColor } from '../hooks/useAlbumColor';

interface RecordProps {
  albumArt: string;
  isPlaying: boolean;
}

export function Record({ albumArt, isPlaying }: RecordProps) {
  const [loadedArt, setLoadedArt] = useState(albumArt);

  useEffect(() => {
    if (!albumArt) {
      setLoadedArt('');
      return;
    }
    const img = new Image();
    img.onload = () => setLoadedArt(albumArt);
    img.src = albumArt;
    return () => { img.onload = null; };
  }, [albumArt]);

  const [r, g, b] = useAlbumColor(albumArt);
  const base = chroma(r, g, b);
  const grooveDark = base.darken(1.5).css();
  const grooveLight = base.brighten(0.5).css();
  const size = 'min(100vw, 100vh)';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className={`absolute inset-0 rounded-full ${isPlaying ? 'spin-record' : 'spin-paused'}`}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `repeating-radial-gradient(${grooveDark} 0 3px, ${grooveLight} 4px, ${grooveDark} 6px)`,
          }}
        />
        <div
          className="absolute rounded-full bg-center"
          style={{
            inset: '12%',
            backgroundImage: loadedArt ? `url("${loadedArt}")` : undefined,
            backgroundColor: loadedArt ? undefined : '#374151',
            backgroundSize: '104%',
          }}
        />
      </div>

      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background:
            'conic-gradient(from 180deg, transparent 0deg, rgba(255,255,255,0.18) 40deg, transparent 90deg, transparent 250deg, rgba(255,255,255,0.07) 300deg, transparent 340deg)',
        }}
      />

      <div
        className="absolute rounded-full bg-black pointer-events-none"
        style={{ inset: '48.5%' }}
      />
    </div>
  );
}
