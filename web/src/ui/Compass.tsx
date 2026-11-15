// The compass of the HUD. The planet turns about its own axis, so north is
// always up on screen and the letters stay still; what moves is the ring of
// longitude marks, which turns with the planet, and the reading under it: the
// place at the centre of the view.
//
// The orientation is read from a ref on every animation frame and written
// straight to the page, so the HUD around it does not re-render as the planet turns.

import { useEffect, useRef, type RefObject } from "react";
import { viewCentre, type ViewOrientation } from "../scene/geo";
import { formatLatitude, formatLongitude } from "./coordinates";

export interface CompassProps {
  orientation: RefObject<ViewOrientation | null>;
  /** Colour of the north mark (the picked layer's). */
  color: string;
}

/** The reading changes at most this often; the ring turns on every frame. */
const READING_INTERVAL_MS = 150;

const MARKS = Array.from({ length: 24 }, (_, index) => index * 15);

export function Compass({ orientation, color }: CompassProps) {
  const ringRef = useRef<SVGGElement>(null);
  const readingRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let frame = 0;
    let lastReadingAt = 0;
    let lastReading = "";
    const tick = (now: number): void => {
      const current = orientation.current;
      if (current) {
        const centre = viewCentre(current.yaw, current.pitch);
        ringRef.current?.setAttribute("transform", `rotate(${(-centre.lon).toFixed(2)} 32 32)`);
        if (now - lastReadingAt >= READING_INTERVAL_MS) {
          lastReadingAt = now;
          const reading = `${formatLongitude(centre.lon, 0)}, ${formatLatitude(centre.lat, 0)}`;
          if (reading !== lastReading && readingRef.current) {
            lastReading = reading;
            readingRef.current.textContent = reading;
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [orientation]);

  return (
    <div data-testid="planet-hud-compass" className="flex flex-col items-center gap-1" title="Centre of the view">
      <svg viewBox="0 0 64 64" className="h-16 w-16 text-landing-mist" aria-hidden="true">
        <circle cx="32" cy="32" r="30.500" fill="rgba(5,7,13,0.7)" stroke="currentColor" strokeOpacity="0.45" />
        <g ref={ringRef} stroke="currentColor" strokeLinecap="round">
          {MARKS.map((degrees) => (
            <line
              key={degrees}
              x1="32"
              y1="4.500"
              x2="32"
              y2={degrees % 90 === 0 ? 9 : 7}
              strokeOpacity={degrees % 90 === 0 ? 0.9 : 0.4}
              transform={`rotate(${degrees} 32 32)`}
            />
          ))}
        </g>
        <path d="M32 22l3.500 10h-7z" fill={color} className="transition-[fill] duration-300" />
        <path d="M32 42l-3.500-10h7z" fill="currentColor" fillOpacity="0.35" />
        <g fill="currentColor" fontSize="8" fontWeight="600" textAnchor="middle" className="font-label">
          <text x="32" y="19" fill={color}>
            N
          </text>
          <text x="50" y="35">
            E
          </text>
          <text x="32" y="53" fillOpacity="0.7">
            S
          </text>
          <text x="14" y="35">
            W
          </text>
        </g>
      </svg>
      <p ref={readingRef} className="rounded-full bg-landing-deep/70 px-2 font-label text-[10px] text-landing-mist" aria-hidden="true">
        &nbsp;
      </p>
    </div>
  );
}
