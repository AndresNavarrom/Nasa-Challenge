import { describe, expect, it } from "vitest";
import type { Grid, LayerManifest, LoadedLayer } from "../data/types";
import timelineBarSource from "./TimelineBar.tsx?raw";
import { formatPercent, scrubValueText, timedLayers } from "./timelineFormat";

function layer(id: LayerManifest["id"], isStatic: boolean, dates: string[]): LoadedLayer {
  const grid: Grid = { width: 1, height: 1, frames: dates.length, data: new Uint8Array(dates.length) };
  const info = { width: 1, height: 1, frames: dates.length, file: "x.bin", texture: "x.png" };
  const manifest: LayerManifest = {
    id,
    title: id,
    description: "Test layer",
    source: { title: "Test", url: "https://example.com" },
    static: isStatic,
    sample: false,
    dates,
    global: info,
    region: info,
  };
  return { manifest, global: grid, region: grid };
}

describe("timeline bar text", () => {
  it("shows the date of the layers that change over time only", () => {
    const layers = [
      layer("forest", true, ["Apr 2019 - Jul 2025"]),
      layer("smoke", false, ["00:30", "01:30", "02:30"]),
      layer("co2", false, ["Feb 23 00:00", "Feb 23 06:00"]),
      layer("lightning", true, ["2017 - 2023"]),
    ];
    expect(timedLayers(layers).map((item) => item.manifest.id)).toEqual(["smoke", "co2"]);
  });

  it("does not list a changing layer that has a single date", () => {
    expect(timedLayers([layer("smoke", false, ["only one"])])).toEqual([]);
  });

  it("writes the position as a whole percentage, limited to 0..100", () => {
    expect(formatPercent(0)).toBe("0 %");
    expect(formatPercent(0.456)).toBe("46 %");
    expect(formatPercent(1)).toBe("100 %");
    expect(formatPercent(3)).toBe("100 %");
    expect(formatPercent(Number.NaN)).toBe("0 %");
  });

  it("gives the position slider a spoken value", () => {
    expect(scrubValueText(0.5)).toBe("Timeline at 50 %");
  });

  it("keeps the test ids agreed in docs/TIMELINE-HANDOFF.md", () => {
    for (const id of ["timeline-bar", "timeline-scrub"]) {
      expect(timelineBarSource).toContain(`data-testid="${id}"`);
    }
    expect(timelineBarSource).toContain("data-testid={`timeline-date-${manifest.id}`}");
  });

  it("has no play, pause or speed control: the timeline is static and the person sets it", () => {
    for (const id of ["timeline-play", "timeline-speed", "timeline-elapsed"]) {
      expect(timelineBarSource).not.toContain(`data-testid="${id}"`);
    }
  });
});
