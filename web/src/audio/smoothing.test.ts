import { describe, expect, it } from "vitest";
import { OnePoleSmoother } from "./smoothing";

describe("OnePoleSmoother", () => {
  it("glides towards the target without overshooting", () => {
    const smoother = new OnePoleSmoother(0);
    smoother.setTarget(1);

    const first = smoother.advance(0.05, 0.1);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);

    let previous = first;
    for (let step = 0; step < 200; step += 1) {
      const value = smoother.advance(0.05, 0.1);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
    expect(previous).toBeCloseTo(1, 6);
  });

  it("covers about 63% of the distance after one time constant", () => {
    const smoother = new OnePoleSmoother(0);
    smoother.setTarget(1);
    expect(smoother.advance(0.15, 0.15)).toBeCloseTo(1 - Math.exp(-1), 6);
  });

  it("snaps to the target with no elapsed time or no time constant", () => {
    const smoother = new OnePoleSmoother(0);
    smoother.setTarget(0.7);
    expect(smoother.advance(0, 0.15)).toBe(0.7);

    smoother.setTarget(0.2);
    expect(smoother.advance(0.1, 0)).toBe(0.2);
  });

  it("treats non-finite values as silence and supports a hard reset", () => {
    const smoother = new OnePoleSmoother(0.5);
    smoother.setTarget(Number.NaN);
    expect(smoother.target).toBe(0);
    expect(smoother.advance(10, 0.01)).toBeCloseTo(0, 6);

    smoother.reset(Number.NaN);
    expect(smoother.value).toBe(0);

    smoother.reset(0.4);
    expect(smoother.value).toBe(0.4);
    expect(smoother.target).toBe(0.4);
  });

  it("starts at the initial value without a first-step jump", () => {
    const smoother = new OnePoleSmoother(0.3);
    expect(smoother.value).toBe(0.3);
    expect(smoother.advance(0.05, 0.15)).toBe(0.3);
  });
});
