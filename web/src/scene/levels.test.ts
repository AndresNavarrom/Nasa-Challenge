import { describe, expect, it } from "vitest";
import { IDENTITY_LEVELS, autoLevels } from "./levels";

/** RGBA pixels of the given grey tones, `each` pixels per tone. */
function greys(tones: readonly number[], each = 1): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(tones.length * each * 4);
  tones.forEach((tone, toneIndex) => {
    for (let copy = 0; copy < each; copy += 1) {
      const offset = (toneIndex * each + copy) * 4;
      pixels.set([tone, tone, tone, 255], offset);
    }
  });
  return pixels;
}

describe("auto levels", () => {
  it("stretches a flat image from its darkest to its brightest tone", () => {
    const levels = autoLevels(greys([40, 80, 120, 200]), 0);
    expect(levels.low).toBeCloseTo(40 / 255, 6);
    expect(levels.high).toBeCloseTo(200 / 255, 6);
  });

  it("ignores a few stray dark or bright pixels", () => {
    // 1000 pixels between 50 and 180, plus one black and one white pixel.
    const pixels = greys([...Array.from({ length: 500 }, () => 50), ...Array.from({ length: 500 }, () => 180), 0, 255]);
    const levels = autoLevels(pixels, 0.005);
    expect(levels.low).toBeCloseTo(50 / 255, 6);
    expect(levels.high).toBeCloseTo(180 / 255, 6);
  });

  it("weighs green more than red and blue, like the eye", () => {
    const green = autoLevels(new Uint8ClampedArray([200, 255, 200, 255, 0, 0, 0, 255]), 0);
    const red = autoLevels(new Uint8ClampedArray([255, 200, 200, 255, 0, 0, 0, 255]), 0);
    expect(green.high).toBeGreaterThan(red.high);
  });

  it("never cuts deep into the dark tones nor whitens a dark image", () => {
    const bright = autoLevels(greys([200, 250]), 0);
    expect(bright.low).toBe(0.2);
    const dark = autoLevels(greys([5, 60]), 0);
    expect(dark.high).toBe(0.6);
  });

  it("leaves an empty or single-tone image as it is", () => {
    expect(autoLevels(new Uint8ClampedArray(0))).toEqual(IDENTITY_LEVELS);
    expect(autoLevels(greys([90, 90, 90]), 0)).toEqual(IDENTITY_LEVELS);
  });

  it("leaves an image that already uses the whole range as it is", () => {
    expect(autoLevels(greys([0, 128, 255]), 0)).toEqual({ low: 0, high: 1 });
  });
});
