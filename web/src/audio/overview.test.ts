import { describe, expect, it } from "vitest";
import {
  OVERVIEW_BASE_HZ,
  OVERVIEW_COLUMNS,
  OVERVIEW_INSTRUMENTS,
  OVERVIEW_ROWS,
  buildOverviewColumns,
  overviewGain,
  overviewPitchHz,
  type VisibleField,
} from "./overview";

describe("overview mapping", () => {
  it("covers the visible globe with 72 cells", () => {
    expect(OVERVIEW_COLUMNS * OVERVIEW_ROWS).toBe(72);
  });

  it("places the equator above the poles on the pentatonic scale", () => {
    expect(overviewPitchHz(0)).toBeCloseTo(OVERVIEW_BASE_HZ, 6);
    expect(overviewPitchHz(45)).toBeGreaterThan(overviewPitchHz(0));
    expect(overviewPitchHz(90)).toBeGreaterThan(overviewPitchHz(45));
    expect(overviewPitchHz(-45)).toBeCloseTo(overviewPitchHz(45), 6);
  });

  it("turns values into perceptually useful gains and no-data into silence", () => {
    expect(overviewGain(null)).toBe(0);
    expect(overviewGain(Number.NaN)).toBe(0);
    expect(overviewGain(0)).toBe(0);
    expect(overviewGain(1)).toBeGreaterThan(overviewGain(0.5));
    expect(overviewGain(0.5)).toBeGreaterThan(0);
  });

  it("builds columns from screen x and visible cells, preserving empty rows", () => {
    const field: VisibleField = [
      {
        screenX: 0,
        cells: [
          { lon: -90, lat: 60, screenX: 0, screenY: 0.1 },
          null,
          { lon: -80, lat: -20, screenX: 0, screenY: 0.7 },
        ],
      },
      {
        screenX: 1,
        cells: [
          { lon: 90, lat: 0, screenX: 1, screenY: 0.1 },
          null,
          null,
        ],
      },
    ];
    const columns = buildOverviewColumns(field, (lon) => (lon < 0 ? 0.8 : null));
    expect(columns[0]!.pan).toBeLessThan(0);
    expect(columns[1]!.pan).toBeGreaterThan(0);
    expect(columns[0]!.cells).toHaveLength(3);
    expect(columns[0]!.cells[1]!.gain).toBe(0);
    expect(columns[0]!.cells[0]!.gain).toBeGreaterThan(0);
    expect(columns[1]!.cells[0]!.gain).toBe(0);
  });

  it("gives every layer an editable instrument with its requested waveform", () => {
    expect(Object.keys(OVERVIEW_INSTRUMENTS).sort()).toEqual(["co2", "forest", "lightning", "smoke"]);
    expect(OVERVIEW_INSTRUMENTS.forest.wave).toBe("triangle");
    expect(OVERVIEW_INSTRUMENTS.smoke.wave).toBe("sawtooth");
    expect(OVERVIEW_INSTRUMENTS.co2.wave).toBe("sawtooth");
    expect(OVERVIEW_INSTRUMENTS.lightning.wave).toBe("square");
    for (const instrument of Object.values(OVERVIEW_INSTRUMENTS)) {
      expect(instrument.filterHz).toBeGreaterThan(0);
      expect(instrument.gain).toBeGreaterThan(0);
    }
  });
});
