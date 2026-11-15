import { describe, expect, it } from "vitest";
import type { LayerManifest } from "../data/types";
import { advancePosition, dateLabelAt, frameBlend, framePosition } from "./timeline";

type Dated = Pick<LayerManifest, "static" | "dates">;

const forest: Dated = { static: true, dates: ["Apr 2019 - Apr 2020"] };
const smoke: Dated = { static: false, dates: ["Jul 2024", "Mid-season 2024", "Aug 2024"] };
const co2: Dated = {
  static: false,
  dates: ["Feb 23, 2020 00:00 UTC", "Feb 23, 2020 06:00 UTC", "Feb 23, 2020 12:00 UTC", "Feb 23, 2020 18:00 UTC", "Feb 24, 2020 00:00 UTC"],
};

describe("timeline", () => {
  it("gives each layer its own date for a shared 0..1 position", () => {
    // Start, middle and end of the shared timeline.
    expect(dateLabelAt(smoke, 0)).toBe("Jul 2024");
    expect(dateLabelAt(smoke, 0.5)).toBe("Mid-season 2024");
    expect(dateLabelAt(smoke, 1)).toBe("Aug 2024");
    expect(dateLabelAt(co2, 0)).toBe("Feb 23, 2020 00:00 UTC");
    expect(dateLabelAt(co2, 0.5)).toBe("Feb 23, 2020 12:00 UTC");
    expect(dateLabelAt(co2, 1)).toBe("Feb 24, 2020 00:00 UTC");
    // The nearest instant wins between two instants.
    expect(dateLabelAt(co2, 0.3)).toBe("Feb 23, 2020 06:00 UTC");

    // The forest is the fixed base: one date for the whole timeline.
    for (const position of [0, 0.4, 1]) {
      expect(dateLabelAt(forest, position)).toBe("Apr 2019 - Apr 2020");
    }
  });

  it("limits positions outside 0..1 and copes with missing data", () => {
    expect(dateLabelAt(smoke, -3)).toBe("Jul 2024");
    expect(dateLabelAt(smoke, 42)).toBe("Aug 2024");
    expect(dateLabelAt(smoke, Number.NaN)).toBe("Jul 2024");
    expect(dateLabelAt({ static: false, dates: [] }, 0.5)).toBe("");

    expect(framePosition(0.5, 5)).toBe(2);
    expect(framePosition(2, 5)).toBe(4);
    expect(framePosition(0.5, 1)).toBe(0);
    expect(framePosition(0.5, 0)).toBe(0);
  });

  it("walks through the 24 hourly smoke instants while a static layer keeps its only date (FR4.1)", () => {
    const hourlySmoke: Dated = {
      static: false,
      dates: Array.from({ length: 24 }, (_, hour) => `Sep 1, 2026 ${String(hour).padStart(2, "0")}:30 UTC`),
    };
    const lightning: Dated = { static: true, dates: ["2017 - 2023 (accumulated)"] };

    expect(dateLabelAt(hourlySmoke, 0)).toBe("Sep 1, 2026 00:30 UTC");
    expect(dateLabelAt(hourlySmoke, 1)).toBe("Sep 1, 2026 23:30 UTC"); // the 24th date
    expect(framePosition(1, 24)).toBe(23);
    expect(framePosition(0.5, 24)).toBe(11.5);
    expect(dateLabelAt(hourlySmoke, 12 / 23)).toBe("Sep 1, 2026 12:30 UTC");

    for (const position of [0, 0.5, 1]) {
      expect(dateLabelAt(lightning, position)).toBe("2017 - 2023 (accumulated)");
    }
  });

  it("advances with playback and loops back to the start", () => {
    expect(advancePosition(0, 5, 20)).toBeCloseTo(0.25, 6);
    expect(advancePosition(0.9, 4, 20)).toBeCloseTo(0.1, 6); // wrapped around
    expect(advancePosition(0.9, 4, 20, false)).toBe(1); // stops at the end without looping
    expect(advancePosition(0.5, 1, 0)).toBe(0.5); // invalid duration: stay put
  });

  it("gives the two instants to crossfade for any position", () => {
    // Exact instants: no blend needed.
    expect(frameBlend(0, 5)).toEqual({ from: 0, to: 1, mix: 0 });
    expect(frameBlend(0.5, 5)).toEqual({ from: 2, to: 3, mix: 0 });
    expect(frameBlend(1, 5)).toEqual({ from: 4, to: 4, mix: 0 });

    // Between two instants, the mix matches the fractional frame the audio uses.
    const between = frameBlend(0.3, 5);
    expect(between.from).toBe(1);
    expect(between.to).toBe(2);
    expect(between.mix).toBeCloseTo(0.2, 6);

    // A single-frame (static) layer never blends and never leaves the range.
    expect(frameBlend(0.7, 1)).toEqual({ from: 0, to: 0, mix: 0 });
    expect(frameBlend(0.7, 0)).toEqual({ from: 0, to: 0, mix: 0 });
    expect(frameBlend(-1, 5)).toEqual({ from: 0, to: 1, mix: 0 });
    expect(frameBlend(9, 5)).toEqual({ from: 4, to: 4, mix: 0 });
  });
});
