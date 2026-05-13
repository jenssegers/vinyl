interface PlatterProps {
  message: string;
}

const SPOKE_COUNT = 24;
const SPINDLE_R = 3;
const DASH_INNER_R = 9;
const DASH_OUTER_R = 21;
const SOLID_INNER_R = 29;
const SOLID_OUTER_R = 46;
const PLATTER_BORDER_R = 47.5;
const TICKS_PER_SPOKE = 12;
const TICK_ANGULAR_WIDTH = 0.12; // radians — tangential width per unit radius

const TEXT_RADIUS = 25;
const TEXT_ARC_DEGREES = 150;

const SPOKES = Array.from({ length: SPOKE_COUNT }, (_, i) => {
  const angle = (360 / SPOKE_COUNT) * i;
  return { angle, key: `spoke-${angle.toFixed(2)}` };
});

const TICK_RS = Array.from({ length: TICKS_PER_SPOKE }, (_, j) => {
  const r = DASH_INNER_R + (j * (DASH_OUTER_R - DASH_INNER_R)) / (TICKS_PER_SPOKE - 1);
  return { r, key: `tick-r-${r.toFixed(3)}` };
});

function polar(cx: number, cy: number, r: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function textArcPath(): string {
  const half = TEXT_ARC_DEGREES / 2;
  const startDeg = 90 + half;
  const endDeg = 90 - half;
  const start = polar(50, 50, TEXT_RADIUS, startDeg);
  const end = polar(50, 50, TEXT_RADIUS, endDeg);
  return `M ${start.x},${start.y} A ${TEXT_RADIUS},${TEXT_RADIUS} 0 0 0 ${end.x},${end.y}`;
}

const TEXT_PATH_D = textArcPath();

export function Platter({ message }: PlatterProps) {
  const size = 'min(100vw, 100vh)';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          <radialGradient id="platter-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3a3a3a" />
            <stop offset="100%" stopColor="#0f0f0f" />
          </radialGradient>
          <path id="platter-text-arc" d={TEXT_PATH_D} />
        </defs>

        <circle cx="50" cy="50" r="50" fill="url(#platter-bg)" />

        {SPOKES.map(({ angle, key }) => (
          <g key={key} transform={`rotate(${angle} 50 50)`}>
            {TICK_RS.map(({ r, key: tickKey }) => {
              const halfWidth = (r * TICK_ANGULAR_WIDTH) / 2;
              return (
                <line
                  key={tickKey}
                  x1={50 - halfWidth}
                  y1={50 - r}
                  x2={50 + halfWidth}
                  y2={50 - r}
                  stroke="rgba(0,0,0,0.92)"
                  strokeWidth="0.55"
                />
              );
            })}
            <line
              x1="50"
              y1={50 - SOLID_OUTER_R}
              x2="50"
              y2={50 - SOLID_INNER_R}
              stroke="rgba(0,0,0,0.92)"
              strokeWidth="1.4"
            />
          </g>
        ))}

        <circle
          cx="50"
          cy="50"
          r={PLATTER_BORDER_R}
          fill="none"
          stroke="rgba(0,0,0,0.85)"
          strokeWidth="0.35"
        />

        <circle cx="50" cy="50" r={SPINDLE_R} fill="#0a0a0a" />

        <text
          fontSize="3.2"
          fill="black"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontFamily: "'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
            fontWeight: 500,
            letterSpacing: '0.2em',
          }}
        >
          <textPath href="#platter-text-arc" startOffset="50%">
            {message}
          </textPath>
        </text>
      </svg>

      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background:
            'conic-gradient(from 180deg, transparent 0deg, rgba(255,255,255,0.10) 40deg, transparent 90deg, transparent 250deg, rgba(255,255,255,0.05) 300deg, transparent 340deg)',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}
