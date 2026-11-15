// Whole-visible-area sonification for the planet view.
//
// Every column of a 12 x 6 screen grid sounds at the same time. Each column is
// panned by its screen position, every row gets a pitch from its latitude, and
// the layer value at the cell sets the row gain. The shared timeline chooses the
// data frame; there is no second scan clock.
//
// Pure functions and constants only, so the mapping and instrument table can be
// tested without Web Audio.

import type { LayerId } from "../data/types";
import { PENTATONIC_SEMITONES, clampUnit, positionToPan } from "./mapping";

/** Screen grid sampled over the visible globe: 12 columns x 6 rows = 72 cells. */
export const OVERVIEW_COLUMNS = 12;
export const OVERVIEW_ROWS = 6;

/** Lowest overview note and number of scale steps from pole to equator. */
export const OVERVIEW_BASE_HZ = 110;
export const OVERVIEW_PITCH_STEPS = 10;

/**
 * The instrument of each layer in the overview. Everything that shapes the
 * timbre lives here so the team can tune a layer without touching the audio
 * graph. `octave` shifts the latitude scale for that layer's register.
 */
export interface OverviewInstrument {
  wave: OscillatorType;
  filterHz: number;
  filterQ: number;
  attackSeconds: number;
  releaseSeconds: number;
  gain: number;
  detuneCents: number;
  octave: number;
}

export const OVERVIEW_INSTRUMENTS: Record<LayerId, OverviewInstrument> = {
  forest: {
    wave: "triangle",
    filterHz: 3200,
    filterQ: 0.7,
    attackSeconds: 0.08,
    releaseSeconds: 0.3,
    gain: 0.8,
    detuneCents: 0,
    octave: 0,
  },
  smoke: {
    wave: "sawtooth",
    filterHz: 1600,
    filterQ: 1.1,
    attackSeconds: 0.05,
    releaseSeconds: 0.3,
    gain: 0.65,
    detuneCents: -5,
    octave: 0,
  },
  co2: {
    wave: "sawtooth",
    filterHz: 900,
    filterQ: 1.2,
    attackSeconds: 0.1,
    releaseSeconds: 0.4,
    gain: 0.65,
    detuneCents: 5,
    octave: -1,
  },
  lightning: {
    wave: "square",
    filterHz: 2400,
    filterQ: 0.8,
    attackSeconds: 0.01,
    releaseSeconds: 0.15,
    gain: 0.55,
    detuneCents: 12,
    octave: 1,
  },
};

/** One sampled screen cell: where it is on screen and where it is on the globe. */
export interface VisibleCell {
  lon: number;
  lat: number;
  /** Fraction across the canvas, 0 (left) .. 1 (right). */
  screenX: number;
  /** Fraction down the canvas, 0 (top) .. 1 (bottom). */
  screenY: number;
}

export interface VisibleColumn {
  screenX: number;
  /** One entry per row; null where that screen row misses the globe. */
  cells: (VisibleCell | null)[];
}

export type VisibleField = VisibleColumn[];

/** One sounding row of a visible column. */
export interface OverviewCell {
  pitchHz: number;
  gain: number;
}

export interface OverviewColumn {
  pan: number;
  cells: OverviewCell[];
}

/** Pitch of an absolute latitude on the pentatonic overview scale: poles low, equator high. */
export function overviewPitchHz(latitude: number, octave = 0): number {
  const amount = clampUnit(Math.abs(latitude) / 90);
  const step = Math.round(amount * OVERVIEW_PITCH_STEPS);
  const note = PENTATONIC_SEMITONES[step % PENTATONIC_SEMITONES.length] ?? 0;
  const scaleOctave = Math.floor(step / PENTATONIC_SEMITONES.length);
  return OVERVIEW_BASE_HZ * 2 ** ((scaleOctave * 12 + note) / 12 + octave);
}

/** Value 0..1 to a row gain; null, NaN and non-positive values are silent. */
export function overviewGain(value: number | null): number {
  if (value === null || !Number.isFinite(value) || value <= 0) return 0;
  return clampUnit(value) ** 0.7;
}

/**
 * Turn the visible screen field into sounding columns. `sample` reads the active
 * layer at a place; it returns null where the layer has no data.
 */
export function buildOverviewColumns(
  field: VisibleField,
  sample: (lon: number, lat: number) => number | null,
): OverviewColumn[] {
  return field.map((column) => ({
    pan: positionToPan(column.screenX),
    cells: column.cells.map((cell) => ({
      pitchHz: cell ? overviewPitchHz(cell.lat) : OVERVIEW_BASE_HZ,
      gain: cell ? overviewGain(sample(cell.lon, cell.lat)) : 0,
    })),
  }));
}
