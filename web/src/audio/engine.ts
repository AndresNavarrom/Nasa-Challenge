// Real-time sound engine (plan Step 10, block B1).
//
// Headless by design: it owns the Web Audio graph and exposes a small API that
// the scene and the controls (Steps 12-14) call. Nothing here reads the data
// grids; the scene samples a place and a time and passes a value in 0..1, or
// null where the layer has no data.
//
// The forest voice is implemented in this block. The smoke and CO2 voices are
// block B2 of docs/SOUND-ENGINE-PLAN.md and are marked as such below.

import type { LayerId } from "../data/types";
import { clampUnit, forestToVoice, intensityToGain, positionToPan } from "./mapping";
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
const FOREST_HARMONY_MIX = 0.35;
const FOREST_LOWPASS_HZ = 4000;

interface ForestVoice {
  main: OscillatorNode;
  harmony: OscillatorNode;
  harmonyGain: GainNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  panner: StereoPannerNode;
}

interface EngineGraph {
  bus: GainNode;
  limiter: DynamicsCompressorNode;
  master: GainNode;
  analyser: AnalyserNode;
  forest: ForestVoice;
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
  private pendingForest: number | null = null;
  private forestEnabled = true;
  private readonly forestSmoother = new OnePoleSmoother(0);
  private lastUpdateTime = 0;
  private levelBuffer: Float32Array | undefined;
  private suspendTimer: ReturnType<typeof setTimeout> | undefined;

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

    if (!this.context) {
      this.context = this.injectedContext ?? new AudioContext({ latencyHint: "interactive" });
      this.buildGraph();
    }

    this.clearSuspendTimer();
    await this.context.resume();

    const now = this.context.currentTime;
    const master = this.graph?.master.gain;
    if (master) {
      master.cancelScheduledValues(now);
      master.setValueAtTime(0, now);
      master.linearRampToValueAtTime(this.volume, now + START_FADE_SECONDS);
    }

    this.lastUpdateTime = now;
    this.currentState = "running";
    this.applyForestIntensity(this.pendingForest, true);
    if (this.graph) {
      rampParameter(this.graph.forest.panner.pan, positionToPan(this.lastPan), now, this.rampSeconds);
    }
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

    this.clearSuspendTimer();
    this.suspendTimer = setTimeout(() => {
      this.suspendTimer = undefined;
      if (this.currentState === "suspended") {
        void context.suspend();
      }
    }, STOP_FADE_SECONDS * 1000 + 20);
  }

  setLayerIntensity(layer: LayerId, value: number | null): void {
    if (layer === "forest") {
      this.pendingForest = value === null ? null : clampUnit(value);
      if (this.currentState === "running") {
        this.applyForestIntensity(this.pendingForest, false);
      }
      return;
    }
    // TODO(Step 10 / block B2): the smoke and CO2 voices are built in block B2.
  }

  setLayerEnabled(layer: LayerId, enabled: boolean): void {
    if (layer !== "forest") {
      // TODO(Step 10 / block B2): the smoke and CO2 voices are built in block B2.
      return;
    }
    this.forestEnabled = enabled;
    if (this.currentState === "running") {
      this.applyForestIntensity(this.pendingForest, false);
    }
  }

  setPan(horizontal: number): void {
    this.lastPan = clampUnit(horizontal);
    if (this.currentState === "running" && this.context && this.graph) {
      rampParameter(this.graph.forest.panner.pan, positionToPan(this.lastPan), this.context.currentTime, this.rampSeconds);
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

  dispose(): void {
    this.clearSuspendTimer();
    this.currentState = "idle";

    const graph = this.graph;
    if (graph) {
      try {
        graph.forest.main.stop();
      } catch {
        // Already stopped.
      }
      try {
        graph.forest.harmony.stop();
      } catch {
        // Already stopped.
      }
      for (const node of [graph.forest.main, graph.forest.harmony, graph.forest.harmonyGain, graph.forest.filter, graph.forest.gain, graph.forest.panner, graph.bus, graph.limiter, graph.master, graph.analyser]) {
        node.disconnect();
      }
    }
    this.graph = undefined;
    this.levelBuffer = undefined;

    const context = this.context;
    this.context = undefined;
    if (context && !this.injectedContext) {
      void context.close();
    }
  }

  private applyForestIntensity(value: number | null, snap: boolean): void {
    const context = this.context;
    const forest = this.graph?.forest;
    if (!context || !forest) return;

    const now = context.currentTime;
    if (snap) {
      this.forestSmoother.reset(value ?? 0);
    } else {
      const dt = Math.max(0, Math.min(0.25, now - this.lastUpdateTime));
      this.forestSmoother.setTarget(value ?? 0);
      this.forestSmoother.advance(dt, this.smoothingSeconds);
    }
    this.lastUpdateTime = now;

    const smoothed = this.forestSmoother.value;
    const voice = forestToVoice(smoothed);
    const gain = value === null || !this.forestEnabled ? 0 : intensityToGain(smoothed);

    rampParameter(forest.main.frequency, voice.frequency, now, this.rampSeconds);
    rampParameter(forest.harmony.frequency, voice.harmonyFrequency, now, this.rampSeconds);
    rampParameter(forest.gain.gain, gain, now, this.rampSeconds);
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

    const forest = this.buildForestVoice(context, bus);
    this.graph = { bus, limiter, master, analyser, forest };
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
