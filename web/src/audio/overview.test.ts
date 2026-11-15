import { describe, expect, it } from "vitest";
import { MAJOR_PENTATONIC_SEMITONES, MINOR_PENTATONIC_SEMITONES } from "./mapping";
import {
  OVERVIEW_BASE_HZ,
  OVERVIEW_COLUMNS,
  OVERVIEW_INSTRUMENTS,
  OVERVIEW_ROWS,
  buildOverviewColumns,
  overviewGain,
  overviewPitchHz,
  visibleAverage,
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

  it("uses the visible average as the trigger threshold", () => {
    expect(visibleAverage([0.2, 0.8, null])).toBeCloseTo(0.5, 6);
    expect(visibleAverage([null, null])).toBe(0);
    const field: VisibleField = [
      { screenX: 0, cells: [{ lon: -10, lat: 0, screenX: 0, screenY: 0.5 }] },
      { screenX: 1, cells: [{ lon: 10, lat: 0, screenX: 1, screenY: 0.5 }] },
    ];
    const columns = buildOverviewColumns(field, (lon) => (lon < 0 ? 0.2 : 0.8));
    expect(columns[0]!.cells[0]!.gain).toBe(0);
    expect(columns[1]!.cells[0]!.gain).toBeGreaterThan(0);

    // A uniform field is at its own average; it still sounds.
    const uniform = buildOverviewColumns(field, () => 0.5);
    expect(uniform[0]!.cells[0]!.gain).toBeGreaterThan(0);
    expect(uniform[1]!.cells[0]!.gain).toBeGreaterThan(0);
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

  it("uses the minor pentatonic scale for CO2 and keeps the others major", () => {
    expect(OVERVIEW_INSTRUMENTS.co2.scale).toBe(MINOR_PENTATONIC_SEMITONES);
    expect(OVERVIEW_INSTRUMENTS.forest.scale).toBe(MAJOR_PENTATONIC_SEMITONES);
    expect(overviewPitchHz(0, MINOR_PENTATONIC_SEMITONES)).toBeCloseTo(OVERVIEW_BASE_HZ, 6);
    expect(overviewPitchHz(90, MINOR_PENTATONIC_SEMITONES)).toBeGreaterThan(
      overviewPitchHz(0, MINOR_PENTATONIC_SEMITONES),
    );
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
