import { describe, expect, it } from "vitest";
import {
  DEFAULT_DURATION_SECONDS,
  MAX_SPEED,
  MIN_SPEED,
  createPlayback,
  playbackReducer,
} from "./playback";

const at = (position: number, overrides: Parameters<typeof createPlayback>[0] = {}) =>
  createPlayback({ position, durationSeconds: 10, ...overrides });

describe("playback", () => {
  it("steps with the turning planet whether or not the clock plays, starting again after the end", () => {
    const paused = at(0.5);
    expect(playbackReducer(paused, { type: "step", delta: 0.1 }).position).toBeCloseTo(0.6);
    expect(playbackReducer(at(0.95), { type: "step", delta: 0.1 }).position).toBeCloseTo(0.05);
    expect(playbackReducer(paused, { type: "step", delta: 0.1 }).playing).toBe(false);
    // At 4x the same turn moves the timeline four times as far.
    expect(playbackReducer(at(0.1, { speed: 4 }), { type: "step", delta: 0.1 }).position).toBeCloseTo(0.5);
  });

  it("starts paused at the beginning, at 1x, looping over the default duration", () => {
    const state = createPlayback();
    expect(state).toEqual({
      position: 0,
      playing: false,
      speed: 1,
      loop: true,
      durationSeconds: DEFAULT_DURATION_SECONDS,
    });
  });

  it("limits positions and speeds to their allowed ranges", () => {
    expect(createPlayback({ position: 4 }).position).toBe(1);
    expect(createPlayback({ position: -4 }).position).toBe(0);
    expect(createPlayback({ position: Number.NaN }).position).toBe(0);
    expect(createPlayback({ speed: 100 }).speed).toBe(MAX_SPEED);
    expect(createPlayback({ speed: 0 }).speed).toBe(MIN_SPEED);
    expect(createPlayback({ speed: -3 }).speed).toBe(MIN_SPEED);
    expect(createPlayback({ speed: Number.NaN }).speed).toBe(1);
    expect(playbackReducer(at(0), { type: "set-speed", speed: 2.5 }).speed).toBe(2.5);
    expect(playbackReducer(at(0), { type: "set-speed", speed: 99 }).speed).toBe(MAX_SPEED);
  });

  it("does not move while paused or with an invalid delta", () => {
    const paused = at(0.4);
    expect(playbackReducer(paused, { type: "advance", deltaSeconds: 5 })).toBe(paused);
    const playing = playbackReducer(at(0.4, { playing: true }), { type: "advance", deltaSeconds: 0 });
    expect(playing.position).toBeCloseTo(0.4, 6);
    const negative = playbackReducer(at(0.4, { playing: true }), { type: "advance", deltaSeconds: -2 });
    expect(negative.position).toBeCloseTo(0.4, 6);
  });

  it("moves by elapsed time divided by the duration, scaled by speed", () => {
    const state = playbackReducer(at(0, { playing: true }), { type: "advance", deltaSeconds: 2.5 });
    expect(state.position).toBeCloseTo(0.25, 6);

    const fast = playbackReducer(at(0, { playing: true, speed: 2 }), { type: "advance", deltaSeconds: 2.5 });
    expect(fast.position).toBeCloseTo(0.5, 6);

    const slow = playbackReducer(at(0, { playing: true, speed: 0.5 }), { type: "advance", deltaSeconds: 2.5 });
    expect(slow.position).toBeCloseTo(0.125, 6);
  });

  it("loops back to the start by default", () => {
    const state = playbackReducer(at(0.9, { playing: true }), { type: "advance", deltaSeconds: 2 });
    expect(state.position).toBeCloseTo(0.1, 6);
    expect(state.playing).toBe(true);
  });

  it("stops at the end when looping is off, and play restarts from zero", () => {
    const ended = playbackReducer(at(0.9, { playing: true, loop: false }), { type: "advance", deltaSeconds: 2 });
    expect(ended.position).toBe(1);
    expect(ended.playing).toBe(false);

    const restarted = playbackReducer(ended, { type: "play" });
    expect(restarted.playing).toBe(true);
    expect(restarted.position).toBe(0);
  });

  it("toggles, pauses and seeks without leaving the range", () => {
    const playing = playbackReducer(at(0.2), { type: "toggle" });
    expect(playing.playing).toBe(true);
    expect(playbackReducer(playing, { type: "toggle" }).playing).toBe(false);
    expect(playbackReducer(playing, { type: "pause" }).playing).toBe(false);

    expect(playbackReducer(playing, { type: "seek", position: 0.75 }).position).toBe(0.75);
    expect(playbackReducer(playing, { type: "seek", position: 9 }).position).toBe(1);
    expect(playbackReducer(playing, { type: "seek", position: -1 }).position).toBe(0);
  });

  it("changes the loop and the duration, ignoring invalid durations", () => {
    expect(playbackReducer(at(0), { type: "set-loop", loop: false }).loop).toBe(false);
    expect(playbackReducer(at(0), { type: "set-duration", durationSeconds: 60 }).durationSeconds).toBe(60);
    expect(playbackReducer(at(0), { type: "set-duration", durationSeconds: 0 }).durationSeconds).toBe(10);
    expect(playbackReducer(at(0), { type: "set-duration", durationSeconds: Number.NaN }).durationSeconds).toBe(10);
  });
});
