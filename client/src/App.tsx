import { Record } from './components/Record';
import { useDisplay } from './hooks/useDisplay';

export default function App() {
  const display = useDisplay();

  if (display.kind === 'off') return null;

  return (
    <div className="flex items-center justify-center w-screen h-screen">
      <Record albumArt={display.track.albumArt} isPlaying={display.kind === 'playing'} />
    </div>
  );
}
