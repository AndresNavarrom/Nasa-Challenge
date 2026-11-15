// Transition between the spinning planet and the Amazon map (FR2.1, FR2.2).
//
// The scene keeps one mutable ViewState and draws it every frame; these
// functions animate it with GSAP. The way there turns the planet until the
// Amazon faces the camera, flattens it and moves the camera close to the
// region in FOCUS_DURATION_S; the way back does the reverse in
// RETURN_DURATION_S and lets the planet spin again. Both are under the 2 s the
// requirements allow. In lite mode (plan B) the view changes at once.

import { gsap } from "gsap";
import type { BoundingBox } from "../data/types";
import { GLOBE_RADIUS, PLANE_HEIGHT, PLANE_WIDTH, bboxCenter, facingRotation, nearestEquivalentAngle } from "./geo";

/** Animated values of the view. Angles in radians; `flatten` 0 = sphere, 1 = flat map. */
export interface ViewState {
  yaw: number;
  pitch: number;
  flatten: number;
  cameraZ: number;
  /** Whether the planet turns by itself while nobody drags it. */
  spinning: boolean;
}

/** Where the scene is: on the planet, on the map, or moving between them. */
export type ViewMode = "globe" | "to-map" | "map" | "to-globe";

export const GLOBE_CAMERA_Z = 3.2 * GLOBE_RADIUS;
export const FOCUS_DURATION_S = 1.6;
export const RETURN_DURATION_S = 1.4;
/** Free space around the Amazon rectangle when the map fills the screen. */
const MAP_MARGIN = 1.08;

export function createViewState(): ViewState {
  // Start with the Americas towards the camera.
  return { yaw: facingRotation(-60, 0).yaw, pitch: 0, flatten: 0, cameraZ: GLOBE_CAMERA_Z, spinning: true };
}

/** Camera distance (along +Z) that fits the Amazon rectangle of the flattened map on screen. */
export function mapCameraZ(bbox: BoundingBox, fovDegrees: number, aspect: number): number {
  const width = ((bbox.east - bbox.west) / 360) * PLANE_WIDTH;
  const height = ((bbox.north - bbox.south) / 180) * PLANE_HEIGHT;
  const tanHalf = Math.tan((fovDegrees * Math.PI) / 360);
  const safeAspect = aspect > 0 ? aspect : 1;
  const distance = Math.max(height / 2 / tanHalf, width / 2 / (tanHalf * safeAspect)) * MAP_MARGIN;
  // The flattened map lies at z = GLOBE_RADIUS (see EarthMesh).
  return GLOBE_RADIUS + distance;
}

export interface TransitionOptions {
  /** Plan B: jump to the end at once, without animation. */
  instant: boolean;
  onComplete: () => void;
}

/** Stops a running transition. */
export type CancelTransition = () => void;

/** Planet -> Amazon map. */
export function playFocus(
  view: ViewState,
  target: { bbox: BoundingBox; cameraZ: number },
  options: TransitionOptions,
): CancelTransition {
  const center = bboxCenter(target.bbox);
  const facing = facingRotation(center.lon, center.lat);
  const end = { yaw: nearestEquivalentAngle(view.yaw, facing.yaw), pitch: facing.pitch, flatten: 1, cameraZ: target.cameraZ };
  view.spinning = false;
  if (options.instant) {
    Object.assign(view, end);
    options.onComplete();
    return () => {};
  }
  const timeline = gsap.timeline({ onComplete: options.onComplete });
  timeline.to(view, { yaw: end.yaw, pitch: end.pitch, duration: 0.7, ease: "power2.inOut" }, 0);
  timeline.to(view, { flatten: 1, duration: 0.9, ease: "power2.inOut" }, 0.6);
  timeline.to(view, { cameraZ: end.cameraZ, duration: 1.0, ease: "power2.inOut" }, 0.6);
  return () => {
    timeline.kill();
  };
}

/** Amazon map -> spinning planet. */
export function playReturn(view: ViewState, options: TransitionOptions): CancelTransition {
  const finish = () => {
    view.spinning = true;
    options.onComplete();
  };
  if (options.instant) {
    Object.assign(view, { pitch: 0, flatten: 0, cameraZ: GLOBE_CAMERA_Z });
    finish();
    return () => {};
  }
  const timeline = gsap.timeline({ onComplete: finish });
  timeline.to(view, { flatten: 0, duration: 0.9, ease: "power2.inOut" }, 0);
  timeline.to(view, { cameraZ: GLOBE_CAMERA_Z, duration: 1.0, ease: "power2.inOut" }, 0);
  timeline.to(view, { pitch: 0, duration: 0.5, ease: "power2.out" }, 0.9);
  return () => {
    timeline.kill();
  };
}
