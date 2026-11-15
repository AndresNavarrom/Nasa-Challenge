// Data-time tempo marks for the overview.
//
// A mark is tied to the layer's own unit, not to wall-clock time:
// - lightning: one mark per month (one per frame)
//
// The mark follows the shared timeline, so it pauses when the planet stops and
// runs faster with the timeline speed. Only lightning has a timed mark.

import type { LayerId } from "../data/types";

export interface TempoStyle {
  wave: OscillatorType;
  frequencyHz: number;
  gain: number;
  durationSeconds: number;
  attackSeconds: number;
}

/** Marks per prepared frame. Forest has no timed marks. */
export const TEMPO_BEATS_PER_FRAME: Partial<Record<LayerId, number>> = {
  lightning: 1, // P1M frames
};

/** Editable character of each timed layer's mark. */
export const TEMPO_STYLES: Partial<Record<LayerId, TempoStyle>> = {
  lightning: {
    wave: "square",
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
