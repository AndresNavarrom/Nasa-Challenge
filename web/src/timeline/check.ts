// Development-only timeline check (docs/TIMELINE-HANDOFF.md).
//
// Exercises the playback logic and the audio path at a fixed Amazon-centre
// point, before the scene and the timeline bar are wired. Play/pause, scrub and
// speed all run through the same pure reducer and sampling code the app uses.
//
// Not imported by App.tsx, so it never reaches the production bundle.

import { createSoundEngine } from "../audio/engine";
import { loadJukeboxData } from "../data/loadManifest";
import type { JukeboxData } from "../data/types";
import { sampleLayerAt } from "../lib/interpolate";
import { DEFAULT_DURATION_SECONDS, createPlayback, playbackReducer, type PlaybackState } from "../lib/playback";
import { dateLabelAt, frameBlend, framePosition } from "../lib/timeline";

const engine = createSoundEngine();
let data: JukeboxData | null = null;
let state: PlaybackState = createPlayback();
let scrubbing = false;
let lastMeterAt = 0;

const root = document.getElementById("timeline-check");
if (!root) throw new Error("timeline-check: #timeline-check is missing from the page");

root.innerHTML = `
  <main style="max-width: 760px; margin: 0 auto; padding: 24px; display: flex; flex-direction: column; gap: 16px">
    <header>
      <h1 style="margin: 0 0 4px; font-size: 24px">Earth Jukebox — timeline check</h1>
      <p style="margin: 0; color: #94a3b8; font-size: 14px">
        Development page. Shared 0..1 position, loop forever, 0.1×–8×. Sound follows the Amazon-centre point.
      </p>
    </header>

    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
      <button id="t-start" type="button" style="padding: 8px 16px; border-radius: 6px; border: 1px solid #10b981; background: #10b981; color: #020617; font-weight: 600; cursor: pointer">
        Start sound
      </button>
      <button id="t-play" type="button" style="padding: 8px 16px; border-radius: 6px; border: 1px solid #475569; background: transparent; color: #e2e8f0; cursor: pointer">
        Play
      </button>
      <span id="t-status" style="font-size: 14px; color: #94a3b8">loading data…</span>
    </div>

    <label style="display: flex; flex-direction: column; gap: 4px; font-size: 14px">
      <span>Position — <span id="t-position">0 %</span></span>
      <input id="t-scrub" type="range" min="0" max="1" step="0.001" value="0" />
    </label>

    <label style="display: flex; flex-direction: column; gap: 4px; font-size: 14px">
      <span>Speed — <span id="t-speed">1.0×</span> · sequence <span id="t-duration"></span> s at 1× · loop on</span>
      <input id="t-speed-input" type="range" min="0.1" max="8" step="0.1" value="1" />
    </label>

    <div id="t-layers" style="display: flex; flex-direction: column; gap: 8px"></div>

    <div style="display: flex; flex-direction: column; gap: 4px; font-size: 14px">
      <span>Output level</span>
      <div style="height: 10px; width: 100%; border-radius: 5px; background: #1e293b; overflow: hidden">
        <div id="t-meter" style="height: 100%; width: 100%; transform-origin: left; transform: scaleX(0); background: #10b981"></div>
      </div>
    </div>

    <p id="t-error" role="alert" style="margin: 0; font-size: 13px; color: #fca5a5"></p>
  </main>
`;

function mustElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`timeline-check: #${id} is missing from the page`);
  return element as T;
}

interface LayerRow {
  date: HTMLElement;
  blend: HTMLElement;
}

const startButton = mustElement<HTMLButtonElement>("t-start");
const playButton = mustElement<HTMLButtonElement>("t-play");
const status = mustElement<HTMLSpanElement>("t-status");
const positionReadout = mustElement<HTMLSpanElement>("t-position");
const scrub = mustElement<HTMLInputElement>("t-scrub");
const speedReadout = mustElement<HTMLSpanElement>("t-speed");
const speedInput = mustElement<HTMLInputElement>("t-speed-input");
const durationReadout = mustElement<HTMLSpanElement>("t-duration");
const layerContainer = mustElement<HTMLDivElement>("t-layers");
const meter = mustElement<HTMLDivElement>("t-meter");
const errorLine = mustElement<HTMLParagraphElement>("t-error");

durationReadout.textContent = String(DEFAULT_DURATION_SECONDS);

const rows = new Map<string, LayerRow>();
for (const id of ["forest", "smoke", "co2"]) {
  const row = document.createElement("div");
  row.style.cssText =
    "display: flex; justify-content: space-between; gap: 12px; font-size: 14px; border-bottom: 1px solid #1e293b; padding-bottom: 4px";
  row.innerHTML = `<strong>${id}</strong><span data-field="date" style="color:#94a3b8"></span><span data-field="blend" style="color:#64748b"></span>`;
  layerContainer.append(row);
  rows.set(id, {
    date: row.querySelector<HTMLElement>('[data-field="date"]')!,
    blend: row.querySelector<HTMLElement>('[data-field="blend"]')!,
  });
}

function amazonCenter(): { lon: number; lat: number } | null {
  if (!data) return null;
  return {
    lon: (data.bbox.west + data.bbox.east) / 2,
    lat: (data.bbox.south + data.bbox.north) / 2,
  };
}

function applyAudio(): void {
  const center = amazonCenter();
  if (!data || !center) return;
  for (const layer of data.layers) {
    const frame = framePosition(state.position, layer.region.frames);
    engine.setLayerIntensity(layer.manifest.id, sampleLayerAt(layer, data.bbox, center.lon, center.lat, frame));
  }
  engine.setPan(0.5);
}

function refreshLabels(): void {
  positionReadout.textContent = `${Math.round(state.position * 100)} %`;
  speedReadout.textContent = `${state.speed.toFixed(1)}×`;
  playButton.textContent = state.playing ? "Pause" : "Play";
  if (!scrubbing) scrub.value = String(state.position);
  if (!data) return;
  for (const layer of data.layers) {
    const row = rows.get(layer.manifest.id);
    if (!row) continue;
    row.date.textContent = dateLabelAt(layer.manifest, state.position);
    const count = layer.region.frames;
    if (count <= 1) {
      row.blend.textContent = "fixed";
    } else {
      const blend = frameBlend(state.position, count);
      row.blend.textContent = `${blend.from}→${blend.to} (${Math.round(blend.mix * 100)} %)`;
    }
  }
}

function advance(deltaSeconds: number): void {
  const next = playbackReducer(state, { type: "advance", deltaSeconds });
  if (next !== state) {
    state = next;
    applyAudio();
    refreshLabels();
  }
}

// --- controls -------------------------------------------------------------

startButton.addEventListener("click", () => {
  errorLine.textContent = "";
  engine
    .start()
    .then(() => {
      startButton.disabled = true;
      status.textContent = "sound running";
    })
    .catch((cause: unknown) => {
      errorLine.textContent = `The sound could not start: ${cause instanceof Error ? cause.message : String(cause)}`;
    });
});

playButton.addEventListener("click", () => {
  state = playbackReducer(state, { type: "toggle" });
  applyAudio();
  refreshLabels();
});

scrub.addEventListener("pointerdown", () => {
  scrubbing = true;
});
scrub.addEventListener("pointerup", () => {
  scrubbing = false;
});
scrub.addEventListener("input", () => {
  state = playbackReducer(state, { type: "seek", position: Number(scrub.value) });
  applyAudio();
  refreshLabels();
});

speedInput.addEventListener("input", () => {
  state = playbackReducer(state, { type: "set-speed", speed: Number(speedInput.value) });
  refreshLabels();
});

// --- data -----------------------------------------------------------------

loadJukeboxData()
  .then((loaded) => {
    data = loaded;
    status.textContent = "data ready · press Start sound";
    applyAudio();
    refreshLabels();
  })
  .catch((cause: unknown) => {
    errorLine.textContent = `The data could not be loaded: ${cause instanceof Error ? cause.message : String(cause)}`;
    status.textContent = "data error";
  });

// --- clock ----------------------------------------------------------------

let last = performance.now();
let pending = 0;
const UPDATE_MS = 1000 / 30;

function tick(now: number): void {
  const delta = Math.min(0.25, Math.max(0, (now - last) / 1000));
  last = now;

  if (state.playing) {
    pending += delta;
    if (pending * 1000 >= UPDATE_MS) {
      advance(pending);
      pending = 0;
    }
  }

  if (now - lastMeterAt >= 100) {
    lastMeterAt = now;
    meter.style.transform = `scaleX(${Math.min(1, Math.max(0, engine.getOutputLevel()))})`;
  }

  requestAnimationFrame(tick);
}

refreshLabels();
requestAnimationFrame(tick);
