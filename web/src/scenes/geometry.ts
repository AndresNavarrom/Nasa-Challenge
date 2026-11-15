// Where a scene point sits on the flattened world map.

import type { BoundingBox } from "../data/types";
import { bboxCenter, lonLatToPlanePoint } from "../scene/geo";

export interface SceneMapPosition {
  /** Local x inside the plane mesh (the plane is centred on the Amazon). */
  x: number;
  /** Local y inside the plane mesh. */
  y: number;
}

/** Map-plane coordinates of a scene, relative to the plane's centre. */
export function sceneMapPosition(
  scene: { lon: number; lat: number },
  bbox: BoundingBox,
): SceneMapPosition {
  const center = bboxCenter(bbox);
  const shift = lonLatToPlanePoint(center.lon, center.lat);
  const point = lonLatToPlanePoint(scene.lon, scene.lat);
  return { x: point.x - shift.x, y: point.y - shift.y };
}
