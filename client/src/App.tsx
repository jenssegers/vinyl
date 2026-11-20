import { Clock } from './clock/Clock.tsx';
import { Platter } from './Platter.tsx';
import { Record } from './record/Record.tsx';
import { useRecordGestures } from './record/useRecordGestures.ts';
import { useDisplay } from './useDisplay.ts';

export function App() {
  const display = useDisplay();
  const { recordRef, isPressed, handlers } = useRecordGestures(display);

  if (display.kind === 'off') return null;

  if (display.kind === 'clock') {
    return (
      <div className="flex items-center justify-center w-screen h-screen">
        <Clock />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center w-screen h-screen transition-transform duration-150"
      style={{ transform: isPressed ? 'scale(0.97)' : undefined }}
      {...handlers}
    >
      {display.kind === 'error' ? (
        <Platter message={display.message} />
      ) : (
        <Record albumArt={display.track.albumArt} ref={recordRef} />
      )}
    </div>
  );
}
