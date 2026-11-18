import { useEffect, useState } from 'react';
import { type Display, displaySchema } from '../../shared/display.ts';

const INITIAL_DISPLAY: Display = { kind: 'off' };

function parseDisplay(data: string): Display {
  try {
    return displaySchema.parse(JSON.parse(data));
  } catch {
    return { kind: 'error', message: 'Invalid server message' };
  }
}

export function useDisplay(): Display {
  const [display, setDisplay] = useState<Display>(INITIAL_DISPLAY);

  useEffect(() => {
    const source = new EventSource('/events');
    source.onmessage = (event: MessageEvent<string>) => setDisplay(parseDisplay(event.data));

    // EventSource reconnects by itself. When the server comes back, a deploy may have restarted
    // it with a new client build, so reload the page to pick that up.
    let lostConnection = false;
    source.onopen = () => {
      if (lostConnection) window.location.reload();
    };
    source.onerror = () => {
      lostConnection = true;
      setDisplay({ kind: 'error', message: 'Server unreachable' });
    };

    return () => source.close();
  }, []);

  return display;
}
