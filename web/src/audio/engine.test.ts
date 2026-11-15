import { afterEach, describe, expect, it, vi } from "vitest";
import { createSoundEngine, LIGHTNING_SAMPLE_TAIL_SECONDS, SMOKE_LAYER_TRIM } from "./engine";
import { co2ToBreath, forestToVoice, intensityToGain, positionToPan, smokeToTimbre } from "./mapping";
import { FakeAnalyser, FakeAudioContext, FakeGain, FakePanner, type FakeParam } from "./testing/fakeAudioContext";

afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  const context = new FakeAudioContext();
  const engine = createSoundEngine({
    context: context.asAudioContext(),
    rampSeconds: 0.05,
    smoothingSeconds: 0.15,
    lightningSampleUrl: null,
  });
  return { context, engine };
}

/** Last value the engine scheduled on a parameter (ramps do not apply instantly in the fake). */
function scheduled(parameter: FakeParam): number {
  if (parameter.scheduledTarget === null) throw new Error("no value was scheduled on this parameter");
  return parameter.scheduledTarget;
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
  it("builds every voice once and reuses the graph when start is called again", async () => {
    const { context, engine } = setup();
    await engine.start();
    expect(context.oscillators).toHaveLength(6);
    expect(context.bufferSources).toHaveLength(1);
    expect(context.panners).toHaveLength(4);
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
    expect(scheduled(context.oscillators[0]!.frequency)).toBeCloseTo(voice.frequency, 6);
    expect(scheduled(context.oscillators[1]!.frequency)).toBeCloseTo(voice.harmonyFrequency, 6);
    engine.dispose();
  });

  it("makes smoke rougher and darker as its value rises", async () => {
    const { context, engine } = setup();
    engine.setLayerIntensity("smoke", 0.9);
    await engine.start();

    const timbre = smokeToTimbre(0.9);
    expect(scheduled(context.filters[1]!.frequency)).toBeCloseTo(timbre.filterCutoffHz, 6);
    expect(scheduled(context.oscillators[3]!.frequency)).toBeCloseTo(timbre.roughnessRateHz, 6);
    expect(scheduled(context.gains[4]!.gain)).toBeCloseTo(timbre.noiseMix, 6);
    expect(scheduled(layerVoiceGain(context, 1).gain)).toBeGreaterThan(0);
    engine.dispose();
  });

  it("makes breathing faster and lower as CO2 rises", async () => {
    const { context, engine } = setup();
    engine.setLayerIntensity("co2", 0.9);
    await engine.start();

    const breath = co2ToBreath(0.9);
    expect(scheduled(context.oscillators[4]!.frequency)).toBeCloseTo(breath.toneHz, 6);
    expect(scheduled(context.oscillators[5]!.frequency)).toBeCloseTo(breath.rateHz, 6);
    expect(scheduled(context.filters[2]!.frequency)).toBeCloseTo(Math.min(4000, breath.toneHz * 3), 6);
    expect(scheduled(layerVoiceGain(context, 2).gain)).toBeGreaterThan(0);
    engine.dispose();
  });

  it("silences a layer where it has no data and brings it back when data returns", async () => {
    const { context, engine } = setup();
    await engine.start();

    for (const index of [0, 1, 2]) {
      const gain = layerVoiceGain(context, index);
      context.currentTime = 0.02;
      engine.setLayerIntensity(index === 0 ? "forest" : index === 1 ? "smoke" : "co2", 0.7);
      expect(scheduled(gain.gain)).toBeGreaterThan(0);

      context.currentTime += 0.02;
      engine.setLayerIntensity(index === 0 ? "forest" : index === 1 ? "smoke" : "co2", null);
      expect(scheduled(gain.gain)).toBe(0);
    }
    engine.dispose();
  });

  it("treats NaN and infinities as no data, not as the minimum level", async () => {
    const { context, engine } = setup();
    await engine.start();
    const forest = layerVoiceGain(context, 0).gain;
    const smoke = layerVoiceGain(context, 1).gain;
    const co2 = layerVoiceGain(context, 2).gain;

    context.currentTime = 0.02;
    engine.setLayerIntensity("forest", Number.NaN);
    engine.setLayerIntensity("smoke", Number.POSITIVE_INFINITY);
    engine.setLayerIntensity("co2", Number.NEGATIVE_INFINITY);

    expect(scheduled(forest)).toBe(0);
    expect(scheduled(smoke)).toBe(0);
    expect(scheduled(co2)).toBe(0);
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

  it("settles to the target after the pointer stops moving", async () => {
    vi.useFakeTimers();
    const { context, engine } = setup();
    await engine.start();
    const gain = layerVoiceGain(context, 0);

    context.currentTime = 0.02;
    engine.setLayerIntensity("forest", 1);
    expect(scheduled(gain.gain)).toBeLessThan(intensityToGain(1));

    vi.advanceTimersByTime(300);
    expect(scheduled(gain.gain)).toBeCloseTo(intensityToGain(1), 6);
    expect(scheduled(context.oscillators[0]!.frequency)).toBeCloseTo(forestToVoice(1).frequency, 6);

    engine.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps at most one settle timer per layer while the pointer moves", async () => {
    vi.useFakeTimers();
    const { context, engine } = setup();
    await engine.start();

    for (let frame = 0; frame < 20; frame += 1) {
      context.currentTime += 1 / 60;
      engine.setLayerIntensity("forest", 0.5);
    }
    expect(vi.getTimerCount()).toBe(1);

    engine.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("mutes one layer without touching the others", async () => {
    const { context, engine } = setup();
    engine.setLayerIntensity("smoke", 0.8);
    engine.setLayerIntensity("co2", 0.8);
    await engine.start();
    const smoke = layerVoiceGain(context, 1);
    const co2 = layerVoiceGain(context, 2);

    expect(scheduled(smoke.gain)).toBeGreaterThan(0);
    engine.setLayerEnabled("smoke", false);
    expect(scheduled(smoke.gain)).toBe(0);
    expect(scheduled(co2.gain)).toBeGreaterThan(0);
    engine.dispose();
  });

  it("gives the smoke layer extra level so the forest does not mask it", async () => {
    const { context, engine } = setup();
    engine.setLayerIntensity("forest", 0.7);
    engine.setLayerIntensity("smoke", 0.7);
    await engine.start();

    const [forest, smoke] = layerVoiceGains(context);
    if (!forest || !smoke) throw new Error("the forest and smoke gains were not created");
    expect(scheduled(forest.gain)).toBeCloseTo(intensityToGain(0.7), 6);
    expect(scheduled(smoke.gain)).toBeCloseTo(intensityToGain(0.7) * SMOKE_LAYER_TRIM, 6);
    expect(scheduled(smoke.gain)).toBeGreaterThan(scheduled(forest.gain));
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
      expect(scheduled(gain.gain)).toBeGreaterThan(0);
    }
    expect(scheduled(smoke.gain)).toBeGreaterThan(scheduled(forest.gain));
    for (const panner of context.panners) {
      expect(scheduled(panner.pan)).toBeCloseTo(positionToPan(0.2), 6);
    }
    engine.dispose();
  });

  it("clamps odd input instead of producing invalid parameters", async () => {
    const { context, engine } = setup();
    await engine.start();
    const gains = layerVoiceGains(context);

    engine.setLayerIntensity("forest", -3);
    engine.setLayerIntensity("smoke", 9);
    engine.setPan(Number.NaN);

    for (const gain of gains) {
      expect(Number.isFinite(scheduled(gain.gain))).toBe(true);
    }
    for (const osc of context.oscillators) {
      if (osc.frequency.scheduledTarget !== null) {
        expect(Number.isFinite(osc.frequency.scheduledTarget)).toBe(true);
      }
    }
    for (const panner of context.panners) {
      expect(Number.isFinite(scheduled(panner.pan))).toBe(true);
    }
    engine.dispose();
  });

  it("turns the lightning frequency into percussion hits", async () => {
    vi.useFakeTimers();
    const { context, engine } = setup();
    engine.setLayerIntensity("lightning", 0.5);
    await engine.start();

    const lightning = layerVoiceGain(context, 3);
    expect(scheduled(lightning.gain)).toBe(1);
    expect(context.oscillators).toHaveLength(6); // no hit before the scheduler runs

    vi.advanceTimersByTime(1);
    expect(context.oscillators).toHaveLength(7); // one body oscillator
    expect(context.oscillators[6]!.frequency.value).toBeCloseTo(210, 6); // 90 + 240 x 0.5
    expect(context.filters[3]!.frequency.value).toBeCloseTo(210 * 8, 6);

    // 3 hits per second at value 0.5: the next one is ~333 ms later.
    vi.advanceTimersByTime(334);
    expect(context.oscillators).toHaveLength(8);

    engine.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses the thunder sample for lightning hits when it is available", async () => {
    vi.useFakeTimers();
    const context = new FakeAudioContext();
    const sample = { duration: 16.6 } as AudioBuffer;
    const engine = createSoundEngine({
      context: context.asAudioContext(),
      lightningSample: sample,
      lightningSampleUrl: null,
    });
    engine.setLayerIntensity("lightning", 0.5);
    await engine.start();
    const sourcesBefore = context.bufferSources.length; // the shared noise loop

    vi.advanceTimersByTime(1);
    expect(context.bufferSources).toHaveLength(sourcesBefore + 1);
    const hit = context.bufferSources.at(-1)!;
    expect(hit.buffer).toBe(sample);
    expect(hit.start.mock.calls[0]?.[2]).toBeCloseTo(LIGHTNING_SAMPLE_TAIL_SECONDS, 6);
    expect(context.oscillators).toHaveLength(6); // no synthesized body

    // 3 hits/s: each hit is scaled down from the 0.9 single-hit level.
    const hitGain = context.gains.at(-1)!;
    const ramp = hitGain.gain.events.find((event) => event.method === "linearRampToValueAtTime");
    expect(ramp?.target).toBeCloseTo(0.9 / Math.sqrt(3), 5);

    engine.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("layers thunder tails instead of cutting them when the rate is high", async () => {
    vi.useFakeTimers();
    const context = new FakeAudioContext();
    const sample = { duration: 16.6 } as AudioBuffer;
    const engine = createSoundEngine({
      context: context.asAudioContext(),
      lightningSample: sample,
      lightningSampleUrl: null,
    });
    engine.setLayerIntensity("lightning", 1); // 6 hits/s, one every ~167 ms
    await engine.start();
    const sourcesBefore = context.bufferSources.length; // the shared noise loop

    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(170);
    expect(context.bufferSources).toHaveLength(sourcesBefore + 2);

    const first = context.bufferSources[sourcesBefore]!;
    const second = context.bufferSources[sourcesBefore + 1]!;
    expect(first.start.mock.calls[0]?.[2]).toBeCloseTo(LIGHTNING_SAMPLE_TAIL_SECONDS, 6);
    expect(second.start.mock.calls[0]?.[2]).toBeCloseTo(LIGHTNING_SAMPLE_TAIL_SECONDS, 6);
    // The first hit was not stopped early; its scheduled stop is its start + tail.
    const startAt = first.start.mock.calls[0]?.[0] as number;
    expect(first.stop.mock.calls[0]?.[0]).toBeCloseTo(startAt + LIGHTNING_SAMPLE_TAIL_SECONDS + 0.02, 6);

    engine.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("loads the thunder sample once from its URL", async () => {
    const context = new FakeAudioContext();
    const fetchSample = vi.fn(async () => new ArrayBuffer(8));
    const engine = createSoundEngine({
      context: context.asAudioContext(),
      lightningSampleUrl: "thunder.ogg",
      fetchSample,
    });

    await engine.start();
    expect(fetchSample).toHaveBeenCalledTimes(1);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it("falls back to the synthesized hit when the sample cannot be loaded", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const context = new FakeAudioContext();
    const engine = createSoundEngine({
      context: context.asAudioContext(),
      lightningSampleUrl: "missing.ogg",
      fetchSample: async () => {
        throw new Error("offline");
      },
    });
    engine.setLayerIntensity("lightning", 0.5);
    await engine.start();

    vi.advanceTimersByTime(1);
    expect(context.oscillators).toHaveLength(7); // synthesized body
    engine.dispose();
    warn.mockRestore();
  });

  it("stops the lightning rhythm when the layer has no data", async () => {
    vi.useFakeTimers();
    const { context, engine } = setup();
    engine.setLayerIntensity("lightning", 0.9);
    await engine.start();

    vi.advanceTimersByTime(1);
    expect(context.oscillators).toHaveLength(7);

    engine.setLayerIntensity("lightning", null);
    expect(scheduled(layerVoiceGain(context, 3).gain)).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(context.oscillators).toHaveLength(7); // no new hits

    engine.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the CO2 voice independent of the lightning layer", async () => {
    vi.useFakeTimers();
    const { context, engine } = setup();
    engine.setLayerIntensity("co2", 0.7);
    engine.setLayerIntensity("lightning", 0.9);
    await engine.start();

    vi.advanceTimersByTime(500);
    expect(scheduled(layerVoiceGain(context, 2).gain)).toBeCloseTo(intensityToGain(0.7), 6);
    expect(context.panners).toHaveLength(4);
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

  it("surfaces a resume failure and stays idle", async () => {
    const { context, engine } = setup();
    context.resumeError = new Error("autoplay blocked");
    await expect(engine.start()).rejects.toThrow("autoplay blocked");
    expect(engine.state).toBe("idle");
    engine.dispose();
  });

  it("stops safely when disposed during the resume await", async () => {
    const { context, engine } = setup();
    let release: (() => void) | undefined;
    context.resume.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    const startPromise = engine.start();
    engine.dispose();
    release?.();
    await expect(startPromise).resolves.toBeUndefined();
    expect(engine.state).toBe("idle");
  });

  it("follows the context when the browser suspends it", async () => {
    const { context, engine } = setup();
    await engine.start();
    const listener = context.addEventListener.mock.calls[0]?.[1] as (() => void) | undefined;
    expect(typeof listener).toBe("function");

    context.state = "suspended";
    listener?.();
    expect(engine.state).toBe("suspended");

    context.state = "running";
    listener?.();
    expect(engine.state).toBe("running");

    engine.dispose();
    expect(context.removeEventListener).toHaveBeenCalled();
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
