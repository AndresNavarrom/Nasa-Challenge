// The stars behind the planet: small, faint and still, so the dark background
// reads as space without drawing the eye from the data. Their places come from
// a fixed seed, so the sky is the same on every visit and in every test.
//
// Pure, so it is tested without a browser; Starfield.tsx draws them.

export interface Star {
  /** Place in the view, 0..1 from the left and from the top. */
  x: number;
  y: number;
  /** Radius in CSS pixels. */
  radius: number;
  /** Brightness, 0..1. */
  alpha: number;
  /** Colour: most are the light ink of the palette, a few lean blue or warm. */
  color: string;
}

/** One star per this many CSS pixels of the view, and the most ever drawn. */
export const PIXELS_PER_STAR = 5200;
export const MAX_STARS = 600;

const COLORS = ["#e8edf5", "#e8edf5", "#e8edf5", "#e8edf5", "#7fb4ff", "#ffd166"] as const;

/** A small repeatable random generator (mulberry32): the same seed gives the same numbers. */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** How many stars a view of this size gets. */
export function starCount(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 0;
  return Math.min(MAX_STARS, Math.round((width * height) / PIXELS_PER_STAR));
}

/**
 * `count` stars. Most are tiny and faint; about one in twelve is a little larger
 * and brighter, so the sky has depth. A larger count keeps the stars of a
 * smaller one where they were (resizing the window adds stars, it does not move them).
 */
export function starField(count: number, seed = 20261115): Star[] {
  const random = generator(seed);
  const stars: Star[] = [];
  for (let index = 0; index < Math.max(0, Math.floor(count)); index += 1) {
    const x = random();
    const y = random();
    const bright = random() < 1 / 12;
    const size = random();
    const glow = random();
    const tint = random();
    stars.push({
      x,
      y,
      radius: bright ? 1 + size * 0.6 : 0.4 + size * 0.5,
      alpha: bright ? 0.7 + glow * 0.3 : 0.18 + glow * 0.4,
      color: COLORS[Math.floor(tint * COLORS.length)] ?? COLORS[0],
    });
  }
  return stars;
}
