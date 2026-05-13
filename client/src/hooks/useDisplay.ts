import { useEffect, useState } from 'react';

interface Track {
  id: string;
  name: string;
  artist: string;
  albumArt: string;
}

export type Display =
  | { kind: 'playing'; track: Track }
  | { kind: 'paused'; track: Track }
  | { kind: 'off' }
  | { kind: 'error'; message: string };

const INITIAL: Display = { kind: 'off' };

export function useDisplay(): Display {
  const [display, setDisplay] = useState<Display>(INITIAL);

  useEffect(() => {
    const es = new EventSource('/events');

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        setDisplay(JSON.parse(e.data) as Display);
      } catch {
        setDisplay({ kind: 'error', message: 'Invalid server message' });
      }
    };

    es.onerror = () => {
      setDisplay({ kind: 'error', message: 'Server unreachable' });
    };

    return () => es.close();
  }, []);

  return display;
}
