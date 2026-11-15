import { describe, expect, it } from "vitest";
import { modeLabel } from "./PlanetHud";

describe("modeLabel (regions)", () => {
  it("names the region under the cursor and the region being visited", () => {
    expect(modeLabel("globe", "Amazon", "Congo Basin")).toBe("Congo Basin: click (or tap again) to fly there.");
    expect(modeLabel("to-map", "Congo Basin")).toBe("Flying to Congo Basin…");
    expect(modeLabel("map", "Congo Basin", "Congo Basin")).toBe("Congo Basin map. Click to return or double-click a point to lock its sound.");
  });

  it("falls back to the general hint and the Amazon", () => {
    expect(modeLabel("globe")).toMatch(/click any region/);
    expect(modeLabel("globe")).toMatch(/double-click a point/);
    expect(modeLabel("map")).toMatch(/^Amazon map\. Click to return/);
    expect(modeLabel("to-globe", "Siberian taiga", "Siberian taiga")).toBe("Back to the planet…");
  });
});
