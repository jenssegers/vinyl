import { useEffect, useRef } from 'react';
import { type ClockHands, ClockMotion, type Hand, render } from './ClockMotion.ts';
import { REST } from './digits.ts';
import { CLOCKS, FACE_PERCENT } from './layout.ts';

// Hand sizes in percent of the face. A hand reaches almost to the rim, so the hands of
// neighbouring clocks line up into the strokes of a digit.
const HAND_WIDTH_PERCENT = 8;
const HAND_LENGTH_PERCENT = 47;
const CAP_PERCENT = 13;

const HAND_KEYS = ['a', 'b'] as const;

/** ClockClock-style clock: a grid of analog clocks whose hands flow between showing the time. */
export function Clock() {
  const handElements = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    const clocks = CLOCKS.map((position, i): ClockHands => {
      const hand = (index: number): Hand => {
        const created = {
          element: handElements.current[index],
          angle: REST[index % 2],
          offset: 0,
          offsetStart: 0,
          target: REST[index % 2],
        };
        render(created);
        return created;
      };
      return { position, hands: [hand(i * 2), hand(i * 2 + 1)] };
    });

    const motion = new ClockMotion(clocks);
    motion.start();
    return () => motion.stop();
  }, []);

  return (
    <div className="relative size-[100vmin] rounded-full bg-black">
      {CLOCKS.map((clock, clockIndex) => (
        <div
          key={`${clock.column}-${clock.row}`}
          className="absolute rounded-full bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
          style={{
            left: `${clock.x - FACE_PERCENT / 2}%`,
            top: `${clock.y - FACE_PERCENT / 2}%`,
            width: `${FACE_PERCENT}%`,
            height: `${FACE_PERCENT}%`,
          }}
        >
          {HAND_KEYS.map((key, handIndex) => (
            <div
              key={key}
              ref={(element) => {
                if (element) handElements.current[clockIndex * 2 + handIndex] = element;
              }}
              className="absolute rounded-full bg-[#ecebe7] will-change-transform"
              style={{
                left: `${50 - HAND_WIDTH_PERCENT / 2}%`,
                top: `${50 - HAND_LENGTH_PERCENT}%`,
                width: `${HAND_WIDTH_PERCENT}%`,
                height: `${HAND_LENGTH_PERCENT + HAND_WIDTH_PERCENT / 2}%`,
                // Turn around the face's centre, which sits half a hand width above the bottom.
                transformOrigin: `50% ${(HAND_LENGTH_PERCENT / (HAND_LENGTH_PERCENT + HAND_WIDTH_PERCENT / 2)) * 100}%`,
              }}
            />
          ))}
          <div
            className="absolute rounded-full bg-[#ecebe7]"
            style={{
              left: `${50 - CAP_PERCENT / 2}%`,
              top: `${50 - CAP_PERCENT / 2}%`,
              width: `${CAP_PERCENT}%`,
              height: `${CAP_PERCENT}%`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
