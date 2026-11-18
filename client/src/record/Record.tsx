import type { Ref } from 'react';
import { useAlbumColor } from './useAlbumColor.ts';

interface RecordProps {
  albumArt: string;
  /** The rotating layer, driven by `useRecordGestures`. */
  ref: Ref<HTMLDivElement>;
}

export function Record({ albumArt, ref }: RecordProps) {
  const { color, loadedArt } = useAlbumColor(albumArt);

  const grooveDark = `color-mix(in oklab, ${color}, black 35%)`;
  const grooveLight = `color-mix(in oklab, ${color}, white 15%)`;

  return (
    <div className="relative size-[100vmin]">
      <div ref={ref} className="absolute inset-0 rounded-full will-change-transform">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `repeating-radial-gradient(${grooveDark} 0 3px, ${grooveLight} 4px, ${grooveDark} 6px)`,
          }}
        />
        <div
          className={`absolute inset-[12%] rounded-full bg-center bg-size-[104%] ${loadedArt ? '' : 'bg-gray-700'}`}
          style={{ backgroundImage: loadedArt ? `url("${loadedArt}")` : undefined }}
        />
      </div>

      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background:
            'conic-gradient(from 180deg, transparent 0deg, rgba(255,255,255,0.18) 40deg, transparent 90deg, transparent 250deg, rgba(255,255,255,0.07) 300deg, transparent 340deg)',
        }}
      />

      {/* Spindle hole */}
      <div className="absolute inset-[48.5%] rounded-full bg-black pointer-events-none" />
    </div>
  );
}
