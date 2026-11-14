import { describe, expect, it, vi } from "vitest";
import { createSoundEngine } from "./engine";
import { forestToVoice, intensityToGain, positionToPan } from "./mapping";

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
  readonly connections: FakeNode[] = [];
  readonly connect = vi.fn((target: FakeNode): FakeNode => {
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

class FakeAudioContext {
  currentTime = 0;
  state: "suspended" | "running" | "closed" = "suspended";
  readonly destination = new FakeNode();
  readonly gains: FakeGain[] = [];
  readonly oscillators: FakeOscillator[] = [];
  readonly panners: FakePanner[] = [];
  readonly analysers: FakeAnalyser[] = [];
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
    return new FakeBiquad();
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

function voiceGain(context: FakeAudioContext): FakeGain {
  const node = context.gains.find((candidate) => candidate.connections.some((target) => target instanceof FakePanner));
  if (!node) throw new Error("the forest voice gain was not created");
  return node;
}

function masterGain(context: FakeAudioContext): FakeGain {
  const node = context.gains.find((candidate) => candidate.connections.some((target) => target instanceof FakeAnalyser));
  if (!node) throw new Error("the master gain was not created");
  return node;
}

describe("sound engine (block B1)", () => {
  it("builds the graph once and reuses it when start is called again", async () => {
    const { context, engine } = setup();
    await engine.start();
    expect(context.oscillators).toHaveLength(2);
    expect(context.resume).toHaveBeenCalledTimes(1);

    await engine.start();
    expect(context.oscillators).toHaveLength(2);
    expect(context.resume).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it("turns a forest value into a pentatonic note and pans the voice", async () => {
    const { context, engine } = setup();
    engine.setLayerIntensity("forest", 1);
    engine.setPan(0.9);
    await engine.start();

    const [main, harmony] = context.oscillators;
    const voice = forestToVoice(1);
    expect(main?.frequency.value).toBeCloseTo(voice.frequency, 6);
    expect(harmony?.frequency.value).toBeCloseTo(voice.harmonyFrequency, 6);
    expect(context.panners[0]?.pan.value).toBeCloseTo(positionToPan(0.9), 6);
    engine.dispose();
  });

  it("goes silent where the layer has no data and comes back when data returns", async () => {
    const { context, engine } = setup();
    await engine.start();
    const gain = voiceGain(context);

    context.currentTime = 0.02;
    engine.setLayerIntensity("forest", 1);
    expect(gain.gain.value).toBeGreaterThan(0);
    expect(gain.gain.value).toBeLessThanOrEqual(intensityToGain(1));

    context.currentTime = 0.04;
    engine.setLayerIntensity("forest", null);
    expect(gain.gain.value).toBe(0);

    context.currentTime = 0.06;
    engine.setLayerIntensity("forest", 0.8);
    expect(gain.gain.value).toBeGreaterThan(0);
    engine.dispose();
  });

  it("schedules ramps instead of setting parameters instantly", async () => {
    const { context, engine } = setup();
    await engine.start();
    const gain = voiceGain(context);

    context.currentTime = 0.05;
    engine.setLayerIntensity("forest", 0.5);
    expect(gain.gain.events.at(-1)?.method).toBe("setTargetAtTime");
    expect(context.oscillators[0]?.frequency.events.at(-1)?.method).toBe("setTargetAtTime");
    engine.dispose();
  });

  it("mutes the forest when the layer is disabled", async () => {
    const { context, engine } = setup();
    await engine.start();
    const gain = voiceGain(context);

    context.currentTime = 0.02;
    engine.setLayerIntensity("forest", 1);
    expect(gain.gain.value).toBeGreaterThan(0);

    engine.setLayerEnabled("forest", false);
    expect(gain.gain.value).toBe(0);

    engine.setLayerEnabled("forest", true);
    expect(gain.gain.value).toBeGreaterThan(0);
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
    expect(context.oscillators[0]?.stop).toHaveBeenCalled();
    expect(context.oscillators[0]?.disconnect).toHaveBeenCalled();
    expect(engine.state).toBe("idle");
  });

  it("reads the output meter from the analyser", async () => {
    const { engine } = setup();
    await engine.start();
    expect(engine.getOutputLevel()).toBeCloseTo(0.25, 6);
    engine.dispose();
  });

  it("leaves the smoke and CO2 voices for block B2", () => {
    const { context, engine } = setup();
    engine.setLayerIntensity("smoke", 0.5);
    engine.setLayerIntensity("co2", 0.5);
    engine.setLayerEnabled("smoke", false);
    expect(context.oscillators).toHaveLength(0);
    expect(context.gains).toHaveLength(0);
  });
});
