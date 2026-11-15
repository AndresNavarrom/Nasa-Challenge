// The sound spectrum, curved along the lower part of the right arc: one bar per
// frequency band, low notes at the bottom, growing outwards from the arc in the
// picked layer's colour. While the sound is off the bars rest as short marks.
//
// It is drawn on a canvas on every other animation frame, straight from the
// engine's analyser; it is decoration for the eyes (the level meter next to the
// sound button carries the reading for screen readers), so it is hidden from them.

import { useEffect, useRef } from "react";
import type { SoundEngine } from "../audio/engine";
import { arcPoint, type ArcFrame } from "./arcLayout";

export interface ArcSpectrumProps {
  engine: SoundEngine;
  arc: ArcFrame;
  color: string;
  /** Where it lies on the right arc, in degrees below its middle (low notes at the far end). */
  fromDegrees: number;
  toDegrees: number;
}

/** The lowest the spectrum ends on the right arc, how much of the arc it takes and where it may start at the earliest (below the timeline). */
export const SPECTRUM_TO_DEGREES = 40;
export const SPECTRUM_SPAN_DEGREES = 27;
export const SPECTRUM_MIN_FROM_DEGREES = 11;
const BANDS = 44;
/** Gap between the arc and the foot of the bars, their resting length and their longest, in pixels. */
const BAR_GAP = 7;
const BAR_REST = 3;
const BAR_MAX = 46;
const BAR_WIDTH = 2.5;
/** How fast a bar falls back, as the share of its length kept per drawn frame. */
const FALL = 0.82;

export function ArcSpectrum({ engine, arc, color, fromDegrees, toDegrees }: ArcSpectrumProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef(color);
  colorRef.current = color;

  // The canvas covers only the corner of the view the bars can reach.
  const ends = [fromDegrees, toDegrees].flatMap((degrees) => [
    arcPoint(arc, "right", degrees, 0),
    arcPoint(arc, "right", degrees, BAR_GAP + BAR_MAX + BAR_WIDTH),
  ]);
  const left = Math.floor(Math.min(...ends.map((point) => point.x)) - BAR_WIDTH);
  const top = Math.floor(Math.min(...ends.map((point) => point.y)) - BAR_WIDTH);
  const width = Math.ceil(Math.max(...ends.map((point) => point.x)) + BAR_WIDTH) - left;
  const height = Math.ceil(Math.max(...ends.map((point) => point.y)) + BAR_WIDTH) - top;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));

    const bands = new Float32Array(BANDS);
    const shown = new Float32Array(BANDS);
    let frame = 0;
    let skip = false;
    const draw = (): void => {
      frame = requestAnimationFrame(draw);
      // Every other frame: about 30 pictures a second is plenty for the bars.
      skip = !skip;
      if (skip) return;
      const running = engine.getSpectrum(bands);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      // A dark halo, so the bars read over a bright map too.
      context.shadowColor = "rgba(5, 7, 13, 0.9)";
      context.shadowBlur = 3;
      context.lineCap = "round";
      context.lineWidth = BAR_WIDTH;
      context.strokeStyle = colorRef.current;
      for (let band = 0; band < BANDS; band += 1) {
        const level = bands[band] ?? 0;
        // Rise at once, fall back smoothly.
        shown[band] = Math.max(level, (shown[band] ?? 0) * FALL);
        const length = BAR_REST + (BAR_MAX - BAR_REST) * (shown[band] ?? 0);
        // Low notes at the bottom end of the arc.
        const degrees = toDegrees - ((toDegrees - fromDegrees) * (band + 0.5)) / BANDS;
        const foot = arcPoint(arc, "right", degrees, BAR_GAP);
        const tip = arcPoint(arc, "right", degrees, BAR_GAP + length);
        context.globalAlpha = running ? 0.45 + 0.55 * (shown[band] ?? 0) : 0.3;
        context.beginPath();
        context.moveTo(foot.x - left, foot.y - top);
        context.lineTo(tip.x - left, tip.y - top);
        context.stroke();
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [engine, arc, fromDegrees, toDegrees, left, top, width, height]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="planet-hud-spectrum"
      className="pointer-events-none absolute"
      style={{ left, top, width, height }}
    />
  );
}
