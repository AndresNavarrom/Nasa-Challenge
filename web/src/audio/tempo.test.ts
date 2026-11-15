import { describe, expect, it } from "vitest";
import { TEMPO_BEATS_PER_FRAME, TEMPO_STYLES, tempoIndex, tempoStep } from "./tempo";

describe("tempo marks", () => {
  it("has no layer marks configured", () => {
    expect(Object.keys(TEMPO_BEATS_PER_FRAME)).toEqual([]);
    expect(Object.keys(TEMPO_STYLES)).toEqual([]);
  });

  it("spaces marks across the timeline by frame and unit", () => {
    expect(tempoStep(488, 3)).toBeCloseTo(1 / (487 * 3), 12);
    expect(tempoStep(366, 1)).toBeCloseTo(1 / 365, 12);
    expect(tempoStep(1, 1)).toBeNull();
    expect(tempoStep(10, undefined)).toBeNull();
    expect(tempoIndex(0.5, 1 / 10)).toBe(5);
    expect(tempoIndex(1, 1 / 10)).toBe(10);
  });

});
