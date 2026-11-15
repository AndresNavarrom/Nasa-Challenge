import { describe, expect, it } from "vitest";
import { LANDING_VIDEO, goldenSpiralPath } from "./landingMedia";

function points(path: string): { x: number; y: number }[] {
  return [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
}

describe("golden spiral", () => {
  it("opens out from its eye to the radius asked for", () => {
    const spiral = points(goldenSpiralPath(1000, 3));
    expect(spiral).toHaveLength(3 * 72 + 1);
    const last = spiral.at(-1)!;
    expect(Math.hypot(last.x, last.y)).toBeCloseTo(1000, 0);
    const first = spiral[0]!;
    expect(Math.hypot(first.x, first.y)).toBeLessThan(10);
  });

  it("grows by the golden ratio every quarter turn", () => {
    const spiral = points(goldenSpiralPath(1000, 3));
    const phi = (1 + Math.sqrt(5)) / 2;
    // Eighteen points are a quarter turn apart (72 points per turn).
    const inner = spiral[180]!;
    const outer = spiral[198]!;
    expect(Math.hypot(outer.x, outer.y) / Math.hypot(inner.x, inner.y)).toBeCloseTo(phi, 2);
  });

  it("starts with a move and goes on with lines", () => {
    const path = goldenSpiralPath(100, 1);
    expect(path.startsWith("M")).toBe(true);
    expect(path.slice(1)).not.toContain("M");
  });
});

describe("landing video", () => {
  it("is either left out or complete enough to play offline", () => {
    if (LANDING_VIDEO === null) return;
    expect(LANDING_VIDEO.src.startsWith("./")).toBe(true);
    expect(LANDING_VIDEO.type).toMatch(/^video\//);
    expect(LANDING_VIDEO.title.length).toBeGreaterThan(0);
    expect(LANDING_VIDEO.thanks.length).toBeGreaterThan(0);
  });
});
