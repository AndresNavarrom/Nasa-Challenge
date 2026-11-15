import { describe, expect, it } from "vitest";
import { modeLabel } from "./PlanetHud";

describe("modeLabel (regions)", () => {
  it("names the region under the cursor and the region being visited", () => {
    expect(modeLabel("globe", "Amazon", "Congo Basin")).toBe("Congo Basin: double-click to fly there.");
    expect(modeLabel("to-map", "Congo Basin")).toBe("Flying to Congo Basin…");
    expect(modeLabel("map", "Congo Basin", "Congo Basin")).toBe("Congo Basin map. Double-click it or press Back to Earth to return.");
  });

  it("falls back to the general hint and the Amazon", () => {
    expect(modeLabel("globe")).toMatch(/double-click any region/);
    expect(modeLabel("map")).toMatch(/^Amazon map\. Double-click/);
    expect(modeLabel("to-globe", "Siberian taiga", "Siberian taiga")).toBe("Back to the planet…");
  });
});
