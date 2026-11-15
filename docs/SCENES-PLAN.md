# Scenes — plan

Status: plan only; no implementation yet.
Feature branch: `scenes` (based on `main` at the time of writing).
Assets: `data/scenes/` (untracked source).

## Goal

Add clickable points on the Amazon map. Opening a point:

1. shows a popup with a picture and a short description;
2. plays `ARPA.wav` as a transition sound;
3. at the same time as the transition, starts the scene's loop at zero volume and fades it to its configured level over **0.5 s**; the transition continues over the loop;
4. keeps the loop running while the popup is open, and stops it when the popup closes.

Two scenes exist today:

| Scene | Image | Loop | Loop length |
|---|---|---|---|
| `birds` | `birds/birds.jpeg` (596×335) | `birds/birds.ogg` (Vorbis 48 kHz stereo) | 30.0 s |
| `river` | `river/iss074e0492148~medium.jpg` (1280×853) | `river/amazon-river.ogg` (Vorbis 48 kHz stereo) | 30.6 s |

The transition is `ARPA.wav` (1.58 s). **Decided:** the loop fade starts with the transition and reaches full at 0.5 s; the remaining ~1.1 s of ARPA plays over the loop.

## Coordinates — where to add them

**Add the exact points in `data/scenes/scenes.json`**, in the `lon` and `lat` fields of each scene:

```json
{
  "id": "birds",
  "lon": -62.5,
  "lat": -3.4
}
```

- `lon` and `lat` are decimal degrees (WGS84).
- For markers on the Amazon map they must fall inside the rectangle
  `west -80`, `south -20`, `east -44`, `north 8`; points outside are rejected with
  a development warning.
- Use a number, not a string. Do not put coordinates in a component or in the image
  path.
- The file already contains the `birds` and `river` entries with `null`; fill those
  two, and add any new scene as another object.
- After editing, run the scenes preparation script (see below); it copies the
  assets and regenerates `web/public/scenes/manifest.json`.

If you prefer, send the coordinates in chat and I will fill them in.

## Data layout

Source assets stay in `data/scenes/<id>/` (images and loops). Coordinates and
scene metadata live in **`data/scenes/scenes.json`**. The app reads only a
generated copy under `web/public/scenes/`, so nothing in `web/src` needs to know
source file names.

Proposed preparation step: `tools/scenes/prepare.py` (or a small shell script)
which:

1. validates each scene: unique `id`, `lon`/`lat` numbers inside the Amazon box,
   existing image and loop files, `loopGain` in 0..1;
2. copies images and loops to `web/public/scenes/<id>/` with stable ASCII names
   (for example `river/amazon-river.jpg` instead of the ISS filename);
3. writes **`web/public/scenes/manifest.json`** with the coordinates and runtime
   paths.

Suggested runtime manifest:

```json
{
  "version": 1,
  "transition": {
    "id": "arpa",
    "file": "audio/samples/arpa.ogg"
  },
  "scenes": [
    {
      "id": "birds",
      "title": "Birds",
      "description": "...",
      "lon": -62.5,
      "lat": -3.4,
      "image": "birds/birds.jpg",
      "imageAlt": "Birds in the Amazon forest",
      "loop": "birds/birds.ogg",
      "loopGain": 0.8
    }
  ]
}
```

`ARPA.wav` is already in the audio library prepared by `audio-samples`
(`web/public/audio/samples/arpa.ogg`). Either merge PR #15 first or include a
copy of `arpa.ogg` in `web/public/scenes/audio/`; the plan below assumes the audio
library path.

## UI: clickable markers and popup

### Markers on the Amazon map

Add a `SceneMarkers` component inside the R3F scene, visible only when the map is
flat (`mode === "map"`).

- Convert each coordinate with the existing helpers:
  ```ts
  const center = bboxCenter(bbox);
  const shift = lonLatToPlanePoint(center.lon, center.lat);
  const point = lonLatToPlanePoint(scene.lon, scene.lat);
  // The map mesh is at [-shift.x, -shift.y, GLOBE_RADIUS].
  const position = [point.x - shift.x, point.y - shift.y, GLOBE_RADIUS + 0.01];
  ```
- Draw a small ring plus a dot (or a pin), slightly above the plane to avoid
  z-fighting. Keep the marker size constant in world units so points remain
  clickable as the camera moves.
- `onClick` selects the scene; `onPointerOver` changes the cursor; `onPointerOut`
  restores it. Do not open a scene on a drag.
- Give each marker a `data-testid` (for example `scene-marker-birds`) and an
  accessible name; the DOM fallback list below can also expose buttons for
  keyboard users.
- Hide the markers during `to-map` and `to-globe`, and when the map is not the
  active view.

### Popup

Use a normal React/DOM card in the HUD layer, not a 3D object:

- `web/src/ui/ScenePopup.tsx`, rendered from `App`/`PlanetHud`.
- Shows the image (`<img>` with `alt`), title, description and a close button.
- `role="dialog"`, `aria-modal="true"`, labelled by the title; focus the close
  button on open; Escape closes; clicking the backdrop may close.
- `data-testid="scene-popup"`, `"scene-popup-close"`, `"scene-popup-image"`.
- Image sizes are manageable (45 KB and 128 KB); show a placeholder/loading state
  while the image loads if needed.
- One scene open at a time. Clicking another marker switches scene (play the
  transition again, crossfade the loops). Closing the popup fades the loop out.

## Audio design

### Sequence on click

1. The click is the user gesture: if the engine is not running, call
   `engine.start()` first. (Do not let optional sample loading delay `ARPA`; see
   “engine changes”.)
2. Start `arpa.ogg` immediately as a one-shot; it lasts 1.58 s.
3. Start the scene loop at the same time as `ARPA`, with gain 0 and loop enabled,
   and ramp it to `loopGain` over **0.5 s** while `ARPA` keeps playing over it.
   Preload/decode the loop on click; if it is not ready yet, start it as soon as it
   decodes, still ramping from 0 to `loopGain` over 0.5 s.
4. While the scene is open, duck the data layer voices to about **25–30 %** of
   their current gain (0.2 s ramp), so the scene loop is clearly audible without
   cutting the planet sound entirely.
5. On close: ramp the loop to 0 over ~0.3 s, stop it, restore the data voices.
6. On switching scene: play `ARPA` again; crossfade the old loop out while the new
   one fades in from zero at the same time as its `ARPA`.
7. If `ARPA` cannot load, start the loop with the same 0.5 s fade; log the error
   and keep the scene usable. If the loop cannot load, show an error in the popup
   and restore the data voices.

`ARPA` is a transition, not a loop; it is never restarted by the scene loop. The
loop is independent of the timeline; the timeline may keep running (the data
voices are ducked) or be paused by the user.

### Engine changes

Keep the current layer graph intact and add a separate scene bus:

```
data voices (forest, smoke, CO2, lightning) ─▶ dataBus ─┐
                                                        ├─▶ limiter ─▶ master ─▶ analyser ─▶ destination
ARPA one-shot + scene loop ───────────────────▶ sceneBus ┘
```

Add to `SoundEngine` (names illustrative):

```ts
playSceneTransition(url: string): Promise<void>;
playSceneLoop(url: string, options?: { gain?: number; fadeInSeconds?: number }): Promise<void>;
stopSceneLoop(options?: { fadeOutSeconds?: number }): void;
setDataVoiceDuck(amount: number, seconds?: number): void;
```

- Load and decode each asset once; cache by URL. Fetch from the local app, so the
  demo stays offline.
- `playSceneTransition` creates a one-shot `AudioBufferSourceNode`; stop/disconnect
  on end and on scene close.
- `playSceneLoop` creates a looping source at gain 0 and ramps to `gain` over
  0.5 s; `stopSceneLoop` ramps to 0 and stops. Keep both routed to `sceneBus` and
  the master limiter.
- `setDataVoiceDuck` ramps `dataBus.gain`; do not change individual layer gains.
- Do not block `start()` on optional samples (the thunder sample is the current
  example): load them in the background, so a scene click after a cold start can
  play `ARPA` immediately.
- `dispose()` stops and disconnects transition/loop sources.

### Asset dependency

Main does not yet contain the audio library or `ARPA`. The current `scenes`
branch is based on `main`. Options:

- merge **PR #15** (`audio-samples`) first and use
  `web/public/audio/samples/arpa.ogg`; or
- copy `arpa.ogg` into `web/public/scenes/audio/` so scenes do not depend on the
  audio PR.

The scene loops are already 48 kHz stereo OGG and can be used directly.

## State and edge cases

- One open scene; clicking the same marker again can keep it open or close it
  (choose in implementation; closing via the close button is the baseline).
- Going Back to Earth or starting the map transition closes the popup, fades the
  loop and restores the data voices.
- Clicking outside the popup: close only the popup, not the map.
- A scene with a missing/invalid coordinate is not rendered; log the id in
  development.
- Two scenes at the same point: offset the markers slightly or let the topmost win;
  document the rule.
- Coordinates outside the Amazon box are rejected for this map-based feature.
- Image/loop credits: fill `imageCredit` and `audioCredit` in `scenes.json`;
  the source images/audio need the same attribution treatment as the rest of the
  project.
- Accessibility: markers need accessible names; the popup closes with Escape and
  returns focus to the marker; add a keyboard-accessible scene list if the 3D
  markers cannot be reached by keyboard (Step 14).
- No network: all images and loops are local under `web/public/scenes/`.

## Files to touch

| Area | Files |
|---|---|
| Coordinates and source | `data/scenes/scenes.json`, `data/scenes/<id>/` |
| Preparation | `tools/scenes/prepare.py` (new), `docker-compose.yml` service if desired |
| Runtime assets | `web/public/scenes/` (new) |
| Scene data/types | `web/src/scenes/types.ts`, `web/src/scenes/loadScenes.ts` |
| Markers | `web/src/scene/SceneMarkers.tsx`, `EarthMesh.tsx`, `EarthScene.tsx` |
| Popup | `web/src/ui/ScenePopup.tsx`, `PlanetHud.tsx` or `App.tsx` |
| Audio | `web/src/audio/engine.ts` (scene bus + APIs) |
| Tests | coordinate validation, marker math, audio timing with fake timers; manual browser checklist |

## Tests and verification

- Pure: coordinate validation (inside/outside bbox, non-numeric), unique ids,
  `loopGain` range.
- Marker math: `lonLatToPlanePoint` + map shift gives the expected world position.
- Audio with fake timers: ARPA and the loop start together; the loop starts at
  gain 0 and reaches `loopGain` at ~0.5 s while ARPA is still playing; close fades
  and stops; switching crossfades; duck/restore; missing asset fallback.
- Manual: click each marker, image and loop; close; switch; Back to Earth; map
  transition; no coordinates; offline; keyboard/Escape.
- Existing 110 web tests stay green; `tsc` + `vite build`.

## Delivery order and estimate

1. Coordinate file/schema + validation + runtime copy (1–2 h).
2. Audio scene bus + transition/loop/fade/duck (3–4 h).
3. Markers on the map + popup (3–4 h).
4. Wiring, edge cases, accessibility (2 h).
5. Tests and manual checks (2 h).

Total: roughly **10–12 h**; the audio and marker pieces can be developed in parallel.

## Open decisions

- **Ducking:** 25–30 % for the data voices while a scene is open; confirm the amount.
- **Markers:** Amazon map only for this iteration, or also on the planet.
- **Popup placement:** bottom-right panel (consistent with sound/timeline) or a
  centred modal.
- **Credits:** provide image and audio sources/licences for the two scenes.
- **ARPA dependency:** merge PR #15 or keep a copy in the scenes payload.
