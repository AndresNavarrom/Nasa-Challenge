import { describe, expect, it } from "vitest";
import type { BoundingBox } from "../data/types";
import { bboxCenter, lonLatToPlanePoint } from "../scene/geo";
import { sceneMapPosition } from "./geometry";

const AMAZON: BoundingBox = { west: -80, south: -20, east: -44, north: 8 };

describe("scene map position", () => {
  it("puts the centre of the Amazon at the centre of the map plane", () => {
    const center = bboxCenter(AMAZON);
    expect(sceneMapPosition(center, AMAZON).x).toBeCloseTo(0, 6);
    expect(sceneMapPosition(center, AMAZON).y).toBeCloseTo(0, 6);
  });

  it("shifts a point by the same amount as the map plane", () => {
    const center = bboxCenter(AMAZON);
    const shift = lonLatToPlanePoint(center.lon, center.lat);
    const point = lonLatToPlanePoint(-68.546, -3.398);
    const position = sceneMapPosition({ lon: -68.546, lat: -3.398 }, AMAZON);
    expect(position.x).toBeCloseTo(point.x - shift.x, 6);
    expect(position.y).toBeCloseTo(point.y - shift.y, 6);
  });
});
