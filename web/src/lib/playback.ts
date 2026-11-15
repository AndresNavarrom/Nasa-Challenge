// Timeline playback state (the "play the sequence like a song" feature, FR7).
//
// Decisions recorded here (see docs/TIMELINE-HANDOFF.md):
// - One shared, normalized position (0..1). Each layer walks its own period from
//   that position; the layers do not share a real calendar, so the timeline is a
//   narrative sequence, not a unified date.
// - The sequence loops forever by default.
// - Speed is a multiplier over the sequence duration: 0.1x to 8x.
// - At 1x the whole sequence lasts DEFAULT_DURATION_SECONDS.
//
// This module is pure so it can be tested without React or Web Audio.

import { advancePosition, clampPosition } from "./timeline";
import { stepPosition } from "./timelineTrack";

/** Slowest playback speed. */
export const MIN_SPEED = 0.1;
/** Fastest playback speed. */
export const MAX_SPEED = 8;
/** Length of the whole sequence at 1x, in seconds. */
export const DEFAULT_DURATION_SECONDS = 24;

export interface PlaybackState {
  /** Shared timeline position, 0..1. */
  position: number;
  playing: boolean;
  /** Playback multiplier, clamped to MIN_SPEED..MAX_SPEED. */
  speed: number;
  /** Loop forever (decision) or stop at the end. */
  loop: boolean;
  /** Seconds the whole sequence lasts at 1x. */
  durationSeconds: number;
}

export type PlaybackAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle" }
  | { type: "seek"; position: number }
  /** Moves the position by `delta` (the planet turned), starting again after the end. */
  | { type: "step"; delta: number }
  | { type: "set-speed"; speed: number }
  | { type: "set-loop"; loop: boolean }
  | { type: "set-duration"; durationSeconds: number }
  | { type: "advance"; deltaSeconds: number };

function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return 1;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed));
}

function validDuration(seconds: number, fallback: number): number {
  return Number.isFinite(seconds) && seconds > 0 ? seconds : fallback;
}

export function createPlayback(overrides: Partial<PlaybackState> = {}): PlaybackState {
  return {
    position: clampPosition(overrides.position ?? 0),
    playing: overrides.playing ?? false,
    speed: clampSpeed(overrides.speed ?? 1),
    loop: overrides.loop ?? true,
    durationSeconds: validDuration(overrides.durationSeconds ?? DEFAULT_DURATION_SECONDS, DEFAULT_DURATION_SECONDS),
  };
}

/** Restarts at the beginning when play is pressed at the end of a non-looping run. */
function startPlaying(state: PlaybackState): PlaybackState {
  const atEnd = !state.loop && state.position >= 1;
  return { ...state, playing: true, position: atEnd ? 0 : state.position };
}

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case "play":
      return state.playing ? state : startPlaying(state);
    case "pause":
      return state.playing ? { ...state, playing: false } : state;
    case "toggle":
      return state.playing ? { ...state, playing: false } : startPlaying(state);
    case "seek":
      return { ...state, position: clampPosition(action.position) };
    case "step":
      return { ...state, position: stepPosition(state.position, action.delta) };
    case "set-speed":
      return { ...state, speed: clampSpeed(action.speed) };
    case "set-loop":
      return { ...state, loop: action.loop };
    case "set-duration":
      return {
        ...state,
        durationSeconds: validDuration(action.durationSeconds, state.durationSeconds),
      };
    case "advance": {
      if (!state.playing || !(action.deltaSeconds > 0) || !Number.isFinite(action.deltaSeconds)) {
        return state;
      }
      const next = advancePosition(state.position, action.deltaSeconds * state.speed, state.durationSeconds, state.loop);
      // advancePosition returns 1 only when a non-looping run hits the end.
      const finished = !state.loop && next >= 1;
      return { ...state, position: next, playing: finished ? false : state.playing };
    }
  }
}
