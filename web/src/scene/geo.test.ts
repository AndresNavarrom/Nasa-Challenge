import { Euler, SphereGeometry, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { BoundingBox } from "../data/types";
import { WORLD_BBOX, lonLatToUV } from "../lib/interpolate";
import {
  bboxCenter,
  facingRotation,
  isInsideBbox,
  lonLatToSpherePoint,
  nearestEquivalentAngle,
  planeUvToLonLat,
  regionUv,
  screenX01,
  spherePointToLonLat,
  viewCentre,
} from "./geo";

const AMAZON: BoundingBox = { west: -80, south: -20, east: -44, north: 8 };

describe("sphere <-> longitude/latitude (FR4.1)", () => {
  it("places the equator at the prime meridian on +X and back, matching three.js sphere texture coordinates", () => {
    const point = lonLatToSpherePoint(0, 0);
    expect(point.x).toBeCloseTo(1, 10);
    expect(point.y).toBeCloseTo(0, 10);
    expect(point.z).toBeCloseTo(0, 10);
    const back = spherePointToLonLat(point.x, point.y, point.z);
    expect(back.lon).toBeCloseTo(0, 10);
    expect(back.lat).toBeCloseTo(0, 10);

    // The picking sphere is a SphereGeometry and earth.jpg follows its texture
    // coordinates: every vertex away from the poles and the seam must agree.
    const sphere = new SphereGeometry(1, 16, 8);
    const position = sphere.getAttribute("position");
    const uv = sphere.getAttribute("uv");
    for (let index = 0; index < position.count; index += 1) {
      const u = uv.getX(index);
      const v = uv.getY(index);
      if (v <= 0.01 || v >= 0.99 || u <= 0.01 || u >= 0.99) continue;
      const { lon, lat } = spherePointToLonLat(position.getX(index), position.getY(index), position.getZ(index));
      // Geometry attributes are stored as 32-bit floats: 4 decimals of a degree.
      expect(lon).toBeCloseTo(-180 + 360 * u, 4);
      expect(lat).toBeCloseTo(-90 + 180 * v, 4);
    }
    sphere.dispose();

    expect(() => spherePointToLonLat(0, 0, 0)).toThrow(/non-zero/);
  });

  it("takes a point of the Amazon to the sphere and back, at any radius", () => {
    const manaus = { lon: -60.02, lat: -3.1 };
    const point = lonLatToSpherePoint(manaus.lon, manaus.lat, 2.5);
    expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(2.5, 10);
    expect(point.z).toBeGreaterThan(0); // the Americas face the default camera on +Z
    const back = spherePointToLonLat(point.x, point.y, point.z);
    expect(back.lon).toBeCloseTo(manaus.lon, 8);
    expect(back.lat).toBeCloseTo(manaus.lat, 8);

    const dateLine = spherePointToLonLat(...Object.values(lonLatToSpherePoint(179.5, 10)) as [number, number, number]);
    expect(dateLine.lon).toBeCloseTo(179.5, 8);
  });
});

describe("flattened plane -> longitude/latitude (FR4.2)", () => {
  it("maps the corners and centre of the world plane and of the Amazon rectangle", () => {
    expect(planeUvToLonLat(0, 0)).toEqual({ lon: -180, lat: 90 });
    expect(planeUvToLonLat(1, 1)).toEqual({ lon: 180, lat: -90 });
    expect(planeUvToLonLat(0.5, 0.5)).toEqual({ lon: 0, lat: 0 });
    expect(planeUvToLonLat(-0.2, 1.4)).toEqual({ lon: -180, lat: -90 }); // limited to the plane

    const corners = [
      { lon: AMAZON.west, lat: AMAZON.north },
      { lon: AMAZON.east, lat: AMAZON.north },
      { lon: AMAZON.west, lat: AMAZON.south },
      { lon: AMAZON.east, lat: AMAZON.south },
      bboxCenter(AMAZON),
    ];
    for (const corner of corners) {
      const uv = lonLatToUV(corner.lon, corner.lat, WORLD_BBOX);
      expect(uv).not.toBeNull();
      const back = planeUvToLonLat(uv!.u, uv!.v);
      expect(back.lon).toBeCloseTo(corner.lon, 10);
      expect(back.lat).toBeCloseTo(corner.lat, 10);
    }
    expect(bboxCenter(AMAZON)).toEqual({ lon: -62, lat: -6 });
  });
});

describe("Amazon rectangle (FR2.1)", () => {
  it("tells a point inside the Amazon from one outside it", () => {
    expect(isInsideBbox(-60, -3, AMAZON)).toBe(true);
    expect(isInsideBbox(-30, -10, AMAZON)).toBe(false); // Atlantic Ocean
    expect(isInsideBbox(-60, 20, AMAZON)).toBe(false); // Caribbean, north of the box
    expect(isInsideBbox(AMAZON.west, AMAZON.north, AMAZON)).toBe(true); // edges count
    expect(isInsideBbox(300, -3, AMAZON)).toBe(true); // 300 = -60 after normalizing
  });
});

describe("Amazon crop of the base image (FR1.3)", () => {
  it("gives (0, 0) at the south-west corner, (1, 1) at the north-east corner and null outside", () => {
    expect(regionUv(AMAZON.west, AMAZON.south, AMAZON)).toEqual({ u: 0, v: 0 });
    expect(regionUv(AMAZON.east, AMAZON.north, AMAZON)).toEqual({ u: 1, v: 1 });
    // The centre of the rectangle is the centre of the crop.
    const center = regionUv(-62, -6, AMAZON);
    expect(center?.u).toBeCloseTo(0.5, 10);
    expect(center?.v).toBeCloseTo(0.5, 10);

    expect(regionUv(-30, -10, AMAZON)).toBeNull(); // Atlantic Ocean, east of the box
    expect(regionUv(-60, 20, AMAZON)).toBeNull(); // north of the box
    expect(regionUv(-81, -5, AMAZON)).toBeNull(); // just west of the box
  });
});

describe("horizontal screen position (FR4.3)", () => {
  it("gives 0 at the left edge, 1 at the right edge and stays within 0..1 outside the canvas", () => {
    expect(screenX01(100, 100, 800)).toBe(0);
    expect(screenX01(900, 100, 800)).toBe(1);
    expect(screenX01(500, 100, 800)).toBe(0.5);
    expect(screenX01(20, 100, 800)).toBe(0);
    expect(screenX01(1500, 100, 800)).toBe(1);
    expect(screenX01(300, 0, 0)).toBe(0.5); // canvas not laid out yet
  });
});

describe("turning the Amazon to the camera (FR2.1)", () => {
  it("leaves the centre of the rectangle facing a camera on +Z", () => {
    const facesCamera = (lon: number, lat: number): Vector3 => {
      const { pitch, yaw } = facingRotation(lon, lat);
      const { x, y, z } = lonLatToSpherePoint(lon, lat);
      return new Vector3(x, y, z).applyEuler(new Euler(pitch, yaw, 0, "XYZ"));
    };
    const center = bboxCenter(AMAZON);
    for (const point of [center, { lon: 0, lat: 0 }, { lon: 135, lat: 40 }]) {
      const turned = facesCamera(point.lon, point.lat);
      expect(turned.x).toBeCloseTo(0, 10);
      expect(turned.y).toBeCloseTo(0, 10);
      expect(turned.z).toBeCloseTo(1, 10);
    }

    // The planet turns the short way even after spinning many times.
    const from = 7 * Math.PI + 0.3;
    const target = facingRotation(center.lon, center.lat).yaw;
    const nearest = nearestEquivalentAngle(from, target);
    expect(Math.abs(nearest - from)).toBeLessThanOrEqual(Math.PI);
    expect(Math.cos(nearest)).toBeCloseTo(Math.cos(target), 10);
    expect(Math.sin(nearest)).toBeCloseTo(Math.sin(target), 10);
  });
});

describe("centre of the view (compass)", () => {
  it("is the place facingRotation turns to the camera", () => {
    for (const [lon, lat] of [[-60, 0], [0, 0], [120, 35], [-179, -50]] as const) {
      const { yaw, pitch } = facingRotation(lon, lat);
      const centre = viewCentre(yaw, pitch);
      expect(centre.lon).toBeCloseTo(lon, 6);
      expect(centre.lat).toBeCloseTo(lat, 6);
    }
  });

  it("keeps the longitude within -180..180 after many turns", () => {
    const { yaw } = facingRotation(-60, 0);
    expect(viewCentre(yaw + 6 * Math.PI, 0).lon).toBeCloseTo(-60, 6);
    expect(viewCentre(yaw - 4 * Math.PI, 0).lon).toBeCloseTo(-60, 6);
  });
});
