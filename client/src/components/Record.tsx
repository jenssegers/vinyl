import { useAlbumColor } from '../hooks/useAlbumColor';

interface RecordProps {
  albumArt: string;
  isPlaying: boolean;
}

export function Record({ albumArt, isPlaying }: RecordProps) {
  const {
    color: [r, g, b],
    loadedArt,
  } = useAlbumColor(albumArt);

  const base = `rgb(${r} ${g} ${b})`;
  const grooveDark = `color-mix(in oklab, ${base}, black 35%)`;
  const grooveLight = `color-mix(in oklab, ${base}, white 15%)`;
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
