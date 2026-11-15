# Sound Overview — visible-area field

Status: implemented on `sound-overview` (first pass).

## Decision

The planet view sonifies the **visible area** of the selected layer instead of a
single locked point. Every screen column sounds at once:

- **Data time** is the shared timeline position. It advances only while the
  planet turns by itself and selects the frame heard.
- The 12 visible columns are panned across the stereo field and sound
  simultaneously; there is no scan clock or ping-pong.
- Auto-rotate off freezes the data frame, but the field keeps sounding.
- The region map keeps the existing point mode (click locks, drag moves, double
  click returns). The planet has no point selection.

## Field and mapping

- A **12 x 6 screen grid** is raycast against the globe at ~10 Hz, giving 72
  visible cells with longitude, latitude, and screen position.
- Every screen column sounds at the same time; the columns spread across the
  stereo field, so the whole visible field is audible at once.
- **Screen X -> pan.** Visually right cells sound on the right.
- **|Latitude| -> pitch**, quantised to a pentatonic scale: poles low, equator
  high.
- **Layer value -> gain** with a `value^0.7` curve; a cell sounds only when its
  value reaches the **average intensity of the visible field** (a relative
  threshold, never a fixed absolute level); no-data cells are silent.
- **Data time -> frame** through `framePosition`, the same blend the picture and
  point audio use.
- The field is normalised by its total active cells and sent through the
  existing bus and limiter.

## Synthesis

The engine builds the overview field lazily, only when first used:

- 12 columns x 6 rows = 72 oscillators (one per visible cell)
- each column has six row gains, one low-pass filter and one stereo panner
- all 12 panners sound simultaneously; there is no scan clock
- all parameters use short ramps; no nodes are allocated per update
- the instrument table lives in `web/src/audio/overview.ts`, one entry per layer

Current editable instruments:

| Layer | Wave | Role |
|---|---|---|
| Forest | triangle | soft continuous bed |
| Smoke | sawtooth | brighter, rougher |
| CO2 | sawtooth | lower register; minor pentatonic |
| Lightning | square | percussive edge |

Each entry also sets filter cutoff/Q, attack, release, gain, detune, octave and scale. CO2 uses the minor pentatonic scale; the other layers use the major pentatonic scale.

## Integration

- `EarthMesh` samples the visible screen field and publishes it through a ref.
- `DataAudio` turns the field into all columns and updates the engine every 100 ms.
- Globe and return transitions use the overview; the region map uses point mode.
- Auto-rotate, drag, and the map still control data time as before.
- The globe uses drag-to-rotate and double-click-to-zoom; point selection is
  hidden from the globe HUD.
- `TimelineTrack` and the planet-driven `step` playback remain unchanged.

## Verification

- `web/src/audio/overview.test.ts`: 72 cells, pitch/pan/gain mapping, layer
  instrument table.
- `web/src/audio/engine.overview.test.ts`: lazy graph, all-column panners,
  waveform, disable/fade.
- Existing web tests and the production build cover the rest.
- Manual: left/right spread, poles low / equator high, value dynamics,
  Auto-rotate off still sounding the field, globe/map transition, no clipping or
  clicks.
