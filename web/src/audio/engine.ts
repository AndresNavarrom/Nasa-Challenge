// Real-time sound engine (plan Step 10).
//
// Headless by design: it owns the Web Audio graph and exposes a small API that
// the scene and the controls (Steps 12-14) call. Nothing here reads the data
// grids; the scene samples a place and a time and passes a value in 0..1, or
// null where the layer has no data.
//
// Blocks B1 (forest voice) and B2 (smoke and CO2 voices, three-layer mix) are
// implemented here. Block B3 is manual tuning and measurement.

import { LAYER_IDS, type LayerId } from "../data/types";
import { clampUnit, co2ToBreath, forestToVoice, intensityToGain, positionToPan, smokeToTimbre } from "./mapping";
import { DEFAULT_SMOOTHING_SECONDS, OnePoleSmoother } from "./smoothing";

export type SoundEngineState = "idle" | "running" | "suspended";

export interface SoundEngine {
  readonly state: SoundEngineState;
  /** Resolves once the AudioContext is running. Must be called from a user gesture. */
  start(): Promise<void>;
  stop(): void;
  /** value in 0..1, or null where the layer has no data. */
  setLayerIntensity(layer: LayerId, value: number | null): void;
  setLayerEnabled(layer: LayerId, enabled: boolean): void;
  /** Horizontal position across the listened area, 0 (left) .. 1 (right). */
  setPan(horizontal: number): void;
  setMasterVolume(value: number): void;
  /** Current output level in 0..1, for a meter. */
  getOutputLevel(): number;
  /** Device latency reported by the context, in milliseconds (base + output). */
  getLatencyMs(): number;
  dispose(): void;
}

export interface SoundEngineOptions {
  /** Injected context, for tests and for hosts that already own one. */
  context?: AudioContext;
  /** Time an audible parameter takes to settle after a change, in seconds. */
  rampSeconds?: number;
  /** Time constant of the one-pole input smoother, in seconds. */
  smoothingSeconds?: number;
}

const DEFAULT_RAMP_SECONDS = 0.05;
const DEFAULT_VOLUME = 0.8;
const START_FADE_SECONDS = 0.2;
const STOP_FADE_SECONDS = 0.2;
const SETTLE_MS = 250;
const FOREST_HARMONY_MIX = 0.35;
const FOREST_LOWPASS_HZ = 4000;
const SMOKE_TONE_HZ = 180;
const CO2_NOISE_MIX = 0.5;
const NOISE_SECONDS = 2;

/**
 * Per-layer output trim. The smoke voice is mostly filtered noise and a low
 * tone, so at equal gain the two-oscillator forest masks it. Raising its level
 * keeps it audible in the three-layer mix (B3 listening feedback).
 */
export const SMOKE_LAYER_TRIM = 1.6;
const LAYER_TRIM: Record<LayerId, number> = { forest: 1, smoke: SMOKE_LAYER_TRIM, co2: 1 };

interface ForestVoice {
  main: OscillatorNode;
  harmony: OscillatorNode;
  harmonyGain: GainNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  panner: StereoPannerNode;
}

interface SmokeVoice {
  noiseGain: GainNode;
  tone: OscillatorNode;
  toneGain: GainNode;
  filter: BiquadFilterNode;
  tremolo: GainNode;
  tremoloDepth: GainNode;
  lfo: OscillatorNode;
  gain: GainNode;
  panner: StereoPannerNode;
}

interface Co2Voice {
  noiseGain: GainNode;
  tone: OscillatorNode;
  toneGain: GainNode;
  filter: BiquadFilterNode;
  breath: GainNode;
  breathDepth: GainNode;
  lfo: OscillatorNode;
  gain: GainNode;
  panner: StereoPannerNode;
}

interface EngineGraph {
  noise: AudioBufferSourceNode;
  bus: GainNode;
  limiter: DynamicsCompressorNode;
  master: GainNode;
  analyser: AnalyserNode;
  forest: ForestVoice;
  smoke: SmokeVoice;
  co2: Co2Voice;
}

interface LayerRuntime {
  value: number | null;
  enabled: boolean;
  smoother: OnePoleSmoother;
  lastUpdateTime: number;
  settleTimer: ReturnType<typeof setTimeout> | undefined;
}

function makeLayerRuntime(): LayerRuntime {
  return { value: null, enabled: true, smoother: new OnePoleSmoother(0), lastUpdateTime: 0, settleTimer: undefined };
}

/** Schedules a glide; setTargetAtTime reaches ~95% of the distance in 3 time constants. */
function rampParameter(parameter: AudioParam, target: number, now: number, rampSeconds: number): void {
  parameter.setTargetAtTime(target, now, Math.max(0.005, rampSeconds / 3));
}

export class WebAudioSoundEngine implements SoundEngine {
  private readonly injectedContext: AudioContext | undefined;
  private readonly rampSeconds: number;
  private readonly smoothingSeconds: number;

  private context: AudioContext | undefined;
  private graph: EngineGraph | undefined;
  private currentState: SoundEngineState = "idle";
  private volume = DEFAULT_VOLUME;
  private lastPan = 0.5;
  private readonly layers: Record<LayerId, LayerRuntime> = {
    forest: makeLayerRuntime(),
    smoke: makeLayerRuntime(),
    co2: makeLayerRuntime(),
  };
  private levelBuffer: Float32Array | undefined;
  private suspendTimer: ReturnType<typeof setTimeout> | undefined;

  /** Keeps `state` honest when the browser or the OS suspends the context. */
  private readonly handleContextStateChange = (): void => {
    const context = this.context;
    if (!context) return;
    const state = context.state as string;
    if (state === "running") {
      if (this.currentState !== "idle") this.currentState = "running";
    } else if (this.currentState === "running") {
      this.currentState = "suspended";
    }
  };

  constructor(options: SoundEngineOptions = {}) {
    this.injectedContext = options.context;
    this.rampSeconds = options.rampSeconds ?? DEFAULT_RAMP_SECONDS;
    this.smoothingSeconds = options.smoothingSeconds ?? DEFAULT_SMOOTHING_SECONDS;
  }

  get state(): SoundEngineState {
    return this.currentState;
  }

  async start(): Promise<void> {
    if (this.currentState === "running") return;

    let context = this.context;
    if (!context) {
      context = this.injectedContext ?? new AudioContext({ latencyHint: "interactive" });
      this.context = context;
      context.addEventListener("statechange", this.handleContextStateChange);
      this.buildGraph();
    }

    this.clearSuspendTimer();
    this.clearSettleTimers();
    try {
      await context.resume();
    } catch (cause) {
      // A dispose() during the await is not an error to show the person.
      if (this.context !== context) return;
      throw cause;
    }
    if (this.context !== context || !this.graph) return;
    const graph = this.graph;

    const now = context.currentTime;
    const master = graph.master.gain;
    master.cancelScheduledValues(now);
    master.setValueAtTime(0, now);
    master.linearRampToValueAtTime(this.volume, now + START_FADE_SECONDS);

    this.currentState = "running";
    for (const layer of LAYER_IDS) {
      this.layers[layer].lastUpdateTime = now;
      this.applyLayer(layer, true);
    }
    this.applyPan(now);
  }

  stop(): void {
    if (!this.context || !this.graph || this.currentState === "idle") return;
    const context = this.context;
    const now = context.currentTime;
    const master = this.graph.master.gain;
    master.cancelScheduledValues(now);
    master.setValueAtTime(master.value, now);
    master.linearRampToValueAtTime(0, now + STOP_FADE_SECONDS);
    this.currentState = "suspended";
    this.clearSettleTimers();

    this.clearSuspendTimer();
    this.suspendTimer = setTimeout(() => {
      this.suspendTimer = undefined;
      if (this.currentState === "suspended") {
        void context.suspend();
      }
    }, STOP_FADE_SECONDS * 1000 + 20);
  }

  setLayerIntensity(layer: LayerId, value: number | null): void {
    // A non-finite sample is bad data, not "almost zero": silence is safer.
    this.layers[layer].value = value === null || !Number.isFinite(value) ? null : clampUnit(value);
    if (this.currentState === "running") {
      this.applyLayer(layer, false);
    }
  }

  setLayerEnabled(layer: LayerId, enabled: boolean): void {
    this.layers[layer].enabled = enabled;
    if (this.currentState === "running") {
      this.applyLayer(layer, false);
    }
  }

  setPan(horizontal: number): void {
    this.lastPan = clampUnit(horizontal);
    if (this.currentState === "running" && this.context) {
      this.applyPan(this.context.currentTime);
    }
  }

  setMasterVolume(value: number): void {
    this.volume = clampUnit(value);
    if (this.currentState === "running" && this.context && this.graph) {
      rampParameter(this.graph.master.gain, this.volume, this.context.currentTime, this.rampSeconds);
    }
  }

  getOutputLevel(): number {
    if (!this.context || !this.graph) return 0;
    const analyser = this.graph.analyser;
    if (!this.levelBuffer || this.levelBuffer.length !== analyser.fftSize) {
      this.levelBuffer = new Float32Array(analyser.fftSize);
    }
    analyser.getFloatTimeDomainData(this.levelBuffer);
    let sum = 0;
    for (const sample of this.levelBuffer) {
      sum += sample * sample;
    }
    return Math.min(1, Math.sqrt(sum / this.levelBuffer.length));
  }

  getLatencyMs(): number {
    if (!this.context) return 0;
    const base = Number.isFinite(this.context.baseLatency) ? this.context.baseLatency : 0;
    const output = Number.isFinite(this.context.outputLatency) ? this.context.outputLatency : 0;
    return (base + output) * 1000;
  }

  dispose(): void {
    this.clearSuspendTimer();
    this.clearSettleTimers();
    this.currentState = "idle";

    const graph = this.graph;
    if (graph) {
      const oscillators = [
        graph.forest.main,
        graph.forest.harmony,
        graph.smoke.tone,
        graph.smoke.lfo,
        graph.co2.tone,
        graph.co2.lfo,
      ];
      for (const oscillator of oscillators) {
        try {
          oscillator.stop();
        } catch {
          // Already stopped.
        }
      }
      try {
        graph.noise.stop();
      } catch {
        // Already stopped.
      }

      const nodes: AudioNode[] = [
        ...oscillators,
        graph.noise,
        graph.forest.harmonyGain,
        graph.forest.filter,
        graph.forest.gain,
        graph.forest.panner,
        graph.smoke.noiseGain,
        graph.smoke.toneGain,
        graph.smoke.filter,
        graph.smoke.tremolo,
        graph.smoke.tremoloDepth,
        graph.smoke.gain,
        graph.smoke.panner,
        graph.co2.noiseGain,
        graph.co2.toneGain,
        graph.co2.filter,
        graph.co2.breath,
        graph.co2.breathDepth,
        graph.co2.gain,
        graph.co2.panner,
        graph.bus,
        graph.limiter,
        graph.master,
        graph.analyser,
      ];
      for (const node of nodes) {
        node.disconnect();
      }
    }
    this.graph = undefined;
    this.levelBuffer = undefined;

    const context = this.context;
    this.context = undefined;
    if (context) {
      context.removeEventListener("statechange", this.handleContextStateChange);
      if (!this.injectedContext) {
        void context.close();
      }
    }
  }

  private applyLayer(layer: LayerId, snap: boolean): void {
    const context = this.context;
    const graph = this.graph;
    if (!context || !graph) return;

    const runtime = this.layers[layer];
    const now = context.currentTime;
    if (snap) {
      runtime.smoother.reset(runtime.value ?? 0);
    } else {
      const dt = Math.max(0, Math.min(0.25, now - runtime.lastUpdateTime));
      runtime.smoother.setTarget(runtime.value ?? 0);
      runtime.smoother.advance(dt, this.smoothingSeconds);
    }
    runtime.lastUpdateTime = now;
    this.renderLayer(layer);

    // The smoother only advances when a sample arrives. If the pointer stops,
    // this finish brings the voice to the value the HUD shows within 250 ms.
    if (!snap) {
      this.scheduleSettle(layer);
    }
  }

  private scheduleSettle(layer: LayerId): void {
    const runtime = this.layers[layer];
    if (runtime.settleTimer !== undefined) {
      clearTimeout(runtime.settleTimer);
    }
    runtime.settleTimer = setTimeout(() => {
      runtime.settleTimer = undefined;
      if (this.currentState !== "running" || !this.context) return;
      runtime.smoother.reset(runtime.value ?? 0);
      runtime.lastUpdateTime = this.context.currentTime;
      this.renderLayer(layer);
    }, SETTLE_MS);
  }

  private clearSettleTimers(): void {
    for (const layer of LAYER_IDS) {
      const runtime = this.layers[layer];
      if (runtime.settleTimer !== undefined) {
        clearTimeout(runtime.settleTimer);
        runtime.settleTimer = undefined;
      }
    }
  }

  /** Schedules every parameter of one layer from its current smoothed value. */
  private renderLayer(layer: LayerId): void {
    const context = this.context;
    const graph = this.graph;
    if (!context || !graph) return;

    const runtime = this.layers[layer];
    const now = context.currentTime;
    const smoothed = runtime.smoother.value;
    const gain = runtime.value === null || !runtime.enabled ? 0 : intensityToGain(smoothed) * LAYER_TRIM[layer];

    if (layer === "forest") {
      const voice = forestToVoice(smoothed);
      rampParameter(graph.forest.main.frequency, voice.frequency, now, this.rampSeconds);
      rampParameter(graph.forest.harmony.frequency, voice.harmonyFrequency, now, this.rampSeconds);
      rampParameter(graph.forest.gain.gain, gain, now, this.rampSeconds);
      return;
    }

    if (layer === "smoke") {
      const timbre = smokeToTimbre(smoothed);
      const depth = timbre.roughness * 0.5;
      rampParameter(graph.smoke.filter.frequency, timbre.filterCutoffHz, now, this.rampSeconds);
      rampParameter(graph.smoke.noiseGain.gain, timbre.noiseMix, now, this.rampSeconds);
      rampParameter(graph.smoke.toneGain.gain, 1 - timbre.noiseMix, now, this.rampSeconds);
      rampParameter(graph.smoke.lfo.frequency, timbre.roughnessRateHz, now, this.rampSeconds);
      rampParameter(graph.smoke.tremoloDepth.gain, depth, now, this.rampSeconds);
      rampParameter(graph.smoke.tremolo.gain, 1 - depth, now, this.rampSeconds);
      rampParameter(graph.smoke.gain.gain, gain, now, this.rampSeconds);
      return;
    }

    const breath = co2ToBreath(smoothed);
    const depth = breath.depth * 0.5;
    rampParameter(graph.co2.filter.frequency, Math.min(FOREST_LOWPASS_HZ, breath.toneHz * 3), now, this.rampSeconds);
    rampParameter(graph.co2.noiseGain.gain, CO2_NOISE_MIX, now, this.rampSeconds);
    rampParameter(graph.co2.toneGain.gain, 1 - CO2_NOISE_MIX, now, this.rampSeconds);
    rampParameter(graph.co2.tone.frequency, breath.toneHz, now, this.rampSeconds);
    rampParameter(graph.co2.lfo.frequency, breath.rateHz, now, this.rampSeconds);
    rampParameter(graph.co2.breathDepth.gain, depth, now, this.rampSeconds);
    rampParameter(graph.co2.breath.gain, 1 - depth, now, this.rampSeconds);
    rampParameter(graph.co2.gain.gain, gain, now, this.rampSeconds);
  }

  private applyPan(now: number): void {
    const graph = this.graph;
    if (!graph) return;
    const pan = positionToPan(this.lastPan);
    rampParameter(graph.forest.panner.pan, pan, now, this.rampSeconds);
    rampParameter(graph.smoke.panner.pan, pan, now, this.rampSeconds);
    rampParameter(graph.co2.panner.pan, pan, now, this.rampSeconds);
  }

  private buildGraph(): void {
    const context = this.context;
    if (!context) throw new Error("Sound engine: the audio context is missing.");

    const bus = context.createGain();
    bus.gain.value = 1;

    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    const master = context.createGain();
    master.gain.value = 0;

    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;

    bus.connect(limiter);
    limiter.connect(master);
    master.connect(analyser);
    analyser.connect(context.destination);

    const noise = this.buildNoiseSource(context);
    const forest = this.buildForestVoice(context, bus);
    const smoke = this.buildSmokeVoice(context, bus, noise);
    const co2 = this.buildCo2Voice(context, bus, noise);

    this.graph = { noise, bus, limiter, master, analyser, forest, smoke, co2 };
  }

  /** One looping white-noise buffer shared by the smoke and CO2 voices. */
  private buildNoiseSource(context: AudioContext): AudioBufferSourceNode {
    const length = Math.max(1, Math.floor(context.sampleRate * NOISE_SECONDS));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.start();
    return source;
  }

  private buildForestVoice(context: AudioContext, bus: GainNode): ForestVoice {
    const base = forestToVoice(0);

    const main = context.createOscillator();
    main.type = "triangle";
    main.frequency.value = base.frequency;

    const harmony = context.createOscillator();
    harmony.type = "sine";
    harmony.frequency.value = base.harmonyFrequency;

    const harmonyGain = context.createGain();
    harmonyGain.gain.value = FOREST_HARMONY_MIX;

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = FOREST_LOWPASS_HZ;
    filter.Q.value = 0.7;

    const gain = context.createGain();
    gain.gain.value = 0;

    const panner = context.createStereoPanner();
    panner.pan.value = positionToPan(0.5);

    main.connect(filter);
    harmony.connect(harmonyGain);
    harmonyGain.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(bus);

    main.start();
    harmony.start();

    return { main, harmony, harmonyGain, filter, gain, panner };
  }

  private buildSmokeVoice(context: AudioContext, bus: GainNode, noise: AudioBufferSourceNode): SmokeVoice {
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.8;

    const noiseGain = context.createGain();
    noiseGain.gain.value = 0.3;

    const tone = context.createOscillator();
    tone.type = "sine";
    tone.frequency.value = SMOKE_TONE_HZ;

    const toneGain = context.createGain();
    toneGain.gain.value = 0.5;

    const tremolo = context.createGain();
    tremolo.gain.value = 1;

    const tremoloDepth = context.createGain();
    tremoloDepth.gain.value = 0;

    const lfo = context.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 18;

    const gain = context.createGain();
    gain.gain.value = 0;

    const panner = context.createStereoPanner();
    panner.pan.value = positionToPan(0.5);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(tremolo);
    tone.connect(toneGain);
    toneGain.connect(tremolo);
    lfo.connect(tremoloDepth);
    tremoloDepth.connect(tremolo.gain);
    tremolo.connect(gain);
    gain.connect(panner);
    panner.connect(bus);

    tone.start();
    lfo.start();

    return { noiseGain, tone, toneGain, filter, tremolo, tremoloDepth, lfo, gain, panner };
  }

  private buildCo2Voice(context: AudioContext, bus: GainNode, noise: AudioBufferSourceNode): Co2Voice {
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.7;

    const noiseGain = context.createGain();
    noiseGain.gain.value = CO2_NOISE_MIX;

    const tone = context.createOscillator();
    tone.type = "sine";
    tone.frequency.value = 520;

    const toneGain = context.createGain();
    toneGain.gain.value = 1 - CO2_NOISE_MIX;

    const breath = context.createGain();
    breath.gain.value = 1;

    const breathDepth = context.createGain();
    breathDepth.gain.value = 0;

    const lfo = context.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.3;

    const gain = context.createGain();
    gain.gain.value = 0;

    const panner = context.createStereoPanner();
    panner.pan.value = positionToPan(0.5);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(breath);
    tone.connect(toneGain);
    toneGain.connect(breath);
    lfo.connect(breathDepth);
    breathDepth.connect(breath.gain);
    breath.connect(gain);
    gain.connect(panner);
    panner.connect(bus);

    tone.start();
    lfo.start();

    return { noiseGain, tone, toneGain, filter, breath, breathDepth, lfo, gain, panner };
  }

  private clearSuspendTimer(): void {
    if (this.suspendTimer !== undefined) {
      clearTimeout(this.suspendTimer);
      this.suspendTimer = undefined;
    }
  }
}

/** Creates a sound engine. The AudioContext is only created on `start()`. */
export function createSoundEngine(options: SoundEngineOptions = {}): SoundEngine {
  return new WebAudioSoundEngine(options);
}
