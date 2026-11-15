// The welcome window and guided tour, drawn with driver.js and restyled in
// index.css (`.jukebox-tour`) to look like the panels of the HUD.
//
// driver.js is bundled with the app, so the tour works offline (NFR1).

import { driver, type AllowedButtons, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { TOUR_STEPS, stepSelector } from "./tourSteps";

/** Background of the page (index.css `body`), so the dimmed screen keeps its colour. */
const OVERLAY_COLOR = "#05070d";
/** The welcome window has nothing to go back to. */
const WELCOME_BUTTONS: AllowedButtons[] = ["next", "close"];

/**
 * Starts the tour from its first window. `onEnd` runs once when it closes,
 * however it closes (Done, the close button, Escape or a click outside).
 */
export function startTour(onEnd?: () => void): Driver {
  const tour = driver({
    popoverClass: "jukebox-tour",
    overlayColor: OVERLAY_COLOR,
    overlayOpacity: 0.6,
    stagePadding: 6,
    stageRadius: 8,
    showProgress: true,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    closeBtnLabel: "Close the tour",
    allowKeyboardControl: true,
    skipMissingElement: true,
    onDestroyed: () => onEnd?.(),
    // Focus "Next" (driver.js focuses the close button), so Enter moves on.
    onPopoverRender: (popover) => {
      requestAnimationFrame(() => popover.nextButton.focus());
    },
    steps: TOUR_STEPS.map((step, index) => ({
      element: stepSelector(step),
      popover: {
        title: step.title,
        description: step.description,
        side: step.side,
        align: step.align,
        ...(index === 0 ? { showButtons: WELCOME_BUTTONS } : {}),
      },
    })),
  });
  tour.drive();
  return tour;
}
