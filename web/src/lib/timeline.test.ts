import { describe, expect, it } from "vitest";
import type { LayerManifest } from "../data/types";
import { advancePosition, dateLabelAt, framePosition } from "./timeline";

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

  it("advances with playback and loops back to the start", () => {
    expect(advancePosition(0, 5, 20)).toBeCloseTo(0.25, 6);
    expect(advancePosition(0.9, 4, 20)).toBeCloseTo(0.1, 6); // wrapped around
    expect(advancePosition(0.9, 4, 20, false)).toBe(1); // stops at the end without looping
    expect(advancePosition(0.5, 1, 0)).toBe(0.5); // invalid duration: stay put
  });
});
