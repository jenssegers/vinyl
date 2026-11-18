interface PlatterProps {
  message: string;
}

const SPOKE_COUNT = 24;
const SPINDLE_RADIUS = 3;
const DASH_INNER_RADIUS = 9;
const DASH_OUTER_RADIUS = 21;
const SOLID_INNER_RADIUS = 29;
const SOLID_OUTER_RADIUS = 46;
const PLATTER_BORDER_RADIUS = 47.5;
const TICKS_PER_SPOKE = 12;
const TICK_ANGULAR_WIDTH = 0.12; // radians: tangential width per unit radius

const TEXT_RADIUS = 25;
const TEXT_ARC_DEGREES = 150;

const SPOKES = Array.from({ length: SPOKE_COUNT }, (_, i) => {
  const angle = (360 / SPOKE_COUNT) * i;
  return { angle, key: `spoke-${angle.toFixed(2)}` };
});

const TICK_RADII = Array.from({ length: TICKS_PER_SPOKE }, (_, index) => {
  const radius =
    DASH_INNER_RADIUS + (index * (DASH_OUTER_RADIUS - DASH_INNER_RADIUS)) / (TICKS_PER_SPOKE - 1);
  return { radius, key: `tick-${radius.toFixed(3)}` };
});

/** A point on a circle around the center of the 100x100 view box. */
function polarToCartesian(radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(radians), y: 50 + radius * Math.sin(radians) };
}

function textArcPath(): string {
  const half = TEXT_ARC_DEGREES / 2;
  const startDeg = 90 + half;
  const endDeg = 90 - half;
  const start = polarToCartesian(TEXT_RADIUS, startDeg);
  const end = polarToCartesian(TEXT_RADIUS, endDeg);
  return `M ${start.x},${start.y} A ${TEXT_RADIUS},${TEXT_RADIUS} 0 0 0 ${end.x},${end.y}`;
}

const TEXT_PATH_D = textArcPath();

export function Platter({ message }: PlatterProps) {
  return (
    <div className="relative size-[100vmin]">
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
            {TICK_RADII.map(({ radius, key: tickKey }) => {
              const halfWidth = (radius * TICK_ANGULAR_WIDTH) / 2;
              return (
                <line
                  key={tickKey}
                  x1={50 - halfWidth}
                  y1={50 - radius}
                  x2={50 + halfWidth}
                  y2={50 - radius}
                  stroke="rgba(0,0,0,0.92)"
                  strokeWidth="0.55"
                />
              );
            })}
            <line
              x1="50"
              y1={50 - SOLID_OUTER_RADIUS}
              x2="50"
              y2={50 - SOLID_INNER_RADIUS}
              stroke="rgba(0,0,0,0.92)"
              strokeWidth="1.4"
            />
          </g>
        ))}

        <circle
          cx="50"
          cy="50"
          r={PLATTER_BORDER_RADIUS}
          fill="none"
          stroke="rgba(0,0,0,0.85)"
          strokeWidth="0.35"
        />

        <circle cx="50" cy="50" r={SPINDLE_RADIUS} fill="#0a0a0a" />

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
