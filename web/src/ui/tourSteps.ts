// Content of the welcome window and the guided tour (driver.js), kept free of
// the library so it can be tested in Node. tour.ts turns it into a driver.
//
// Each step points at a control by its data-testid, so the tour follows the
// controls if they move and simply skips one that is not on screen.

/** One window of the tour. Without `testId` it is centred on the screen. */
export interface TourStep {
  testId?: string;
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** UI change to apply when the person presses Next on this step. */
  onNext?: TourAction;
}

/** A UI change the tour asks the app to make while it is open. */
export type TourAction = "show-timeline" | "restore-layer";

/** Where the tour remembers that this browser has already seen it. */
export const TOUR_SEEN_KEY = "earth-jukebox:tour-seen";

/** data-testid of the "?" button that shows the tour again. */
export const TOUR_BUTTON_TEST_ID = "planet-hud-tour-button";

export const TOUR_STEPS: readonly TourStep[] = [
  {
    title: "Welcome to Earth Jukebox",
    description:
      "Listen to NASA Earth data about the Amazon, the lungs of the world. Every layer has its own voice: move over the planet and hear how it changes from place to place.",
  },
  {
    testId: "audio-controls",
    title: "Start the sound",
    description:
      "Browsers keep sound off until you ask. Press Start sound; the bar under it shows how loud the output is, and the bars along the right arc show its spectrum.",
    side: "right",
    align: "end",
  },
  {
    testId: "planet-hud-layer-select",
    title: "Choose what you hear",
    description:
      "Each round button is a layer: it is drawn on the planet, it is the only one you hear and the arcs take its colour. Earth (no layer) is silent.",
    side: "right",
    align: "center",
  },
  {
    testId: "planet-hud-layer-info",
    title: "What the sound means",
    description:
      "This panel names the picked layer, says what a change in its sound means and reads the place under the cursor. The compass above it shows the centre of the view.",
    side: "left",
    align: "start",
  },
  {
    testId: "planet-canvas",
    title: "Explore the planet",
    description:
      "The overview sounds the visible planet: low notes at the poles, high at the equator. Click and drag to turn it; a single click alone selects no point here; double-click a region to fly there.",
  },
  {
    testId: "planet-hud-auto-rotate",
    title: "Keep the planet turning",
    description:
      "Auto-rotate turns the planet by itself. Turn it off to stop the planet while the timeline and the visible-area sound keep going.",
    side: "right",
    align: "end",
    onNext: "show-timeline",
  },
  {
    testId: "timeline-track",
    title: "The timeline",
    description:
      "The marks along the right arc are the instants of the picked layer. It runs on its own clock; use Play/Pause, drag along the arc or the arrow keys. The arrow button folds it away.",
    side: "left",
    align: "start",
  },
  {
    testId: "timeline-speed",
    title: "Timeline speed",
    description:
      "Use the speed slider (4×–32×) to cover more data time per turn. The line under it says how much one turn spans.",
    side: "left",
    align: "center",
  },
  {
    testId: "planet-hud-amazon-button",
    title: "Fly to a region",
    description:
      "The world is divided into regions, with the Amazon on its own. Double-click (or tap twice) one, or press Amazon, to open its map.",
    side: "right",
    align: "end",
  },
  {
    title: "On a regional map",
    description:
      "Click a point to lock its sound: two guide lines mark it. Click and drag to move it and change its pitch, and double-click the map to return to the globe.",
  },
  {
    testId: "planet-hud-amazon-button",
    title: "Back to the planet",
    description:
      "On a regional map this same button becomes Back to Earth and returns to the globe. Double-clicking the map does the same.",
    side: "right",
    align: "end",
  },
  {
    testId: TOUR_BUTTON_TEST_ID,
    title: "See this again",
    description: "Press ? at any time to repeat this tour.",
    side: "bottom",
    align: "start",
  },
];

/** The CSS selector of a step's control, or undefined for a centred window. */
export function stepSelector(step: TourStep): string | undefined {
  return step.testId ? `[data-testid="${step.testId}"]` : undefined;
}

/** Minimal storage, so tests can pass a fake and private windows can pass null. */
export interface FlagStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** True when this browser already saw the tour. Unreadable storage counts as not seen. */
export function hasSeenTour(store: FlagStore | null): boolean {
  if (!store) return false;
  try {
    return store.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Remembers that the tour was seen; does nothing when storage is unavailable. */
export function markTourSeen(store: FlagStore | null): void {
  if (!store) return;
  try {
    store.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // Private window or blocked storage: the tour will simply show again next time.
  }
}

/** window.localStorage, or null where reading it throws (blocked site data). */
export function browserFlagStore(): FlagStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
