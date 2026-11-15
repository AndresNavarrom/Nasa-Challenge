# Timeline — decisions and handoff

Status: the timeline is static and user-driven in the app (team decision
2026-11-15). The playback library remains available, but the app never starts
it: the provided datasets do not have enough temporal resolution for
play/pause or speed changes to be sonically interesting. The timeline bar is
built; the visual frames and keyboard support are still pending.

Try it now: `docker compose up web`, then open
<http://127.0.0.1:5173/timeline-check.html>. That development page uses the real
playback reducer and sound engine at a fixed Amazon-centre point; it is not part
of the app or the production bundle.

## Ask for Andrés (UI/scene)

Please build the visible half against the contract below. Work in this order:

1. **`web/src/ui/TimelineBar.tsx`** — range `0..1` (scrub), percentage and
   `dateLabelAt` of the picked layer only; the bar is hidden when the picked
   layer is static (forest, lightning) or on the plain Earth view. `data-testid`: `timeline-bar`,
   `timeline-scrub`, `timeline-date-<id>`. Team decision of 2026-11-15: the
   timeline is static and set by the person, so the bar has no play/pause and
   no speed control (the provider's playback stays, unused by the app).
2. **Dock it in `PlanetHud`** — add a `timeline?: ReactNode` slot next to
   `audio`, same bottom-right panel.
3. **Per-frame textures** — `layerTexture.ts` from a single texture to arrays,
   built from every frame of the grid.
4. **Crossfade** — two samplers per view and `uFrameMix` in `EarthMesh`; set the
   pair from `frameBlend(position, frames)`.
5. **Scene position** — `EarthScene` takes `position`, uses
   `framePosition(position, frames)` for the probe, and re-runs the probe when
   the position changes.

The `timeline` logic is already in place: `useTimeline()` gives
`position/playing/speed/loop/durationSeconds` and the actions; the app only uses
`position` and `seek` for the static bar. Do not duplicate the clock. The dev
harness still exercises the unused playback library.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Time model | **Shared narrative position 0..1** | The layers do not share a real calendar: forest is 2019–2020, CO2 is 23–25 Feb 2020, smoke is “Jul–Aug 2024, clip 0:00…1:05”. Each layer walks its own period and shows its own label. |
| Between instants | **Interpolate** | Audio already blends linearly between frames (`sampleGrid`); the image should crossfade between the same two frames so picture and sound stay together. |
| End of sequence | **Loop forever** | Matches `advancePosition` and the demo loop. |
| Speed | **Not used by the app** since 2026-11-15 | `playback.ts` still supports 0.1×–8× for future data, but the provided datasets lack the temporal resolution to make speed changes sonically interesting. |
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
- `web/src/lib/playback.ts` (pure, tested; **library only, not used by the app**)
  - `PlaybackState`: `position`, `playing`, `speed`, `loop`, `durationSeconds`.
  - `createPlayback(overrides)`, `playbackReducer(state, action)`.
  - Actions: `play`, `pause`, `toggle`, `seek`, `set-speed`, `set-loop`,
    `set-duration`, `advance`.
  - `MIN_SPEED`, `MAX_SPEED`, `DEFAULT_DURATION_SECONDS`.
  - Kept for future data with more temporal resolution; the app only calls
    `seek`.
- `web/src/timeline/TimelineProvider.tsx`
  - `<TimelineProvider>` wraps the app; `useTimeline()` returns the state plus
    `play/pause/toggle/seek/setSpeed/setLoop/setDuration`.
  - Runs the `requestAnimationFrame` clock while playing, but the app never
    starts it; the static bar only dispatches `seek`.
- `web/src/App.tsx`
  - The app is wrapped in `TimelineProvider`.
  - `AudioListener` samples every layer with
    `framePosition(position, layer.region.frames)` and the listening point.
    Static layers have one frame, so their frame is 0.
- `web/timeline-check.html` + `web/src/timeline/check.ts`
  - Dev harness for the unused playback library: start sound, play/pause,
    scrub, 0.1×–8×, per-layer date and frame-blend readout, meter. The app itself
    is static.

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
  /** The picked layer; the bar is shown only for a layer that changes over time. */
  layer: LoadedLayer;
  onSeek(position: number): void;
}
```

- Range `0..1` (step 0.001) for scrubbing. No speed slider and no play/pause
  since 2026-11-15 (static timeline).
- Show `dateLabelAt(layer.manifest, position)` for **the picked layer only**,
  and only when it changes over time (team review, 2026-11-15).
- `data-testid`: `timeline-bar`, `timeline-scrub`, `timeline-date-<id>`.
- Dock it in `PlanetHud` like the audio control (add a `timeline?: ReactNode`
  slot next to `audio`).

### 5. Keyboard / screen reader (step 14)
←/→ step the position; there is no play/pause since 2026-11-15. The existing
a11y text should include the current date label and position.

## Playback and speed status
The playback library (`playback.ts`, `TimelineProvider`) still supports
play/pause and 0.1×–8×, but the app does not start it. The team decided on
2026-11-15 that the provided datasets do not have enough temporal resolution for
speed changes to be sonically interesting; the timeline is static and moved by
hand. Keep the library for future data with more resolution. The dev harness
`/timeline-check.html` still exercises it.

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
