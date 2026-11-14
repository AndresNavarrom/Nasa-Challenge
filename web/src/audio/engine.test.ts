import { describe, expect, it } from "vitest";
import { createSoundEngine, SMOKE_LAYER_TRIM } from "./engine";
import { co2ToBreath, forestToVoice, intensityToGain, positionToPan, smokeToTimbre } from "./mapping";
import { FakeAnalyser, FakeAudioContext, FakeGain, FakePanner } from "./testing/fakeAudioContext";

function setup() {
  const context = new FakeAudioContext();
  const engine = createSoundEngine({
    context: context.asAudioContext(),
    rampSeconds: 0.05,
    smoothingSeconds: 0.15,
  });
  return { context, engine };
}

/** Voice gains in creation order: forest, smoke, CO2 (each connects to its panner). */
function layerVoiceGains(context: FakeAudioContext): FakeGain[] {
  return context.gains.filter((candidate) => candidate.connections.some((target) => target instanceof FakePanner));
}

function layerVoiceGain(context: FakeAudioContext, index: number): FakeGain {
  const node = layerVoiceGains(context)[index];
  if (!node) throw new Error(`the voice gain ${index} was not created`);
  return node;
}

function masterGain(context: FakeAudioContext): FakeGain {
  const node = context.gains.find((candidate) => candidate.connections.some((target) => target instanceof FakeAnalyser));
  if (!node) throw new Error("the master gain was not created");
  return node;
}

describe("sound engine", () => {
  it("builds all three voices once and reuses the graph when start is called again", async () => {
    const { context, engine } = setup();
    await engine.start();
    expect(context.oscillators).toHaveLength(6);
    expect(context.bufferSources).toHaveLength(1);
    expect(context.panners).toHaveLength(3);
    expect(context.resume).toHaveBeenCalledTimes(1);

    await engine.start();
    expect(context.oscillators).toHaveLength(6);
    expect(context.resume).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it("turns a forest value into a pentatonic note", async () => {
    const { context, engine } = setup();
    engine.setLayerIntensity("forest", 1);
    await engine.start();

    const voice = forestToVoice(1);
    expect(context.oscillators[0]?.frequency.value).toBeCloseTo(voice.frequency, 6);
    expect(context.oscillators[1]?.frequency.value).toBeCloseTo(voice.harmonyFrequency, 6);
    engine.dispose();
  });

  it("makes smoke rougher and darker as its value rises", async () => {
    const { context, engine } = setup();
    engine.setLayerIntensity("smoke", 0.9);
    await engine.start();

    const timbre = smokeToTimbre(0.9);
    expect(context.filters[1]?.frequency.value).toBeCloseTo(timbre.filterCutoffHz, 6);
    expect(context.oscillators[3]?.frequency.value).toBeCloseTo(timbre.roughnessRateHz, 6);
    expect(context.gains[4]?.gain.value).toBeCloseTo(timbre.noiseMix, 6);
    expect(layerVoiceGain(context, 1).gain.value).toBeGreaterThan(0);
    engine.dispose();
  });

  it("makes breathing faster and lower as CO2 rises", async () => {
    const { context, engine } = setup();
    engine.setLayerIntensity("co2", 0.9);
    await engine.start();

    const breath = co2ToBreath(0.9);
    expect(context.oscillators[4]?.frequency.value).toBeCloseTo(breath.toneHz, 6);
    expect(context.oscillators[5]?.frequency.value).toBeCloseTo(breath.rateHz, 6);
    expect(context.filters[2]?.frequency.value).toBeCloseTo(Math.min(4000, breath.toneHz * 3), 6);
    expect(layerVoiceGain(context, 2).gain.value).toBeGreaterThan(0);
    engine.dispose();
  });

  it("silences a layer where it has no data and brings it back when data returns", async () => {
    const { context, engine } = setup();
    await engine.start();

    for (const index of [0, 1, 2]) {
      const gain = layerVoiceGain(context, index);
      context.currentTime = 0.02;
      engine.setLayerIntensity(index === 0 ? "forest" : index === 1 ? "smoke" : "co2", 0.7);
      expect(gain.gain.value).toBeGreaterThan(0);

      context.currentTime += 0.02;
      engine.setLayerIntensity(index === 0 ? "forest" : index === 1 ? "smoke" : "co2", null);
      expect(gain.gain.value).toBe(0);
    }
    engine.dispose();
  });

  it("schedules ramps instead of setting parameters instantly", async () => {
    const { context, engine } = setup();
    await engine.start();
    const gain = layerVoiceGain(context, 0);

    context.currentTime = 0.05;
    engine.setLayerIntensity("forest", 0.5);
    expect(gain.gain.events.at(-1)?.method).toBe("setTargetAtTime");
    expect(context.oscillators[0]?.frequency.events.at(-1)?.method).toBe("setTargetAtTime");
    engine.dispose();
  });

  it("mutes one layer without touching the others", async () => {
    const { context, engine } = setup();
    engine.setLayerIntensity("smoke", 0.8);
    engine.setLayerIntensity("co2", 0.8);
    await engine.start();
    const smoke = layerVoiceGain(context, 1);
    const co2 = layerVoiceGain(context, 2);

    expect(smoke.gain.value).toBeGreaterThan(0);
    engine.setLayerEnabled("smoke", false);
    expect(smoke.gain.value).toBe(0);
    expect(co2.gain.value).toBeGreaterThan(0);
    engine.dispose();
  });

  it("gives the smoke layer extra level so the forest does not mask it", async () => {
    const { context, engine } = setup();
    engine.setLayerIntensity("forest", 0.7);
    engine.setLayerIntensity("smoke", 0.7);
    await engine.start();

    const [forest, smoke] = layerVoiceGains(context);
    if (!forest || !smoke) throw new Error("the forest and smoke gains were not created");
    expect(forest.gain.value).toBeCloseTo(intensityToGain(0.7), 6);
    expect(smoke.gain.value).toBeCloseTo(intensityToGain(0.7) * SMOKE_LAYER_TRIM, 6);
    expect(smoke.gain.value).toBeGreaterThan(forest.gain.value);
    engine.dispose();
  });

  it("keeps all three layers audible together and pans them as one", async () => {
    const { context, engine } = setup();
    engine.setLayerIntensity("forest", 0.7);
    engine.setLayerIntensity("smoke", 0.7);
    engine.setLayerIntensity("co2", 0.7);
    engine.setPan(0.2);
    await engine.start();

    const [forest, smoke, co2] = layerVoiceGains(context);
    if (!forest || !smoke || !co2) throw new Error("the three voice gains were not created");
    for (const gain of [forest, smoke, co2]) {
      expect(gain.gain.value).toBeGreaterThan(0);
    }
    expect(smoke.gain.value).toBeGreaterThan(forest.gain.value);
    for (const panner of context.panners) {
      expect(panner.pan.value).toBeCloseTo(positionToPan(0.2), 6);
    }
    engine.dispose();
  });

  it("clamps odd input instead of producing invalid parameters", async () => {
    const { context, engine } = setup();
    await engine.start();
    const gains = layerVoiceGains(context);

    engine.setLayerIntensity("forest", Number.NaN);
    engine.setLayerIntensity("smoke", -3);
    engine.setLayerIntensity("co2", 9);
    engine.setPan(Number.NaN);

    for (const gain of gains) {
      expect(Number.isFinite(gain.gain.value)).toBe(true);
    }
    for (const osc of context.oscillators) {
      expect(Number.isFinite(osc.frequency.value)).toBe(true);
    }
    for (const panner of context.panners) {
      expect(Number.isFinite(panner.pan.value)).toBe(true);
    }
    engine.dispose();
  });

  it("reports the context latency for the B3 measurement", async () => {
    const { context, engine } = setup();
    context.baseLatency = 0.01;
    context.outputLatency = 0.02;
    await engine.start();
    expect(engine.getLatencyMs()).toBeCloseTo(30, 6);
    engine.dispose();
  });

  it("fades out on stop and releases every node on dispose", async () => {
    const { context, engine } = setup();
    await engine.start();
    const master = masterGain(context);

    engine.stop();
    expect(master.gain.events.at(-1)?.target).toBe(0);
    expect(engine.state).toBe("suspended");

    engine.dispose();
    for (const oscillator of context.oscillators) {
      expect(oscillator.stop).toHaveBeenCalled();
      expect(oscillator.disconnect).toHaveBeenCalled();
    }
    expect(context.bufferSources[0]?.stop).toHaveBeenCalled();
    expect(context.bufferSources[0]?.disconnect).toHaveBeenCalled();
    expect(engine.state).toBe("idle");
  });

  it("reads the output meter from the analyser", async () => {
    const { engine } = setup();
    await engine.start();
    expect(engine.getOutputLevel()).toBeCloseTo(0.25, 6);
    engine.dispose();
  });
});
