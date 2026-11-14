// Value -> sound parameters (FR3). Pure functions: nothing here touches the Web
// Audio API, so the sound engine (engine.ts) and the tests can share them.
//
// Every input is a relative intensity in 0..1; out-of-range input is limited to
// that range and anything that is not a number counts as 0.

/** Semitone offsets of the major pentatonic scale: five notes that always sound consonant together. */
export const PENTATONIC_SEMITONES = [0, 2, 4, 7, 9] as const;

/** Lowest forest note: C3. */
export const FOREST_BASE_HZ = 130.81;

/** The forest voice spans two octaves of the scale plus the top octave note: 11 steps. */
export const FOREST_SCALE_STEPS = PENTATONIC_SEMITONES.length * 2 + 1;

export function clampUnit(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Frequency of a step of the pentatonic scale above `FOREST_BASE_HZ` (step 0 = base note). */
export function scaleStepToFrequency(step: number): number {
  const safeStep = Math.max(0, Math.round(step));
  const notes = PENTATONIC_SEMITONES.length;
  const octave = Math.floor(safeStep / notes);
  const semitone = PENTATONIC_SEMITONES[safeStep % notes] ?? 0;
  return FOREST_BASE_HZ * 2 ** ((octave * 12 + semitone) / 12);
}

export interface ForestVoice {
  /** Index of the note in the scale, 0..FOREST_SCALE_STEPS-1. */
  step: number;
  /** Main note, in Hz. */
  frequency: number;
  /** Background harmony: two scale steps above the main note, in Hz. */
  harmonyFrequency: number;
}

/** FR3.1 - forest height picks the note and its harmony; taller forest, higher note. Always on the scale. */
export function forestToVoice(value: number): ForestVoice {
  const step = Math.round(clampUnit(value) * (FOREST_SCALE_STEPS - 1));
  return {
    step,
    frequency: scaleStepToFrequency(step),
    harmonyFrequency: scaleStepToFrequency(step + 2),
  };
}

export interface SmokeTimbre {
  /** Depth of the fast tremolo that makes the sound rough, 0..1. */
  roughness: number;
  /** Speed of that tremolo, in Hz. */
  roughnessRateHz: number;
  /** Low-pass filter cutoff in Hz; lower means a darker, murkier sound. */
  filterCutoffHz: number;
  /** Share of noise mixed into the voice, 0..1. */
  noiseMix: number;
}

export const SMOKE_FILTER_OPEN_HZ = 5000;
export const SMOKE_FILTER_CLOSED_HZ = 350;

/** FR3.2 - more smoke: rougher and darker. */
export function smokeToTimbre(value: number): SmokeTimbre {
  const amount = clampUnit(value);
  return {
    roughness: amount,
    roughnessRateHz: 18 + 42 * amount,
    // Exponential sweep so equal steps of smoke sound like equal steps of darkness.
    filterCutoffHz: SMOKE_FILTER_OPEN_HZ * (SMOKE_FILTER_CLOSED_HZ / SMOKE_FILTER_OPEN_HZ) ** amount,
    noiseMix: 0.15 + 0.6 * amount,
  };
}

export interface Co2Breath {
  /** Breaths per second. */
  rateHz: number;
  /** How deep each breath swells, 0..1 ("heavier" breathing). */
  depth: number;
  /** Centre frequency of the breath sound in Hz; heavier breathing is lower. */
  toneHz: number;
}

export const BREATH_SLOW_HZ = 0.15; // 9 breaths per minute: calm
export const BREATH_FAST_HZ = 0.6; // 36 breaths per minute: laboured

/** FR3.3 - more CO2: faster and heavier breathing. */
export function co2ToBreath(value: number): Co2Breath {
  const amount = clampUnit(value);
  return {
    rateHz: BREATH_SLOW_HZ + (BREATH_FAST_HZ - BREATH_SLOW_HZ) * amount,
    depth: 0.35 + 0.65 * amount,
    toneHz: 700 - 350 * amount,
  };
}

/** FR3.4 - horizontal position of the listened point (0 = left edge, 1 = right edge) to stereo pan (-1..1). */
export function positionToPan(horizontal: number): number {
  const MAX_PAN = 0.9; // never fully one-sided, so the voice stays audible in both ears
  return (clampUnit(horizontal) * 2 - 1) * MAX_PAN;
}

/** Quietest level of an active layer, so no active layer disappears from the mix (FR4). */
export const MIN_ACTIVE_GAIN = 0.18;

/**
 * FR3.4 - intensity to volume (0..1). `null` means "no data here": silence.
 * The curve is gentle at the top so the three voices together leave headroom.
 */
export function intensityToGain(value: number | null): number {
  if (value === null) return 0;
  return MIN_ACTIVE_GAIN + (1 - MIN_ACTIVE_GAIN) * clampUnit(value) ** 0.7;
}
