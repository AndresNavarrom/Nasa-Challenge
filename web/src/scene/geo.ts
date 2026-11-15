// Pure coordinate helpers shared by the planet, the flattened map and the
// listening point (FR2.1, FR4.1-FR4.3).
//
// Conventions (they match three.js SphereGeometry, earth.jpg and
// `lonLatToUV(..., WORLD_BBOX)` in lib/interpolate.ts):
// - Sphere: +Y is the north pole, longitude 0 on the equator is +X,
//   longitude -90 is +Z (facing the default camera), longitude +90 is -Z.
//   SphereGeometry's texture coordinate u = 0 is longitude -180.
// - World plane: u runs 0 (longitude -180, west edge) to 1 (longitude 180),
//   v runs 0 (north pole, top) to 1 (south pole, bottom).
// - Rotations are Euler angles in "XYZ" order: yaw about Y is applied to a
//   point first, then pitch about X.

import type { BoundingBox } from "../data/types";
import { clamp01, normalizeLongitude } from "../lib/interpolate";

export const GLOBE_RADIUS = 1;
/** The flattened world keeps the equator's length: 2πR wide, πR tall. */
export const PLANE_WIDTH = 2 * Math.PI * GLOBE_RADIUS;
export const PLANE_HEIGHT = Math.PI * GLOBE_RADIUS;

const DEG = Math.PI / 180;

export interface LonLat {
  lon: number;
  lat: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Point on the sphere of `radius` for a longitude/latitude in degrees. */
export function lonLatToSpherePoint(lon: number, lat: number, radius = GLOBE_RADIUS): Vec3 {
  const phi = (lon + 180) * DEG;
  const theta = (90 - lat) * DEG;
  return {
    x: -radius * Math.cos(phi) * Math.sin(theta),
    y: radius * Math.cos(theta),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

/** Longitude (-180..180) and latitude (-90..90) of a point given in the sphere's own frame. */
export function spherePointToLonLat(x: number, y: number, z: number): LonLat {
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length === 0) {
    throw new Error(`spherePointToLonLat needs a non-zero finite point, got (${x}, ${y}, ${z}).`);
  }
  const lat = Math.asin(Math.min(1, Math.max(-1, y / length))) / DEG;
  const phi = Math.atan2(z, -x);
  return { lon: normalizeLongitude(phi / DEG - 180), lat };
}

/** Longitude/latitude of a point of the flattened world plane (u west to east, v north to south). */
export function planeUvToLonLat(u: number, v: number): LonLat {
  return { lon: -180 + 360 * clamp01(u), lat: 90 - 180 * clamp01(v) };
}

/** Position on the flattened world plane, centred on longitude 0 / latitude 0. */
export function lonLatToPlanePoint(lon: number, lat: number): { x: number; y: number } {
  return { x: (lon / 360) * PLANE_WIDTH, y: (lat / 180) * PLANE_HEIGHT };
}

/** True when the point lies inside the rectangle (edges included); longitude is normalized first. */
export function isInsideBbox(lon: number, lat: number, bbox: BoundingBox): boolean {
  const longitude = normalizeLongitude(lon);
  return longitude >= bbox.west && longitude <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

/** Horizontal position inside the 3D canvas: 0 at its left edge, 1 at its right edge, limited to 0..1. */
export function screenX01(clientX: number, canvasLeft: number, canvasWidth: number): number {
  if (!(canvasWidth > 0)) return 0.5;
  return clamp01((clientX - canvasLeft) / canvasWidth);
}

/**
 * Texture coordinate of a place inside the Amazon crop of the base image (FR1.3),
 * or null outside the rectangle. Image-texture convention (three.js flips images
 * on load): u = 0 at the west edge, 1 at the east edge; v = 0 at the south edge,
 * 1 at the north edge. EarthMesh's fragment shader repeats this calculation.
 */
export function regionUv(lon: number, lat: number, bbox: BoundingBox): { u: number; v: number } | null {
  if (lon < bbox.west || lon > bbox.east || lat < bbox.south || lat > bbox.north) return null;
  return {
    u: (lon - bbox.west) / (bbox.east - bbox.west),
    v: (lat - bbox.south) / (bbox.north - bbox.south),
  };
}

export function bboxCenter(bbox: BoundingBox): LonLat {
  return { lon: (bbox.west + bbox.east) / 2, lat: (bbox.south + bbox.north) / 2 };
}

/**
 * Euler angles (radians, "XYZ" order) that turn the point at `lon`/`lat` to face
 * a camera on the +Z axis: yaw about Y brings its longitude to the front, then
 * pitch about X brings its latitude to the equator.
 */
export function facingRotation(lon: number, lat: number): { pitch: number; yaw: number } {
  return { pitch: lat * DEG, yaw: -(lon + 90) * DEG };
}

/** The angle equal to `to` (modulo a full turn) that is closest to `from`, so a turn takes the short way. */
export function nearestEquivalentAngle(from: number, to: number): number {
  const turn = 2 * Math.PI;
  const difference = ((((to - from) % turn) + turn + Math.PI) % turn) - Math.PI;
  return from + difference;
}

/** How the planet is turned: the yaw and pitch of the view (radians), as in facingRotation. */
export interface ViewOrientation {
  yaw: number;
  pitch: number;
}

/** The place at the centre of the view for a yaw and pitch: the inverse of facingRotation. */
export function viewCentre(yaw: number, pitch: number): { lon: number; lat: number } {
  const lon = -yaw / DEG - 90;
  return {
    lon: ((((lon + 180) % 360) + 360) % 360) - 180,
    lat: Math.min(90, Math.max(-90, pitch / DEG)),
  };
}
