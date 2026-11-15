// Shared timeline state for the app (FR7): one playback clock that the audio
// (and, in the next slice, the scene and the timeline bar) read.
//
// Decisions recorded here (full rationale in docs/TIMELINE-HANDOFF.md):
// - Shared normalized position, loop forever, 1x default, speed 0.1x-8x.
// - State is published at ~30 Hz while playing, not on every animation frame,
//   so the scene and the audio engine are not re-rendered 60 times a second.
// - The provider owns no UI. Controls (TimelineBar, step 13) call the actions.

import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { createPlayback, playbackReducer, type PlaybackState } from "../lib/playback";

/** How often the provider publishes a new position while playing. */
export const TIMELINE_UPDATE_HZ = 30;

export interface TimelineValue extends PlaybackState {
  play(): void;
  pause(): void;
  toggle(): void;
  seek(position: number): void;
  setSpeed(speed: number): void;
  setLoop(loop: boolean): void;
  setDuration(durationSeconds: number): void;
}

const TimelineContext = createContext<TimelineValue | null>(null);

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(playbackReducer, undefined, () => createPlayback());

  useEffect(() => {
    if (!state.playing) return;
    let frame = 0;
    let last = performance.now();
    let pending = 0;
    const intervalMs = 1000 / TIMELINE_UPDATE_HZ;

    const tick = (now: number): void => {
      // Cap the step so a backgrounded tab does not jump when it comes back.
      const delta = Math.min(0.25, Math.max(0, (now - last) / 1000));
      last = now;
      pending += delta;
      if (pending * 1000 >= intervalMs) {
        dispatch({ type: "advance", deltaSeconds: pending });
        pending = 0;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.playing]);

  const value = useMemo<TimelineValue>(
    () => ({
      ...state,
      play: () => dispatch({ type: "play" }),
      pause: () => dispatch({ type: "pause" }),
      toggle: () => dispatch({ type: "toggle" }),
      seek: (position: number) => dispatch({ type: "seek", position }),
      setSpeed: (speed: number) => dispatch({ type: "set-speed", speed }),
      setLoop: (loop: boolean) => dispatch({ type: "set-loop", loop }),
      setDuration: (durationSeconds: number) => dispatch({ type: "set-duration", durationSeconds }),
    }),
    [state],
  );

  return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}

/** Current timeline state and actions. Throws when used outside the provider. */
export function useTimeline(): TimelineValue {
  const value = useContext(TimelineContext);
  if (!value) {
    throw new Error("useTimeline must be used inside <TimelineProvider>.");
  }
  return value;
}
