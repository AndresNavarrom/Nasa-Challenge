// Development-only sound check for block B3 (docs/SOUND-ENGINE-PLAN.md).
//
// It is served at /audio-check.html by the Vite dev server and is deliberately
// not imported by App.tsx, so it never reaches the production bundle. Its job
// is to let a tester hear each layer, measure latency and run the 10-minute
// soak before the scene (Step 12) is ready.

import { LAYER_IDS, type LayerId } from "../data/types";
import { createSoundEngine } from "./engine";

const LAYER_LABELS: Record<LayerId, string> = {
  forest: "Forest",
  smoke: "Smoke",
  co2: "CO2",
};

const engine = createSoundEngine();

const root = document.getElementById("audio-check");
if (!root) throw new Error("audio-check: #audio-check is missing from the page");

root.innerHTML = `
  <main style="max-width: 720px; margin: 0 auto; padding: 24px; display: flex; flex-direction: column; gap: 16px">
    <header>
      <h1 style="margin: 0 0 4px; font-size: 24px">Earth Jukebox — sound check (B3)</h1>
      <p style="margin: 0; color: #94a3b8; font-size: 14px">
        Development page. Move the sliders and listen; run the 10-minute soak with the timer below.
      </p>
    </header>

    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
      <button id="check-start" type="button" style="padding: 8px 16px; border-radius: 6px; border: 1px solid #10b981; background: #10b981; color: #020617; font-weight: 600; cursor: pointer">
        Start sound
      </button>
      <button id="check-stop" type="button" style="padding: 8px 16px; border-radius: 6px; border: 1px solid #475569; background: transparent; color: #e2e8f0; cursor: pointer">
        Stop
      </button>
      <span id="check-status" style="font-size: 14px; color: #94a3b8">idle</span>
    </div>

    <div id="check-layers" style="display: flex; flex-direction: column; gap: 12px"></div>

    <label style="display: flex; flex-direction: column; gap: 4px; font-size: 14px">
      <span>Pan — <span id="check-pan-value">0.50</span></span>
      <input id="check-pan" type="range" min="0" max="1" step="0.01" value="0.5" />
    </label>

    <label style="display: flex; flex-direction: column; gap: 4px; font-size: 14px">
      <span>Master volume — <span id="check-volume-value">0.80</span></span>
      <input id="check-volume" type="range" min="0" max="1" step="0.01" value="0.8" />
    </label>

    <div style="display: flex; flex-direction: column; gap: 4px; font-size: 14px">
      <span>Output level</span>
      <div style="height: 10px; width: 100%; border-radius: 5px; background: #1e293b; overflow: hidden">
        <div id="check-meter" style="height: 100%; width: 100%; transform-origin: left; transform: scaleX(0); background: #10b981"></div>
      </div>
    </div>

    <p id="check-latency" style="margin: 0; font-size: 13px; color: #94a3b8"></p>
    <p id="check-error" role="alert" style="margin: 0; font-size: 13px; color: #fca5a5"></p>
  </main>
`;

function mustElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`audio-check: #${id} is missing from the page`);
  return element as T;
}

interface LayerControls {
  slider: HTMLInputElement;
  noData: HTMLInputElement;
  enabled: HTMLInputElement;
  readout: HTMLSpanElement;
}

const layerContainer = mustElement<HTMLDivElement>("check-layers");
const controls = {} as Record<LayerId, LayerControls>;

for (const layer of LAYER_IDS) {
  const row = document.createElement("div");
  row.style.cssText = "display: flex; flex-direction: column; gap: 4px; font-size: 14px";

  const title = document.createElement("div");
  title.style.cssText = "display: flex; gap: 12px; align-items: center";
  const readout = document.createElement("span");
  readout.textContent = "0.50";
  title.innerHTML = `<strong style="min-width: 64px">${LAYER_LABELS[layer]}</strong>`;
  title.append(readout);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "1";
  slider.step = "0.01";
  slider.value = "0.5";
  slider.setAttribute("aria-label", `${LAYER_LABELS[layer]} intensity`);

  const options = document.createElement("div");
  options.style.cssText = "display: flex; gap: 16px; color: #94a3b8";

  const noDataLabel = document.createElement("label");
  const noData = document.createElement("input");
  noData.type = "checkbox";
  noDataLabel.append(noData, document.createTextNode(" no data (silence)"));

  const enabledLabel = document.createElement("label");
  const enabled = document.createElement("input");
  enabled.type = "checkbox";
  enabled.checked = true;
  enabledLabel.append(enabled, document.createTextNode(" layer on"));

  options.append(noDataLabel, enabledLabel);
  row.append(title, slider, options);
  layerContainer.append(row);

  controls[layer] = { slider, noData, enabled, readout };
}

const startButton = mustElement<HTMLButtonElement>("check-start");
const stopButton = mustElement<HTMLButtonElement>("check-stop");
const status = mustElement<HTMLSpanElement>("check-status");
const panSlider = mustElement<HTMLInputElement>("check-pan");
const panValue = mustElement<HTMLSpanElement>("check-pan-value");
const volumeSlider = mustElement<HTMLInputElement>("check-volume");
const volumeValue = mustElement<HTMLSpanElement>("check-volume-value");
const meter = mustElement<HTMLDivElement>("check-meter");
const latency = mustElement<HTMLParagraphElement>("check-latency");
const errorLine = mustElement<HTMLParagraphElement>("check-error");

function applyLayer(layer: LayerId): void {
  const control = controls[layer];
  const hasData = !control.noData.checked;
  const value = hasData ? Number(control.slider.value) : null;
  engine.setLayerEnabled(layer, control.enabled.checked);
  engine.setLayerIntensity(layer, value);
  control.readout.textContent = hasData ? Number(control.slider.value).toFixed(2) : "no data";
  control.slider.disabled = !hasData;
}

for (const layer of LAYER_IDS) {
  const control = controls[layer];
  control.slider.addEventListener("input", () => {
    applyLayer(layer);
  });
  control.noData.addEventListener("change", () => {
    applyLayer(layer);
  });
  control.enabled.addEventListener("change", () => {
    applyLayer(layer);
  });
  applyLayer(layer);
}

engine.setPan(Number(panSlider.value));
panSlider.addEventListener("input", () => {
  panValue.textContent = Number(panSlider.value).toFixed(2);
  engine.setPan(Number(panSlider.value));
});

engine.setMasterVolume(Number(volumeSlider.value));
volumeSlider.addEventListener("input", () => {
  volumeValue.textContent = Number(volumeSlider.value).toFixed(2);
  engine.setMasterVolume(Number(volumeSlider.value));
});

let startedAt: number | undefined;
startButton.addEventListener("click", () => {
  errorLine.textContent = "";
  engine
    .start()
    .then(() => {
      startedAt = performance.now();
      startButton.disabled = true;
      stopButton.disabled = false;
      latency.textContent = `Reported device latency: ${engine.getLatencyMs().toFixed(1)} ms (context base + output).`;
    })
    .catch((cause: unknown) => {
      errorLine.textContent = `The sound could not start: ${cause instanceof Error ? cause.message : String(cause)}`;
    });
});
stopButton.disabled = true;
stopButton.addEventListener("click", () => {
  engine.stop();
  startedAt = undefined;
  startButton.disabled = false;
});

function tick(): void {
  meter.style.transform = `scaleX(${Math.min(1, Math.max(0, engine.getOutputLevel()))})`;
  if (startedAt !== undefined) {
    const seconds = (performance.now() - startedAt) / 1000;
    status.textContent = `running · ${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s · device latency ${engine.getLatencyMs().toFixed(1)} ms`;
  } else {
    status.textContent = engine.state === "idle" ? "idle" : "stopped";
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
