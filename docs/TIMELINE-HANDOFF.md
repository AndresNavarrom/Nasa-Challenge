# Timeline — decisions and handoff

Status: playback logic and audio are implemented on the `timeline` branch
(based on `sonido`). The visual frames, the timeline bar and keyboard support
are still to be built by the interfaz owner.

Try it now: `docker compose up web`, then open
<http://127.0.0.1:5173/timeline-check.html>. That development page uses the real
playback reducer and sound engine at a fixed Amazon-centre point; it is not part
of the app or the production bundle.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Time model | **Shared narrative position 0..1** | The layers do not share a real calendar: forest is 2019–2020, CO2 is 23–25 Feb 2020, smoke is “Jul–Aug 2024, clip 0:00…1:05”. Each layer walks its own period and shows its own label. |
| Between instants | **Interpolate** | Audio already blends linearly between frames (`sampleGrid`); the image should crossfade between the same two frames so picture and sound stay together. |
| End of sequence | **Loop forever** | Matches `advancePosition` and the demo loop. |
| Speed | **0.1×–8×**, slider | “Arbitrary speed” with a safe range; speed only scales the shared position, it does not change the data. |
| Duration at 1× | **24 s** | `DEFAULT_DURATION_SECONDS`; a full loop is ~2 s per CO2 frame. |
| State update rate | **30 Hz** | Enough for audio and a smooth scrubber without re-rendering the app at 60 Hz. |
| Background tabs | Step capped at **0.25 s** | A backgrounded tab must not jump the sequence when it returns. |

## What exists

- `web/src/lib/timeline.ts`
  - `framePosition(position, frames)`: fractional frame.
  - `frameBlend(position, frames) → { from, to, mix }`: the pair of instants to
    crossfade, with the same mix the audio uses.
  - `dateLabelAt(layer, position)`: nearest instant’s label.
  - `advancePosition(position, Δs, duration, loop)`.
- `web/src/lib/playback.ts` (pure, tested)
  - `PlaybackState`: `position`, `playing`, `speed`, `loop`, `durationSeconds`.
  - `createPlayback(overrides)`, `playbackReducer(state, action)`.
  - Actions: `play`, `pause`, `toggle`, `seek`, `set-speed`, `set-loop`,
    `set-duration`, `advance`.
  - `MIN_SPEED`, `MAX_SPEED`, `DEFAULT_DURATION_SECONDS`.
- `web/src/timeline/TimelineProvider.tsx`
  - `<TimelineProvider>` wraps the app; `useTimeline()` returns the state plus
    `play/pause/toggle/seek/setSpeed/setLoop/setDuration`.
  - Runs the `requestAnimationFrame` clock while playing and publishes at
    `TIMELINE_UPDATE_HZ` (30).
- `web/src/App.tsx`
  - The app is wrapped in `TimelineProvider`.
  - `AudioListener` samples every layer with
    `framePosition(position, layer.region.frames)` and the listening point.
    Static layers have one frame, so their frame is 0.
- `web/timeline-check.html` + `web/src/timeline/check.ts`
  - Dev harness: start sound, play/pause, scrub, 0.1×–8×, per-layer date and
    frame-blend readout, meter.

## Handoff to the scene / UI owner

### 1. Per-frame textures (`web/src/scene/layerTexture.ts`)
Replace the single-frame `LayerTextures` with frame arrays:

```ts
export interface LayerTextures {
  global: DataTexture[] | null;
  region: DataTexture[];
}
```

Build one texture per frame (`gridToRgba(grid, frame, …)` and `DataTexture` for
each); the grids are small (smoke 6 × 96×72, CO2 12 × 96×72, forest 1). Dispose
**every** texture in `disposeLayerTextures` and in the error path added for the
PR review. Keep `FIRST_INSTANT` only where a single frame is genuinely wanted.

### 2. Crossfade in the shader (`web/src/scene/EarthMesh.tsx`)
Add a second sampler per view and a mix uniform:

```glsl
uniform sampler2D uLayerRegionA;
uniform sampler2D uLayerRegionB;
uniform float uFrameMix; // frameBlend.mix
...
vec4 a = texture2D(uLayerRegionA, regionUv);
vec4 b = texture2D(uLayerRegionB, regionUv);
overlay = mix(a, b, uFrameMix);
```

Same for the global texture outside the Amazon. Set A = `textures[blend.from]`,
B = `textures[blend.to]` whenever `frameBlend` changes. With one frame
(forest), A = B and mix = 0.

Fallback if fps suffers: nearest frame (`blend.mix < 0.5 ? from : to`) and a
single sampler; keep `?lite=1` on the nearest path.

### 3. Scene state (`web/src/scene/EarthScene.tsx`)
- Accept `position: number` (from `useTimeline` in `App`).
- Compute `frameBlend(position, activeLayer.region.frames)` for the active
  layer and pass it to `EarthMesh`, together with the frame textures.
- Use `framePosition(position, activeLayer.region.frames)` in `probeFor`
  instead of `FIRST_INSTANT`, and re-run the probe refresh effect when
  `position` changes (the pointer does not move while the timeline plays).

### 4. Timeline bar (`web/src/ui/TimelineBar.tsx`, step 13)
Props come from `useTimeline`:

```ts
interface TimelineBarProps {
  position: number;
  playing: boolean;
  speed: number;
  loop: boolean;
  durationSeconds: number;
  layers: LoadedLayer[];        // for the per-layer labels
  onSeek(position: number): void;
  onToggle(): void;
  onSpeed(speed: number): void;
}
```

- Range `0..1` (step 0.001) for scrubbing; `0.1..8` (step 0.1) for speed.
- Show `dateLabelAt(layer.manifest, position)` for **each non-static layer**;
  the labels are independent periods, not one date.
- `data-testid`: `timeline-bar`, `timeline-scrub`, `timeline-play`,
  `timeline-speed`, `timeline-date-<id>`.
- Dock it in `PlanetHud` like the audio control (add a `timeline?: ReactNode`
  slot next to `audio`).

### 5. Keyboard / screen reader (step 14)
Space = play/pause, ←/→ = step the position, and the existing a11y text should
include the current date label and position.

## High-speed tuning
The audio engine smooths at 0.15 s and settles 250 ms after the last input. At
8× a CO2 frame lasts ~0.25 s, so the settle may lag the display. After wiring,
listen at 8× and, if needed, shorten `SETTLE_MS`/`smoothingSeconds` proportionally
to the speed (or only settle when `speed <= 4`).

## Data truth and limitations
- Values are relative intensities, not physical measurements (see `data/SOURCES.md`).
- Smoke and CO2 only cover the Amazon; outside the region the sampled value is
  `null` and the voice is silent.
- Smoke clip timestamps are uneven (`0, 4, 53, 57, 61, 65 s`) but the current
  mapping treats the six frames as equally spaced. Fixing that faithfully needs
  numeric `times[]` in the manifest, produced by `tools/prep` (not in this slice).
- CO2 frames are 6 hours apart (23–25 Feb 2020); “arbitrary moment” means linear
  interpolation between the sampled instants, not measured data.

## Tests
- `web/src/lib/playback.test.ts`: defaults, speed clamp, advance with speed,
  loop, stop/restart without loop, seek/pause/toggle, duration validation.
- `web/src/lib/timeline.test.ts`: `frameBlend` at edges and between instants,
  single-frame layers, out-of-range positions.
- Existing suite (audio, scene, data) stays green.

## Out of scope in this slice
- `EarthMesh`, `EarthScene`, `layerTexture`, `PlanetHud`, `TimelineBar` changes.
- Keyboard shortcuts and screen-reader timeline text.
- Real calendar timestamps / numeric smoke times.
