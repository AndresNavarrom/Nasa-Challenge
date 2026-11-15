import { describe, expect, it } from "vitest";
import { formatLatitude, formatLongitude, formatLayerValue } from "./coordinates";

describe("coordinates as text", () => {
  it("names the hemisphere", () => {
    expect(formatLongitude(-61.52)).toBe("61.5° W");
    expect(formatLongitude(12.34)).toBe("12.3° E");
    expect(formatLatitude(-3.21)).toBe("3.2° S");
    expect(formatLatitude(45)).toBe("45.0° N");
  });

  it("gives zero no hemisphere, also when it only rounds to zero", () => {
    expect(formatLongitude(0)).toBe("0.0°");
    expect(formatLongitude(-0.04)).toBe("0.0°");
    expect(formatLatitude(0.3, 0)).toBe("0°");
  });

  it("rounds to the decimals asked for", () => {
    expect(formatLongitude(-60.4, 0)).toBe("60° W");
    expect(formatLatitude(7.55, 0)).toBe("8° N");
  });

  it("writes a layer value as a percentage and says when there is no data", () => {
    expect(formatLayerValue(0.426)).toBe("43 %");
    expect(formatLayerValue(0)).toBe("0 %");
    expect(formatLayerValue(null)).toBe("no data here");
  });
});
