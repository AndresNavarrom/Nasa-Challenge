import { describe, expect, it } from "vitest";
import {
  arcAngleAt,
  arcAngleOfFraction,
  arcFractionOfAngle,
  arcFrame,
  arcPath,
  arcPoint,
  arcVisibleDegrees,
  spreadAngles,
} from "./arcLayout";

describe("arc frame", () => {
  it("is centred on the view and larger than the planet", () => {
    const frame = arcFrame(1600, 848);
    expect(frame?.cx).toBe(800);
    expect(frame?.cy).toBe(424);
    expect(frame?.radius).toBe(1600 / 2 - 240);
  });

  it("stays close to the planet on a view that is not very wide", () => {
    expect(arcFrame(1280, 720)?.radius).toBeCloseTo(720 * 0.64, 6);
    expect(arcFrame(1300, 800)?.radius).toBe(1300 / 2 - 170);
  });

  it("does not open wider than the view shows on a very wide view", () => {
    expect(arcFrame(2560, 900)?.radius).toBeCloseTo(900 * 0.78, 6);
  });

  it("knows how far along the arcs the view reaches", () => {
    const frame = { cx: 800, cy: 400, radius: 800 };
    expect(arcVisibleDegrees(frame)).toBeCloseTo(30, 6);
    expect(arcVisibleDegrees(frame, 400)).toBe(0);
    expect(arcVisibleDegrees({ cx: 800, cy: 400, radius: 300 })).toBe(90);
  });

  it("is not drawn on a phone, a short view or a view too narrow to clear the planet", () => {
    expect(arcFrame(390, 844)).toBeNull();
    expect(arcFrame(1400, 480)).toBeNull();
    expect(arcFrame(1024, 768)).toBeNull();
    expect(arcFrame(Number.NaN, 800)).toBeNull();
  });
});

describe("points on the arcs", () => {
  const frame = { cx: 800, cy: 400, radius: 600 };

  it("puts 0 degrees at the middle of each side", () => {
    expect(arcPoint(frame, "left", 0)).toEqual({ x: 200, y: 400 });
    expect(arcPoint(frame, "right", 0)).toEqual({ x: 1400, y: 400 });
  });

  it("goes down for positive angles and mirrors the two sides", () => {
    const left = arcPoint(frame, "left", 30);
    const right = arcPoint(frame, "right", 30);
    expect(left.y).toBeCloseTo(700, 6);
    expect(right.y).toBeCloseTo(700, 6);
    expect(left.x + right.x).toBeCloseTo(1600, 6);
    expect(arcPoint(frame, "left", -30).y).toBeCloseTo(100, 6);
  });

  it("moves outside the circle with an offset", () => {
    expect(arcPoint(frame, "right", 0, 40).x).toBe(1440);
    expect(arcPoint(frame, "left", 0, 40).x).toBe(160);
  });

  it("finds the angle of a point again", () => {
    for (const side of ["left", "right"] as const) {
      for (const degrees of [-35, -10, 0, 12, 40]) {
        const point = arcPoint(frame, side, degrees, 25);
        expect(arcAngleAt(frame, side, point.x, point.y)).toBeCloseTo(degrees, 6);
      }
    }
  });
});

describe("arc helpers", () => {
  it("spreads angles evenly around a centre", () => {
    expect(spreadAngles(5, 10)).toEqual([-20, -10, 0, 10, 20]);
    expect(spreadAngles(2, 10, 5)).toEqual([0, 10]);
    expect(spreadAngles(1, 10)).toEqual([0]);
  });

  it("draws each side as a short arc of the circle", () => {
    const frame = { cx: 800, cy: 400, radius: 600 };
    expect(arcPath(frame, "right", -30, 30)).toBe("M 1319.62 100.00 A 600.00 600.00 0 0 1 1319.62 700.00");
    expect(arcPath(frame, "left", -30, 30)).toBe("M 280.38 100.00 A 600.00 600.00 0 0 0 280.38 700.00");
    // Drawn upwards, the turn is the other way.
    expect(arcPath(frame, "right", 30, -30)).toContain(" 0 0 0 ");
  });

  it("maps a line along the arc to angles and back, within its ends", () => {
    expect(arcAngleOfFraction(6, -32, 0)).toBe(6);
    expect(arcAngleOfFraction(6, -32, 1)).toBe(-32);
    expect(arcAngleOfFraction(6, -32, 0.5)).toBe(-13);
    expect(arcFractionOfAngle(6, -32, -13)).toBeCloseTo(0.5, 6);
    expect(arcFractionOfAngle(6, -32, 20)).toBe(0);
    expect(arcFractionOfAngle(6, -32, -60)).toBe(1);
    expect(arcFractionOfAngle(5, 5, 5)).toBe(0);
  });
});
