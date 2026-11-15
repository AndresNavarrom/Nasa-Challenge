// Auto levels for the planet image: the darkest and the brightest tones the
// picture really uses are stretched to black and white, so a flat, greyish image
// gains contrast without changing its hues. The stretch is measured once per
// image, on a small copy of it, and applied by the planet's shader.
//
// Pure except for imageLevels (which needs a canvas), so the measure is tested
// without a browser.

export interface Levels {
  /** Brightness (0..1) that becomes black. */
  low: number;
  /** Brightness (0..1) that becomes white. */
  high: number;
}

/** No stretch: the picture as it is. */
export const IDENTITY_LEVELS: Levels = { low: 0, high: 1 };

/** Share of the pixels left out at each end, so a few stray dark or bright pixels do not set the stretch. */
const CLIP_SHARE = 0.005;
/** The stretch never cuts more than this off the dark end, nor lets white start below this. */
const MAX_LOW = 0.2;
const MIN_HIGH = 0.6;

/**
 * The levels of an image from its RGBA pixels (4 bytes each). Brightness is the
 * usual weighted mean of red, green and blue. An image that is empty, or already
 * uses the whole range, is left as it is.
 */
export function autoLevels(pixels: ArrayLike<number>, clipShare = CLIP_SHARE): Levels {
  const count = Math.floor(pixels.length / 4);
  if (count === 0) return IDENTITY_LEVELS;
  const histogram = new Uint32Array(256);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 4;
    const brightness =
      0.299 * (pixels[offset] ?? 0) + 0.587 * (pixels[offset + 1] ?? 0) + 0.114 * (pixels[offset + 2] ?? 0);
    histogram[Math.min(255, Math.max(0, Math.round(brightness)))]! += 1;
  }
  const clip = Math.max(0, Math.min(0.49, clipShare)) * count;
  let low = 0;
  for (let seen = 0; low < 255; low += 1) {
    seen += histogram[low]!;
    if (seen > clip) break;
  }
  let high = 255;
  for (let seen = 0; high > 0; high -= 1) {
    seen += histogram[high]!;
    if (seen > clip) break;
  }
  if (high <= low) return IDENTITY_LEVELS;
  return { low: Math.min(MAX_LOW, low / 255), high: Math.max(MIN_HIGH, high / 255) };
}

/** Size of the small copy the levels are measured on. */
const SAMPLE_WIDTH = 256;
const SAMPLE_HEIGHT = 128;

/**
 * The levels of a loaded image, measured on a small copy. Where the browser
 * cannot read the pixels back, the picture is left as it is.
 */
export function imageLevels(image: CanvasImageSource): Levels {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_WIDTH;
    canvas.height = SAMPLE_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return IDENTITY_LEVELS;
    context.drawImage(image, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
    return autoLevels(context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data);
  } catch (cause) {
    console.warn("Earth Jukebox could not measure the planet image's levels; it is drawn as it is.", cause);
    return IDENTITY_LEVELS;
  }
}
