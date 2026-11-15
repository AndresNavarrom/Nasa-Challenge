// Which image sizes the browser loads (FR1.2). tools/prep writes the Natural
// Earth image in two sizes plus a full-resolution crop of the Amazon rectangle
// (FR1.3) into the data folder; tools/fetch/gedi_visual.py writes the forest
// height the same way (greyscale, 0 = no forest, 255 = 50 m or more), and
// tools/fetch/lightning_dots.py the lightning dots (greyscale, 0 = no lightning).

/** The two sizes of one whole-planet image. */
export interface SizedImages {
  /** 8192 x 4096: needs a graphics card that accepts textures of 8192 pixels per side. */
  large: string;
  /** 4096 x 2048: lite mode, smaller cards, or when the limit cannot be read. */
  small: string;
}

export const BASE_IMAGES: SizedImages = { large: "earth-8k.jpg", small: "earth-4k.jpg" };
export const BASE_IMAGE_8K = BASE_IMAGES.large;
export const BASE_IMAGE_4K = BASE_IMAGES.small;
/** 2160 x 1680 crop of the Amazon rectangle, drawn inside it on the planet and on the map. */
export const REGION_BASE_IMAGE = "earth-amazon.jpg";

/** Forest height from GEDI L3 at about 1 km, for drawing the forest layer sharply (not for the sound). */
export const FOREST_HEIGHT_IMAGES: SizedImages = { large: "forest-height-8k.png", small: "forest-height-4k.png" };
/** The Amazon rectangle at 0.01 degree (3600 x 2800). */
export const REGION_FOREST_HEIGHT_IMAGE = "forest-height-amazon.png";

/**
 * Lightning dots of NASA SVS 5011 for drawing the lightning layer sharply (not for
 * the sound), written by tools/fetch/lightning_dots.py: 4096 x 2048, one channel,
 * 0 = no lightning. One size: 4096 fits every graphics card.
 */
export const LIGHTNING_IMAGE = "lightning-4k.png";

const SIDE_8K = 8192;

/**
 * File name of the size to load. `maxTextureSize` is WebGL's MAX_TEXTURE_SIZE
 * (null when it cannot be read); `?lite=1` always uses the small image.
 */
export function pickImage(maxTextureSize: number | null, lite: boolean, images: SizedImages = BASE_IMAGES): string {
  if (lite) return images.small;
  if (maxTextureSize === null || !Number.isFinite(maxTextureSize)) return images.small;
  return maxTextureSize >= SIDE_8K ? images.large : images.small;
}

/** File name of the base image of the planet to load. */
export function pickBaseImage(maxTextureSize: number | null, lite: boolean): string {
  return pickImage(maxTextureSize, lite, BASE_IMAGES);
}

/**
 * The base images to load, in order: the small one first, so the planet shows
 * after 1.3 MB instead of 5.2 MB, then the large one when the card takes it
 * (it replaces the small one once it has arrived).
 */
export function baseImageSteps(maxTextureSize: number | null, lite: boolean): { first: string; then: string | null } {
  const final = pickBaseImage(maxTextureSize, lite);
  return { first: BASE_IMAGES.small, then: final === BASE_IMAGES.small ? null : final };
}
