import { afterEach, describe, expect, it, vi } from "vitest";
import { createSoundEngine } from "./engine";
import { OVERVIEW_INSTRUMENTS, pitchForValue } from "./overview";
import { positionToPan } from "./mapping";
import { FakeAudioContext, type FakeParam } from "./testing/fakeAudioContext";

function scheduled(parameter: FakeParam): number {
  parameter.scheduledTarget ??= parameter.value;
  return parameter.scheduledTarget;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("regional point instrument", () => {
  it("uses the overview instrument, value -> pitch and screen x -> pan", async () => {
    const context = new FakeAudioContext();
    const engine = createSoundEngine({ context: context.asAudioContext(), lightningSampleUrl: null });
    await engine.start();
    expect(context.oscillators).toHaveLength(6);

    engine.setRegionalPoint("co2", 0.5, 0.2);
    expect(context.oscillators).toHaveLength(7);
    const oscillator = context.oscillators[6]!;
    const instrument = OVERVIEW_INSTRUMENTS.co2;
    const expectedPitch =
      pitchForValue(0.5, instrument.scale, 0, 1) *
      2 ** (instrument.detuneCents / 1200) *
      2 ** instrument.octave;
    expect(oscillator.type).toBe("sawtooth");
    expect(scheduled(oscillator.frequency)).toBeCloseTo(expectedPitch, 5);
    expect(scheduled(context.panners[4]!.pan)).toBeCloseTo(positionToPan(0.2), 6);
    expect(context.gains.at(-1)!.gain.scheduledTarget ?? 0).toBeGreaterThan(0);

    engine.setRegionalPoint(null, null, 0);
    expect(scheduled(context.gains.at(-1)!.gain)).toBe(0);
    engine.dispose();
  });

  it("normalises the visible value range across one octave of the layer scale", async () => {
    const context = new FakeAudioContext();
    const engine = createSoundEngine({ context: context.asAudioContext(), lightningSampleUrl: null });
    await engine.start();

    engine.setRegionalPoint("forest", 0.4, 0.5, { min: 0.4, max: 0.6 });
    const oscillator = context.oscillators[6]!;
    expect(scheduled(oscillator.frequency)).toBeCloseTo(
      pitchForValue(0, OVERVIEW_INSTRUMENTS.forest.scale, 0, 1),
      5,
    );

    engine.setRegionalPoint("forest", 0.6, 0.5, { min: 0.4, max: 0.6 });
    expect(scheduled(oscillator.frequency)).toBeCloseTo(
      pitchForValue(1, OVERVIEW_INSTRUMENTS.forest.scale, 0, 1),
      5,
    );

    engine.setRegionalPoint("forest", 0.5, 0.5, { min: 0.4, max: 0.6 });
    expect(scheduled(oscillator.frequency)).toBeCloseTo(
      pitchForValue(0.5, OVERVIEW_INSTRUMENTS.forest.scale, 0, 1),
      5,
    );
    engine.dispose();
  });

  it("retriggers lightning at 90..120 bpm from the layer value", async () => {
    vi.useFakeTimers();
    const context = new FakeAudioContext();
    const engine = createSoundEngine({ context: context.asAudioContext(), lightningSampleUrl: null });
    await engine.start();
    expect(context.oscillators).toHaveLength(6);

    engine.setRegionalPoint("lightning", 0, 0.5);
    expect(context.oscillators).toHaveLength(6);

    engine.setRegionalPoint("lightning", 1, 0.5);
    expect(context.oscillators).toHaveLength(7);
    vi.advanceTimersByTime(499);
    expect(context.oscillators).toHaveLength(7);
    vi.advanceTimersByTime(1);
    expect(context.oscillators).toHaveLength(8);

    engine.setRegionalPoint("lightning", 0, 0.5);
    vi.advanceTimersByTime(2000);
    expect(context.oscillators).toHaveLength(8);
    engine.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("applies the regional note that arrived before start", async () => {
    const context = new FakeAudioContext();
    const engine = createSoundEngine({ context: context.asAudioContext(), lightningSampleUrl: null });
    engine.setRegionalPoint("forest", 0.8, 0.8);
    await engine.start();
    expect(context.oscillators).toHaveLength(7);
    expect(context.oscillators[6]!.type).toBe("triangle");
    engine.dispose();
  });
});
