import { describe, expect, it } from "vitest";
import { allHeard, heardCount, isHeard, withHeard } from "./heardLayers";

const IDS = ["forest", "smoke", "co2", "lightning"] as const;

describe("heard layers (Listen to checkboxes)", () => {
  it("starts with every layer heard", () => {
    const heard = allHeard(IDS);
    expect(IDS.every((id) => isHeard(heard, id))).toBe(true);
    expect(heardCount(heard, IDS)).toBe(4);
  });

  it("silences one layer without touching the others or the original", () => {
    const start = allHeard(IDS);
    const next = withHeard(start, "smoke", false);
    expect(isHeard(next, "smoke")).toBe(false);
    expect(isHeard(next, "forest")).toBe(true);
    expect(heardCount(next, IDS)).toBe(3);
    expect(isHeard(start, "smoke")).toBe(true);
  });

  it("turns a silenced layer back on", () => {
    const off = withHeard(allHeard(IDS), "co2", false);
    expect(isHeard(withHeard(off, "co2", true), "co2")).toBe(true);
  });

  it("treats a layer it was never told about as heard", () => {
    expect(isHeard({}, "forest")).toBe(true);
  });
});
