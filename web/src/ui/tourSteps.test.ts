import { describe, expect, it } from "vitest";
import audioStartSource from "../audio/AudioStart.tsx?raw";
import earthSceneSource from "../scene/EarthScene.tsx?raw";
import planetHudSource from "./PlanetHud.tsx?raw";
import {
  TOUR_BUTTON_TEST_ID,
  TOUR_SEEN_KEY,
  TOUR_STEPS,
  hasSeenTour,
  markTourSeen,
  stepSelector,
  type FlagStore,
} from "./tourSteps";

function memoryStore(): FlagStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

const brokenStore: FlagStore = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

/** Source of the files that render the controls the tour points at. */
const CONTROL_SOURCES = [planetHudSource, audioStartSource, earthSceneSource];

describe("guided tour steps", () => {
  it("opens with a centred welcome window", () => {
    expect(TOUR_STEPS[0]?.testId).toBeUndefined();
    expect(stepSelector(TOUR_STEPS[0]!)).toBeUndefined();
    expect(TOUR_STEPS[0]?.title).toMatch(/welcome/i);
  });

  it("points every other step at a control by its data-testid", () => {
    for (const step of TOUR_STEPS.slice(1)) {
      expect(step.testId).toBeTruthy();
      expect(stepSelector(step)).toBe(`[data-testid="${step.testId}"]`);
    }
  });

  it("only points at controls that exist in the interface", () => {
    for (const step of TOUR_STEPS.slice(1)) {
      const literal = `data-testid="${step.testId}"`;
      const viaConstant = step.testId === TOUR_BUTTON_TEST_ID && CONTROL_SOURCES[0]!.includes("data-testid={TOUR_BUTTON_TEST_ID}");
      expect(viaConstant || CONTROL_SOURCES.some((source) => source.includes(literal)), `${step.testId} not found`).toBe(true);
    }
  });

  it("ends on the button that repeats it", () => {
    expect(TOUR_STEPS[TOUR_STEPS.length - 1]?.testId).toBe(TOUR_BUTTON_TEST_ID);
  });

  it("has a short title and description in every window", () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.title.length).toBeLessThanOrEqual(40);
      expect(step.description.length).toBeGreaterThan(0);
      expect(step.description.length).toBeLessThanOrEqual(200);
    }
  });
});

describe("tour seen flag", () => {
  it("is not seen in a fresh browser and is seen after marking it", () => {
    const store = memoryStore();
    expect(hasSeenTour(store)).toBe(false);
    markTourSeen(store);
    expect(store.values.get(TOUR_SEEN_KEY)).toBe("1");
    expect(hasSeenTour(store)).toBe(true);
  });

  it("counts as not seen, without throwing, when storage is missing or blocked", () => {
    expect(hasSeenTour(null)).toBe(false);
    expect(hasSeenTour(brokenStore)).toBe(false);
    expect(() => markTourSeen(null)).not.toThrow();
    expect(() => markTourSeen(brokenStore)).not.toThrow();
  });
});
