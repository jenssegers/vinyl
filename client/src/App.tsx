import { Platter } from './components/Platter';
import { Record } from './components/Record';
import { useDisplay } from './hooks/useDisplay';
import { useRecordGestures } from './hooks/useRecordGestures';

export default function App() {
  const display = useDisplay();
  const { isPlaying, isPressed, handlers } = useRecordGestures(display);

  if (display.kind === 'off') return null;

  return (
    <div
      className="flex items-center justify-center w-screen h-screen transition-transform duration-150"
      style={{ transform: isPressed ? 'scale(0.97)' : undefined }}
      {...handlers}
    >
      {display.kind === 'error' ? (
        <Platter message={display.message} />
      ) : (
        <Record albumArt={display.track.albumArt} isPlaying={isPlaying} />
      )}
    </div>
  );
}
