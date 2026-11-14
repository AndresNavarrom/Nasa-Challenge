import { describe, expect, it, vi } from "vitest";
import { createSoundEngine } from "./engine";
import { co2ToBreath, forestToVoice, intensityToGain, positionToPan, smokeToTimbre } from "./mapping";

interface ParamEvent {
  method: string;
  target: number;
  time: number;
}

class FakeParam {
  value = 0;
  readonly events: ParamEvent[] = [];

  setValueAtTime(target: number, time: number): void {
    this.value = target;
    this.events.push({ method: "setValueAtTime", target, time });
  }

  linearRampToValueAtTime(target: number, time: number): void {
    this.value = target;
    this.events.push({ method: "linearRampToValueAtTime", target, time });
  }

  setTargetAtTime(target: number, time: number, _timeConstant: number): void {
    this.value = target;
    this.events.push({ method: "setTargetAtTime", target, time });
  }

  cancelScheduledValues(time: number): void {
    this.events.push({ method: "cancelScheduledValues", target: this.value, time });
  }
}

class FakeNode {
  readonly connections: unknown[] = [];
  readonly connect = vi.fn((target: unknown): unknown => {
    this.connections.push(target);
    return target;
  });
  readonly disconnect = vi.fn();
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

class FakeOscillator extends FakeNode {
  type = "sine";
  readonly frequency = new FakeParam();
  readonly start = vi.fn();
  readonly stop = vi.fn();
}

class FakeBiquad extends FakeNode {
  type = "lowpass";
  readonly frequency = new FakeParam();
  readonly Q = new FakeParam();
}

class FakePanner extends FakeNode {
  readonly pan = new FakeParam();
}

class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam();
  readonly knee = new FakeParam();
  readonly ratio = new FakeParam();
  readonly attack = new FakeParam();
  readonly release = new FakeParam();
}

class FakeAnalyser extends FakeNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  readonly getFloatTimeDomainData = vi.fn((data: Float32Array): void => {
    data.fill(0.25);
  });
}

class FakeAudioBuffer {
  readonly channels: Float32Array[];

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    return this.channels[channel] ?? new Float32Array(this.length);
  }
}

class FakeBufferSource extends FakeNode {
  buffer: FakeAudioBuffer | null = null;
  loop = false;
  readonly start = vi.fn();
  readonly stop = vi.fn();
}

class FakeAudioContext {
  currentTime = 0;
  sampleRate = 48000;
  state: "suspended" | "running" | "closed" = "suspended";
  readonly destination = new FakeNode();
  readonly gains: FakeGain[] = [];
  readonly oscillators: FakeOscillator[] = [];
  readonly filters: FakeBiquad[] = [];
  readonly panners: FakePanner[] = [];
  readonly analysers: FakeAnalyser[] = [];
  readonly buffers: FakeAudioBuffer[] = [];
  readonly bufferSources: FakeBufferSource[] = [];
  readonly resume = vi.fn(async (): Promise<void> => {
    this.state = "running";
  });
  readonly suspend = vi.fn(async (): Promise<void> => {
    this.state = "suspended";
  });
  readonly close = vi.fn(async (): Promise<void> => {
    this.state = "closed";
  });

  createGain(): FakeGain {
    const node = new FakeGain();
    this.gains.push(node);
    return node;
  }

  createOscillator(): FakeOscillator {
    const node = new FakeOscillator();
    this.oscillators.push(node);
    return node;
  }

  createBiquadFilter(): FakeBiquad {
    const node = new FakeBiquad();
    this.filters.push(node);
    return node;
  }

  createStereoPanner(): FakePanner {
    const node = new FakePanner();
    this.panners.push(node);
    return node;
  }

  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor();
  }

  createAnalyser(): FakeAnalyser {
    const node = new FakeAnalyser();
    this.analysers.push(node);
    return node;
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number): FakeAudioBuffer {
    const buffer = new FakeAudioBuffer(numberOfChannels, length, sampleRate);
    this.buffers.push(buffer);
    return buffer;
  }

  createBufferSource(): FakeBufferSource {
    const node = new FakeBufferSource();
    this.bufferSources.push(node);
    return node;
  }
}

function setup() {
  const context = new FakeAudioContext();
  const engine = createSoundEngine({
    context: context as unknown as AudioContext,
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

  it("keeps all three layers audible together and pans them as one", async () => {
    const { context, engine } = setup();
    engine.setLayerIntensity("forest", 0.7);
    engine.setLayerIntensity("smoke", 0.7);
    engine.setLayerIntensity("co2", 0.7);
    engine.setPan(0.2);
    await engine.start();

    for (const gain of layerVoiceGains(context)) {
      expect(gain.gain.value).toBeGreaterThan(0);
      expect(gain.gain.value).toBeLessThanOrEqual(intensityToGain(0.7));
    }
    for (const panner of context.panners) {
      expect(panner.pan.value).toBeCloseTo(positionToPan(0.2), 6);
    }
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
