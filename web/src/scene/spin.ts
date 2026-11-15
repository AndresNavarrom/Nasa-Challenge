// The planet's automatic turn. It only advances on the planet view, while no
// transition has stopped it (ViewState.spinning), while nobody is dragging it
// and while the "Auto-rotate" switch is on. Turning the switch off keeps the
// planet where it is; turning it back on carries on from there.

import type { ViewMode } from "./FocusTransition";

/** Turn speed of the spinning planet, radians per second. */
export const SPIN_SPEED = 0.08;

/** Longest frame step counted, so a stalled tab does not jump the planet round. */
const MAX_STEP_S = 0.1;

export interface SpinConditions {
  /** False while a transition to or from the Amazon map holds the planet. */
  spinning: boolean;
  /** The "Auto-rotate" switch. */
  autoRotate: boolean;
  mode: ViewMode;
  dragging: boolean;
}

/** The yaw after one frame of `delta` seconds. */
export function spinStep(yaw: number, delta: number, conditions: SpinConditions): number {
  const { spinning, autoRotate, mode, dragging } = conditions;
  if (!spinning || !autoRotate || mode !== "globe" || dragging) return yaw;
  if (!Number.isFinite(delta) || delta <= 0) return yaw;
  return yaw + SPIN_SPEED * Math.min(delta, MAX_STEP_S);
}
