# Sound Engine Plan — Step 10

Status: planned
Owner: Fernando Gonzalez Rivero
Branch: `sonido`
Date: 2026-11-14

## Goal

Turn the pure value → sound mapping that already exists in
`web/src/audio/mapping.ts` into audible, real-time sound with the Web Audio API:
one voice per NASA layer (forest, smoke, CO2), mixed without clipping, driven by
the point under the cursor and by the shared timeline.

This is Step 10 of the code plan
(`aidlc/spaces/default/intents/261114-earth-jukebox-poc/construction/code-generation/code-generation-plan.md`)
and the B1–B3 blocks in `TAREAS.md`.

## Scope

In scope:

- `web/src/audio/engine.ts`: the headless sound engine (graph, parameters,
  smoothing, start/stop, output meter).
- A small start/mute control under `web/src/audio/` that unlocks audio on a user
  gesture and can be dropped into `App.tsx` later.
- Unit tests for everything that can run without a browser.
- A manual verification checklist for what only a real browser can prove.

Out of scope (other steps own it):

- The 3D planet, Amazon map, transition, panels, timeline UI and story mode
  (Steps 12–14).
- Wiring the engine into the final layout: Step 10 exposes a stable API; the UI
  calls it.
- The local server, offline boot, Docker final container and submission docs
  (Steps 11, 15, 16).

## What already exists

| Piece | Where | State |
|---|---|---|
| Value → sound parameters | `web/src/audio/mapping.ts` | Done, tested |
| Layer data and grids | `web/src/data/loadManifest.ts`, `web/src/data/types.ts` | Done, tested |
| Spatial/time sampling | `web/src/lib/interpolate.ts` (`sampleLayerAt`) | Done, tested |
| Shared timeline | `web/src/lib/timeline.ts` | Done, tested |
| App shell | `web/src/App.tsx` | Lists loaded layers; no sound or scene yet |

Exports the engine will use as-is:

- `forestToVoice(value)` → `{ step, frequency, harmonyFrequency }`
- `smokeToTimbre(value)` → `{ roughness, roughnessRateHz, filterCutoffHz, noiseMix }`
- `co2ToBreath(value)` → `{ rateHz, depth, toneHz }`
- `positionToPan(horizontal)` → pan in `-0.9..0.9`
- `intensityToGain(value | null)` → gain in `0..1`; `null` means silence.

## Deliverables

| File | Purpose |
|---|---|
| `web/src/audio/engine.ts` | Engine: graph construction, per-layer voices, master chain, smoothing, start/stop, meter. |
| `web/src/audio/engine.test.ts` | Unit tests with a minimal fake `AudioContext`. |
| `web/src/audio/smoothing.ts` | Pure one-pole smoother (testable without Web Audio). |
| `web/src/audio/smoothing.test.ts` | Tests for the smoother. |
| `web/src/audio/AudioStart.tsx` | Start and mute control (`data-testid` for Step 14). |
| `docs/SOUND-ENGINE-PLAN.md` | This document. |

## Architecture

```
pointer (lon/lat) ──▶ sampleLayerAt() ──▶ engine.setLayerIntensity(id, value)
cursor x ───────────▶ positionToPan() ──▶ engine.setPan(horizontal)
timeline position ──▶ frame position ───▶ (sampling already returns values)

engine
  forest voice  ─┐
  smoke voice   ─┼─▶ voice bus ─▶ DynamicsCompressor ─▶ master gain ─▶ Analyser ─▶ destination
  CO2 voice     ─┘
```

All nodes are created once at `start()` and reused; per-frame updates only
schedule parameter changes. Nothing is allocated inside the render loop.

### Forest voice

Static layer (no time dimension).

- Two `OscillatorNode`s: the main note at `frequency`, and a quieter harmony at
  `harmonyFrequency` (`mapping.ts` already places it two scale steps above).
- Optional gentle low-pass at ~4 kHz to keep the tone soft.
- Gain from `intensityToGain(value)`; `StereoPannerNode` from `positionToPan`.
- Frequency changes use `setTargetAtTime` (or an 80–120 ms linear ramp) so
  moving the cursor glides between notes instead of stepping.

### Smoke voice

- A single shared, looping white-noise buffer (created once).
- `BiquadFilterNode` low-pass at `filterCutoffHz`.
- Amplitude tremolo: low-frequency oscillator at `roughnessRateHz`, depth scaled
  by `roughness`, applied to a gain stage. `noiseMix` sets the balance between
  the filtered noise and a soft tonal component.
- Gain and pan as above; `null` (no data outside the Amazon) fades to 0.

### CO2 voice

- A filtered noise bed plus a sine tone at `toneHz`, through a low-pass.
- Breathing movement: an LFO at `rateHz` modulating an amplitude gain; `depth`
  sets how far the swell travels. Heavier values breathe faster and lower.
- Gain and pan as above; silence where the layer has no data.

### Master chain

- `DynamicsCompressorNode` configured as a limiter (high ratio, fast attack,
  threshold low enough that three voices never clip).
- Master gain for the mute control.
- `AnalyserNode` (or a small RMS tap) for the output meter.
- Conservative per-voice gains so the sum keeps headroom; the limiter is the
  safety net, not the normal operating point.

## Public API

The UI and scene depend on this interface, not on the graph inside.

```ts
export interface SoundEngine {
  readonly state: "idle" | "running" | "suspended";
  /** Resolves once the AudioContext is running. Must be called from a user gesture. */
  start(): Promise<void>;
  stop(): void;
  /** value in 0..1, or null where the layer has no data. */
  setLayerIntensity(layer: LayerId, value: number | null): void;
  setLayerEnabled(layer: LayerId, enabled: boolean): void;
  /** horizontal 0..1 across the listened area. */
  setPan(horizontal: number): void;
  setMasterVolume(value: number): void;
  /** 0..1, for the output meter. */
  getOutputLevel(): number;
  dispose(): void;
}

export function createSoundEngine(options?: {
  context?: AudioContext;
  rampSeconds?: number;
}): SoundEngine;
```

`context` and `rampSeconds` are injection points for tests and for tuning.

## Data flow and update rate

- The scene samples `sampleLayerAt(layer, bbox, lon, lat, framePosition)` for the
  point under the cursor (Step 12) and calls `setLayerIntensity` once per
  animation frame; the engine coalesces repeated calls and schedules at most one
  parameter update per frame per voice.
- `setPan` follows the same rule.
- The engine never reads the grids itself; that keeps sampling testable and the
  audio code independent of the data format.

## Smoothing and the Amazon border

Inside the Amazon rectangle `sampleLayerAt` uses the detailed regional grid;
outside it uses the coarse global grid (forest only), and smoke/CO2 return
`null` outside the region. Crossing the border can therefore jump in value.

Two defences, both in Step 10:

1. A one-pole smoother (`smoothing.ts`) per layer between incoming values and
   the audio parameters, with a time constant around 120–200 ms. This also
   removes pointer jitter.
2. Parameter ramps (`setTargetAtTime`) of at least ~50 ms on every continuous
   parameter; nothing is set instantly.

If the border still clicks with real data, the fallback is a short crossfade
between region and global values over a narrow band at the rectangle edge; that
belongs in the scene/sampling adapter, not in the engine.

## Start, stop, and autoplay

- Browsers block audio until a user gesture. `AudioStart.tsx` shows a clear
  **Start sound** button; its click calls `engine.start()`.
- The engine creates or resumes the `AudioContext` there, builds the graph, and
  fades in the master gain over ~200 ms.
- `stop()` fades out, then suspends the context; `dispose()` disconnects every
  node so repeated starts do not leak.
- A mute control and the output meter live in the same component.

## Performance and latency targets

| Target | Requirement | How |
|---|---|---|
| Audio latency | ≤ 100 ms (NFR2) | `AudioContext({ latencyHint: "interactive" })`; small graph; parameter changes scheduled ahead; no work in the audio callback. |
| Continuous use | 10 minutes without dropouts (NFR5) | Fixed node graph, no per-frame allocation, no unbounded buffers, disconnect on stop. |
| Frame budget | Do not steal the 30 fps target (NFR3) | At most one parameter update per voice per frame; sampling stays in the scene. |
| Headroom | Three layers mixed without clipping (FR4) | Conservative gains + compressor limiter + meter. |

## Testing

Automated (Vitest, in Docker: `docker compose run --rm web-test`):

- `smoothing.test.ts`: one-pole convergence, no overshoot, `null` handling.
- `engine.test.ts` with a fake `AudioContext` that records node creation and
  parameter calls:
  - graph is built once and reused; `start()` twice does not duplicate nodes;
  - `null` intensity drives the voice gain to 0;
  - value changes schedule ramps rather than instant sets;
  - pan follows `positionToPan`;
  - `stop()` fades out and `dispose()` disconnects;
  - `getOutputLevel()` reads the analyser without throwing.
- Existing suite stays green (18 tests today).

Manual checklist (real browser, recorded in `docs/DEMO-CHECKLIST.md` in Step 16):

- Moving the cursor over the forest changes the note without clicks.
- With eyes closed, a listener identifies which layer is sounding and whether
  its value is high or low in at least 4 of 5 tries.
- Three layers together do not clip; the meter stays below the top.
- Measure pointer-to-sound latency (target ≤ 100 ms).
- Run 10 minutes continuously without dropouts.
- Cross the Amazon border while the forest is sounding; listen for a jump.
- Test in at least two browsers.

## Work blocks

| Block | Work | Done when |
|---|---|---|
| B1 | Forest voice, start button, smooth ramps. | Cursor over the forest changes the note without clicks. |
| B2 | Smoke and CO2 voices, three-layer mix, limiter and meter. | Blind test: layer and high/low identified in 4 of 5 tries. |
| B3 | Tuning with two people outside the team, latency measurement, 10-minute run. | Sound section of the demo checklist is green. |

## Risks and plan B

| Risk | Plan B |
|---|---|
| Clicks or zipper noise when parameters jump | Longer ramps, `setTargetAtTime`, one-pole smoothing. |
| Latency above 100 ms | Reduce the graph (fewer oscillators/nodes), keep `interactive` hint, avoid convolution. |
| Mix sounds noisy or clips | Fewer simultaneous voices, conservative gains, limiter; the CO2 layer can be dropped first (see `TAREAS.md`). |
| Autoplay policy blocks sound during the demo | Start button is the only way audio begins; test it in the demo browsers. |
| Amazon border jump is audible | One-pole smoother; if needed, crossfade at the region edge. |
| Memory growth over 10 minutes | Fixed graph, no per-frame allocation, `dispose()` between runs. |

## Acceptance checklist

| Requirement | What proves it |
|---|---|
| FR3.1 | Forest value changes the note and harmony audibly. |
| FR3.2 | Smoke value changes roughness and darkness audibly. |
| FR3.3 | CO2 value changes breathing rate and weight audibly. |
| FR3.4 | Pan follows the listened point; `null` is silent. |
| FR4 | All three layers sound together without clipping. |
| FR6 | Sound follows the point under the cursor (API ready for Step 12). |
| NFR2 | Measured latency ≤ 100 ms. |
| NFR5 | 10-minute continuous run without dropouts. |
