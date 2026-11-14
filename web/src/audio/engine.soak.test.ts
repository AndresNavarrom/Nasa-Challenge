import { describe, expect, it } from "vitest";
import { LAYER_IDS } from "../data/types";
import { createSoundEngine } from "./engine";
import { FakeAudioContext } from "./testing/fakeAudioContext";

function setup() {
  const context = new FakeAudioContext();
  const engine = createSoundEngine({ context: context.asAudioContext() });
  return { context, engine };
}

describe("sound engine soak (B3)", () => {
  it("keeps a fixed graph and finite parameters over 10 simulated minutes", async () => {
    const { context, engine } = setup();
    await engine.start();

    const oscillators = context.oscillators.length;
    const gains = context.gains.length;
    const filters = context.filters.length;
    const panners = context.panners.length;

    // 10 minutes at 30 updates per second: the demo frame-rate target.
    const frames = 30 * 60 * 10;
    LAYER_IDS.forEach((layer, index) => {
      const initial = (index + 1) / (LAYER_IDS.length + 1);
      engine.setLayerIntensity(layer, initial);
    });

    for (let frame = 0; frame < frames; frame += 1) {
      context.currentTime += 1 / 30;
      const phase = (frame / frames) * Math.PI * 2;
      LAYER_IDS.forEach((layer, index) => {
        const value = (Math.sin(phase + index * 2.1) + 1) / 2;
        engine.setLayerIntensity(layer, value);
      });
      engine.setPan((Math.sin(phase) + 1) / 2);

      if (frame % 300 === 0) {
        engine.setLayerEnabled("smoke", frame % 600 === 0);
        const level = engine.getOutputLevel();
        expect(Number.isFinite(level)).toBe(true);
      }
    }

    expect(engine.state).toBe("running");
    expect(context.oscillators).toHaveLength(oscillators);
    expect(context.gains).toHaveLength(gains);
    expect(context.filters).toHaveLength(filters);
    expect(context.panners).toHaveLength(panners);

    for (const gain of context.gains) {
      expect(Number.isFinite(gain.gain.value)).toBe(true);
    }
    for (const oscillator of context.oscillators) {
      expect(Number.isFinite(oscillator.frequency.value)).toBe(true);
    }
    for (const panner of context.panners) {
      expect(Number.isFinite(panner.pan.value)).toBe(true);
    }

    engine.dispose();
  });

  it("survives repeated stop/start cycles without duplicating the graph", async () => {
    const { context, engine } = setup();
    await engine.start();
    const oscillators = context.oscillators.length;

    for (let cycle = 0; cycle < 10; cycle += 1) {
      engine.setLayerIntensity("forest", 0.5);
      engine.stop();
      expect(engine.state).toBe("suspended");

      await engine.start();
      expect(engine.state).toBe("running");
      expect(context.oscillators).toHaveLength(oscillators);
    }

    engine.dispose();
    expect(engine.state).toBe("idle");
  });

  it("can be disposed twice and reports silence afterwards", async () => {
    const { context, engine } = setup();
    await engine.start();

    engine.dispose();
    engine.dispose();

    expect(engine.state).toBe("idle");
    expect(engine.getOutputLevel()).toBe(0);
    expect(engine.getLatencyMs()).toBe(0);
    expect(context.close).not.toHaveBeenCalled(); // the injected context is not closed
  });
});
