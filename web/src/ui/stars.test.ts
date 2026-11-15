import { describe, expect, it } from "vitest";
import { MAX_STARS, starCount, starField } from "./stars";

describe("starfield", () => {
  it("is the same sky every time", () => {
    expect(starField(50)).toEqual(starField(50));
    expect(starField(50, 1)).not.toEqual(starField(50, 2));
  });

  it("keeps the stars in place when the view grows", () => {
    expect(starField(80).slice(0, 30)).toEqual(starField(30));
  });

  it("keeps every star inside the view, small and no brighter than full", () => {
    for (const star of starField(400)) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThan(1);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThan(1);
      expect(star.radius).toBeGreaterThan(0);
      expect(star.radius).toBeLessThanOrEqual(1.6);
      expect(star.alpha).toBeGreaterThan(0);
      expect(star.alpha).toBeLessThanOrEqual(1);
      expect(star.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("is mostly faint, with a few brighter stars for depth", () => {
    const stars = starField(600);
    const bright = stars.filter((star) => star.radius >= 1).length;
    expect(bright).toBeGreaterThan(20);
    expect(bright).toBeLessThan(100);
  });

  it("gives a larger view more stars, up to a limit, and none to an empty view", () => {
    expect(starCount(390, 844)).toBeLessThan(starCount(1600, 848));
    expect(starCount(8000, 4000)).toBe(MAX_STARS);
    expect(starCount(0, 800)).toBe(0);
    expect(starCount(Number.NaN, 800)).toBe(0);
    expect(starField(0)).toEqual([]);
  });
});
