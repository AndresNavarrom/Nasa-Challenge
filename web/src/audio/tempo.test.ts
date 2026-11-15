import { describe, expect, it } from "vitest";
import { TEMPO_BEATS_PER_FRAME, TEMPO_STYLES, tempoIndex, tempoStep } from "./tempo";

describe("tempo marks", () => {
  it("uses the layer units: hourly smoke, daily CO2, monthly lightning", () => {
    expect(TEMPO_BEATS_PER_FRAME.smoke).toBe(3);
    expect(TEMPO_BEATS_PER_FRAME.co2).toBe(1);
    expect(TEMPO_BEATS_PER_FRAME.lightning).toBe(1);
    expect(TEMPO_BEATS_PER_FRAME.forest).toBeUndefined();
  });

  it("spaces marks across the timeline by frame and unit", () => {
    expect(tempoStep(488, 3)).toBeCloseTo(1 / (487 * 3), 12);
    expect(tempoStep(366, 1)).toBeCloseTo(1 / 365, 12);
    expect(tempoStep(1, 1)).toBeNull();
    expect(tempoStep(10, undefined)).toBeNull();
    expect(tempoIndex(0.5, 1 / 10)).toBe(5);
    expect(tempoIndex(1, 1 / 10)).toBe(10);
  });

  it("breathes for smoke and CO2 and ticks for lightning", () => {
    expect(TEMPO_STYLES.smoke?.kind).toBe("breath");
    expect(TEMPO_STYLES.co2?.kind).toBe("breath");
    expect(TEMPO_STYLES.lightning?.kind).toBe("mark");
    expect(TEMPO_STYLES.lightning!.gain).toBeGreaterThan(TEMPO_STYLES.smoke!.gain);
  });
});
