// Data-time tempo marks for the overview.
//
// A mark is tied to the layer's own unit, not to wall-clock time:
// - smoke: one mark per hour (three per prepared frame)
// - CO2: one mark per day (one per frame)
// - lightning: one mark per month (one per frame)
//
// The mark follows the shared timeline, so it pauses when the planet stops and
// runs faster with the timeline speed. CO2 and smoke breathe; lightning ticks.

import type { LayerId } from "../data/types";

export interface TempoStyle {
  kind: "breath" | "mark";
  frequencyHz: number;
  gain: number;
  durationSeconds: number;
  attackSeconds: number;
}

/** Marks per prepared frame. Forest has no timed marks. */
export const TEMPO_BEATS_PER_FRAME: Partial<Record<LayerId, number>> = {
  smoke: 3, // PT3H frames; the requested mark is hourly
  co2: 1, // P1D frames
  lightning: 1, // P1M frames
};

/** Editable character of each timed layer's mark. */
export const TEMPO_STYLES: Partial<Record<LayerId, TempoStyle>> = {
  smoke: {
    kind: "breath",
    frequencyHz: 196,
    gain: 0.1,
    durationSeconds: 0.55,
    attackSeconds: 0.14,
  },
  co2: {
    kind: "breath",
    frequencyHz: 110,
    gain: 0.11,
    durationSeconds: 0.75,
    attackSeconds: 0.2,
  },
  lightning: {
    kind: "mark",
    frequencyHz: 880,
    gain: 0.16,
    durationSeconds: 0.08,
    attackSeconds: 0.002,
  },
};

/** Timeline fraction between two marks, or null for a layer with no timed marks. */
export function tempoStep(frames: number, beatsPerFrame: number | undefined): number | null {
  if (!beatsPerFrame || beatsPerFrame <= 0 || frames <= 1) return null;
  return 1 / ((frames - 1) * beatsPerFrame);
}

/** Mark index containing a timeline position. */
export function tempoIndex(position: number, step: number): number {
  if (!(step > 0)) return 0;
  return Math.floor(Math.max(0, Math.min(1, position)) / step);
}
