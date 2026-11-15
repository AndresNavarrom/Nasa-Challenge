// The welcome window and guided tour, drawn with driver.js and restyled in
// index.css (`.jukebox-tour`) to look like the panels of the HUD.
//
// driver.js is bundled with the app, so the tour works offline (NFR1).

import { driver, type AllowedButtons, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { TOUR_STEPS, stepSelector, type TourAction } from "./tourSteps";

/** Background of the page (index.css `body`), so the dimmed screen keeps its colour. */
const OVERLAY_COLOR = "#05070d";
/** The welcome window has nothing to go back to. */
const WELCOME_BUTTONS: AllowedButtons[] = ["next", "close"];
/** The control the timeline step needs before driver.js can resolve it. */
const TIMELINE_SELECTOR = '[data-testid="timeline-track"]';
const TIMELINE_WAIT_MS = 10000;
const MOVE_COOLDOWN_MS = 250;

/** Resolves once the timeline is mounted, or after a bounded wait. */
function waitForTimeline(): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now();
    const check = (): void => {
      if (document.querySelector(TIMELINE_SELECTOR) || performance.now() - started >= TIMELINE_WAIT_MS) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

/**
 * Starts the tour from its first window. `onEnd` runs once when it closes,
 * however it closes (Done, the close button, Escape or a click outside).
 */
export function startTour(
  onEnd?: () => void,
  onAction?: (action: TourAction) => void,
): Driver {
  let pendingMove = false;
  let moveLockedUntil = 0;
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
    onDestroyed: () => {
      onAction?.("restore-layer");
      onEnd?.();
    },
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
        ...(step.onNext
          ? {
              onNextClick: (_element, _activeStep, opts) => {
                // Ignore the second half of a double click or a repeated Enter.
                if (pendingMove || performance.now() < moveLockedUntil) return;
                pendingMove = true;
                onAction?.(step.onNext!);
                void waitForTimeline().then(() => {
                  pendingMove = false;
                  moveLockedUntil = performance.now() + MOVE_COOLDOWN_MS;
                  if (opts.driver.isActive()) opts.driver.moveNext();
                });
              },
            }
          : {}),
      },
    })),
  });
  tour.drive();
  return tour;
}
