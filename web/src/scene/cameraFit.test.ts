import { describe, expect, it } from "vitest";
import { GLOBE_CAMERA_Z, globeCameraZ } from "./FocusTransition";
import { GLOBE_RADIUS } from "./geo";

const FOV = 45;

/** Half the horizontal angle the planet spans from distance `z`, and half the screen's horizontal angle. */
function fits(z: number, aspect: number): boolean {
  const planet = Math.asin(GLOBE_RADIUS / z);
  const screen = Math.atan(Math.tan((FOV * Math.PI) / 360) * aspect);
  return planet < screen;
}

describe("planet camera on any screen", () => {
  it("keeps the usual distance on a wide screen (laptop, phone turned sideways)", () => {
    expect(globeCameraZ(FOV, 16 / 9)).toBe(GLOBE_CAMERA_Z);
    expect(globeCameraZ(FOV, 812 / 375)).toBe(GLOBE_CAMERA_Z);
  });

  it("moves back on a phone held upright so the whole planet fits the width", () => {
    const aspect = 375 / 812;
    const z = globeCameraZ(FOV, aspect);
    expect(z).toBeGreaterThan(GLOBE_CAMERA_Z);
    expect(fits(z, aspect)).toBe(true);
    expect(fits(GLOBE_CAMERA_Z, aspect)).toBe(false);
  });

  it("falls back to a square screen for an aspect that is zero or not a number", () => {
    expect(globeCameraZ(FOV, 0)).toBe(globeCameraZ(FOV, 1));
    expect(globeCameraZ(FOV, Number.NaN)).toBe(globeCameraZ(FOV, 1));
  });
});
