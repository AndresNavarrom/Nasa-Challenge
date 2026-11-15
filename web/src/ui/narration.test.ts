import { describe, expect, it } from "vitest";
import type { LoadedLayer } from "../data/types";
import {
  HELP_PHRASE,
  coordsPhrase,
  firstSentence,
  layerChangePhrase,
  levelOf,
  modePhrase,
  pickVoice,
  scenePhrase,
  valuePhrase,
  whereAmIPhrase,
  type VoiceInfo,
} from "./narration";

function layer(overrides: Partial<LoadedLayer["manifest"]> = {}): LoadedLayer {
  return {
    manifest: {
      id: "smoke",
      title: "Wildfire smoke",
      description: "Smoke from fires seen through the air. More smoke sounds rougher.",
      static: false,
      sample: false,
      dates: ["2026-08-01", "2026-08-02"],
      ...overrides,
    },
  } as LoadedLayer;
}

describe("levelOf and valuePhrase", () => {
  it("splits the scale in thirds", () => {
    expect(levelOf(0)).toBe("low");
    expect(levelOf(0.33)).toBe("low");
    expect(levelOf(0.34)).toBe("medium");
    expect(levelOf(0.66)).toBe("medium");
    expect(levelOf(0.67)).toBe("high");
    expect(levelOf(1)).toBe("high");
  });

  it("says the level and the percent", () => {
    expect(valuePhrase("Wildfire smoke", 0.72)).toBe("Wildfire smoke: high, 72 percent.");
  });

  it("says no data for a missing or broken value, and clamps out-of-range values", () => {
    expect(valuePhrase("CO2", null)).toBe("CO2: no data here.");
    expect(valuePhrase("CO2", Number.NaN)).toBe("CO2: no data here.");
    expect(valuePhrase("CO2", 1.4)).toBe("CO2: high, 100 percent.");
    expect(valuePhrase("CO2", -0.2)).toBe("CO2: low, 0 percent.");
  });
});

describe("coordsPhrase", () => {
  it("says whole degrees with their direction, latitude first", () => {
    expect(coordsPhrase(-60.12, -3.4)).toBe("3 degrees south, 60 degrees west");
    expect(coordsPhrase(12.6, 45.5)).toBe("46 degrees north, 13 degrees east");
    expect(coordsPhrase(0.2, -0.3)).toBe("0 degrees, 0 degrees");
  });
});

describe("layer, mode and scene phrases", () => {
  it("keeps only the first sentence of a long description", () => {
    expect(firstSentence("One. Two. Three.")).toBe("One.");
    expect(firstSentence("No full stop")).toBe("No full stop");
    expect(firstSentence("Made by NASA's GEDI, 2019 to 2025. Fixed scale.")).toBe("Made by NASA's GEDI, 2019 to 2025.");
  });

  it("names the layer, or says the plain Earth is silent", () => {
    expect(layerChangePhrase(layer())).toBe("Wildfire smoke. Smoke from fires seen through the air.");
    expect(layerChangePhrase(null)).toMatch(/no layer.*silent/i);
  });

  it("says the arrival on a map and the way back, and nothing while leaving the map", () => {
    expect(modePhrase("to-map", "Amazon")).toBe("Flying to Amazon.");
    expect(modePhrase("map", "Amazon")).toMatch(/^Amazon map\./);
    expect(modePhrase("globe", "Amazon")).toBe("Back on the planet.");
    expect(modePhrase("to-globe", "Amazon")).toBeNull();
  });

  it("reads a scene and how to close it", () => {
    expect(scenePhrase({ title: "Amazon Storms", description: "Storms are part of the cycle." })).toBe(
      "Amazon Storms. Storms are part of the cycle. Press Escape to close it.",
    );
  });

  it("names the three keys in the help", () => {
    for (const key of ["V ", "I ", "H "]) expect(HELP_PHRASE).toContain(key);
  });
});

describe("whereAmIPhrase", () => {
  it("tells the view, layer, date, place and value", () => {
    const phrase = whereAmIPhrase({
      mode: "map",
      regionName: "Amazon",
      layer: layer(),
      dateLabel: "2026-08-02",
      point: { lon: -60, lat: -3 },
      value: 0.5,
      playing: true,
    });
    expect(phrase).toBe(
      "You are on the Amazon map. Layer: Wildfire smoke. Date: 2026-08-02, playing. " +
        "Point: 3 degrees south, 60 degrees west. Wildfire smoke: medium, 50 percent.",
    );
  });

  it("gives a fixed layer its period and says when the timeline is paused", () => {
    const fixed = whereAmIPhrase({
      mode: "globe",
      regionName: "Amazon",
      layer: layer({ static: true, dates: ["2019-2025"] }),
      dateLabel: "2019-2025",
      point: null,
      value: null,
      playing: false,
    });
    expect(fixed).toContain("Period: 2019-2025.");
    expect(fixed).toContain("No point is under the cursor.");
    const paused = whereAmIPhrase({
      mode: "globe",
      regionName: "Amazon",
      layer: layer(),
      dateLabel: "2026-08-01",
      point: null,
      value: null,
      playing: false,
    });
    expect(paused).toContain("Date: 2026-08-01, paused.");
  });

  it("explains that there is no data sound without a layer, and gives no value", () => {
    const phrase = whereAmIPhrase({
      mode: "globe",
      regionName: "Amazon",
      layer: null,
      dateLabel: "",
      point: { lon: 10, lat: 20 },
      value: null,
      playing: true,
    });
    expect(phrase).toMatch(/No layer is chosen/);
    expect(phrase).toContain("Point: 20 degrees north, 10 degrees east.");
    expect(phrase).not.toMatch(/percent|no data here/);
  });
});

describe("pickVoice", () => {
  const voice = (lang: string, extra: Partial<VoiceInfo> = {}): VoiceInfo => ({
    lang,
    default: false,
    localService: false,
    ...extra,
  });

  it("prefers the default voice of the language, then a local one, then any", () => {
    const local = voice("en-GB", { localService: true });
    const preferred = voice("en-US", { default: true });
    expect(pickVoice([voice("en-US"), local, preferred], "en")).toBe(preferred);
    expect(pickVoice([voice("en-US"), local], "en")).toBe(local);
    const any = voice("en_AU");
    expect(pickVoice([voice("es-ES", { default: true }), any], "en")).toBe(any);
  });

  it("returns null when no voice speaks the language", () => {
    expect(pickVoice([voice("es-ES"), voice("eng")], "en")).toBeNull();
    expect(pickVoice([], "en")).toBeNull();
  });
});
