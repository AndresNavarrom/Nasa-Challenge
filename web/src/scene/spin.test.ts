import { describe, expect, it } from "vitest";
import { SPIN_SPEED, spinStep, type SpinConditions } from "./spin";

const ON: SpinConditions = { spinning: true, autoRotate: true, mode: "globe", dragging: false };

describe("planet auto-rotation", () => {
  it("turns the planet on the planet view while Auto-rotate is on", () => {
    expect(spinStep(1, 0.5, ON)).toBeCloseTo(1 + SPIN_SPEED * 0.1);
    expect(spinStep(1, 0.05, ON)).toBeCloseTo(1 + SPIN_SPEED * 0.05);
  });

  it("keeps the planet still when Auto-rotate is off", () => {
    expect(spinStep(1, 0.05, { ...ON, autoRotate: false })).toBe(1);
  });

  it("keeps the planet still while it is dragged, during a transition or on the Amazon map", () => {
    expect(spinStep(1, 0.05, { ...ON, dragging: true })).toBe(1);
    expect(spinStep(1, 0.05, { ...ON, spinning: false })).toBe(1);
    expect(spinStep(1, 0.05, { ...ON, mode: "map" })).toBe(1);
    expect(spinStep(1, 0.05, { ...ON, mode: "to-globe" })).toBe(1);
  });

  it("ignores frame steps that are zero, negative or not a number", () => {
    expect(spinStep(1, 0, ON)).toBe(1);
    expect(spinStep(1, -0.1, ON)).toBe(1);
    expect(spinStep(1, Number.NaN, ON)).toBe(1);
  });
});
