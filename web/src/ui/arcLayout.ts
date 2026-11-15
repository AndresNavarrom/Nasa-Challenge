// Geometry of the two arcs that frame the planet. Both are parts of one circle
// centred on the screen, larger than the screen is tall, so only its left and
// right sides show. Controls sit on them by angle: 0 degrees is the middle of
// the side (the leftmost or rightmost point), positive angles go down.
//
// Pure functions, so the layout can be tested without a browser.

export type ArcSide = "left" | "right";

export interface ArcFrame {
  /** Centre of the circle, in CSS pixels from the top-left corner of the view. */
  cx: number;
  cy: number;
  radius: number;
}

/** The circle's radius as a share of the view's height: at least, and at most on a wide view. */
const RADIUS_PER_HEIGHT = 0.64;
const MAX_RADIUS_PER_HEIGHT = 0.78;
/** Free space between each arc and the side of the view, for the controls outside it: at least, and what a wide view keeps. */
const SIDE_SPACE = 170;
const WIDE_SIDE_SPACE = 240;
/** The planet's radius on screen as a share of the view's height (camera of EarthScene), plus a margin. */
const PLANET_RADIUS_PER_HEIGHT = 0.52;
/** Below this size the arcs are not drawn and the controls go to a compact bar. */
const MIN_WIDTH = 900;
const MIN_HEIGHT = 640;

/** The circle of the arcs for a view of this size, or null when the view is too small for them. */
export function arcFrame(width: number, height: number): ArcFrame | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width < MIN_WIDTH || height < MIN_HEIGHT) return null;
  // A wide view opens the arcs up to keep them near the sides, not near the planet.
  const wide = Math.min(height * MAX_RADIUS_PER_HEIGHT, width / 2 - WIDE_SIDE_SPACE);
  const radius = Math.min(Math.max(height * RADIUS_PER_HEIGHT, wide), width / 2 - SIDE_SPACE);
  // The arcs must clear the planet they frame.
  if (radius < height * PLANET_RADIUS_PER_HEIGHT) return null;
  return { cx: width / 2, cy: height / 2, radius };
}

const DEG = Math.PI / 180;

/** The largest angle (degrees either side of the middle) at which a point of the arcs is still `margin` pixels inside the view. */
export function arcVisibleDegrees(frame: ArcFrame, margin = 0): number {
  const reach = (frame.cy - margin) / frame.radius;
  return reach >= 1 ? 90 : Math.asin(Math.max(0, reach)) / DEG;
}

/** The point of an arc at an angle (degrees from the middle of its side, positive down), `offset` pixels outside the circle. */
export function arcPoint(frame: ArcFrame, side: ArcSide, degrees: number, offset = 0): { x: number; y: number } {
  const reach = (frame.radius + offset) * Math.cos(degrees * DEG);
  return {
    x: side === "left" ? frame.cx - reach : frame.cx + reach,
    y: frame.cy + (frame.radius + offset) * Math.sin(degrees * DEG),
  };
}

/** The angle (as in arcPoint) of the direction from the circle's centre to a point of the view. */
export function arcAngleAt(frame: ArcFrame, side: ArcSide, x: number, y: number): number {
  const across = side === "left" ? frame.cx - x : x - frame.cx;
  return Math.atan2(y - frame.cy, Math.max(1e-6, across)) / DEG;
}

/** `count` angles `step` degrees apart, centred on `centre`. */
export function spreadAngles(count: number, step: number, centre = 0): number[] {
  return Array.from({ length: count }, (_, index) => centre + (index - (count - 1) / 2) * step);
}

/** SVG path of an arc between two angles, `offset` pixels outside the circle. */
export function arcPath(frame: ArcFrame, side: ArcSide, fromDegrees: number, toDegrees: number, offset = 0): string {
  const from = arcPoint(frame, side, fromDegrees, offset);
  const to = arcPoint(frame, side, toDegrees, offset);
  const radius = frame.radius + offset;
  // Going down the left side turns anticlockwise on screen; the right side, clockwise.
  const down = toDegrees >= fromDegrees;
  const sweep = (side === "right") === down ? 1 : 0;
  const round = (value: number): string => value.toFixed(2);
  return `M ${round(from.x)} ${round(from.y)} A ${round(radius)} ${round(radius)} 0 0 ${sweep} ${round(to.x)} ${round(to.y)}`;
}

/** Where a fraction (0..1) of a line laid along an arc falls, as an angle. 0 is at `startDegrees`. */
export function arcAngleOfFraction(startDegrees: number, endDegrees: number, fraction: number): number {
  return startDegrees + (endDegrees - startDegrees) * Math.min(1, Math.max(0, fraction));
}

/** The fraction (0..1, limited) of a line laid along an arc at an angle. */
export function arcFractionOfAngle(startDegrees: number, endDegrees: number, degrees: number): number {
  if (endDegrees === startDegrees) return 0;
  return Math.min(1, Math.max(0, (degrees - startDegrees) / (endDegrees - startDegrees)));
}
