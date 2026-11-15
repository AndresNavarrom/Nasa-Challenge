// Which base image of the planet the browser loads (FR1.2). tools/prep writes
// the Natural Earth image in two sizes plus a full-resolution crop of the Amazon
// rectangle (FR1.3) into the data folder.

/** 8192 x 4096: needs a graphics card that accepts textures of 8192 pixels per side. */
export const BASE_IMAGE_8K = "earth-8k.jpg";
/** 4096 x 2048: lite mode, smaller cards, or when the limit cannot be read. */
export const BASE_IMAGE_4K = "earth-4k.jpg";
/** 2160 x 1680 crop of the Amazon rectangle, drawn inside it on the planet and on the map. */
export const REGION_BASE_IMAGE = "earth-amazon.jpg";

const SIDE_8K = 8192;

/**
 * File name of the base image to load. `maxTextureSize` is WebGL's MAX_TEXTURE_SIZE
 * (null when it cannot be read); `?lite=1` always uses the 4096 image.
 */
export function pickBaseImage(maxTextureSize: number | null, lite: boolean): string {
  if (lite) return BASE_IMAGE_4K;
  if (maxTextureSize === null || !Number.isFinite(maxTextureSize)) return BASE_IMAGE_4K;
  return maxTextureSize >= SIDE_8K ? BASE_IMAGE_8K : BASE_IMAGE_4K;
}
