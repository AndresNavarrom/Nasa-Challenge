// Minimal controls over the 3D view until the side panel of plan Step 13:
// "Amazon" and "Back to Earth" (FR2.1, FR2.2), a temporary active-layer picker
// (FR1.4), the longitude/latitude/value indicator (FR4.4) and a frames-per-second
// counter (NFR1).

import type { ReactNode } from "react";
import type { LoadedLayer } from "../data/types";
import type { ViewMode } from "../scene/FocusTransition";
import type { Probe } from "../scene/EarthScene";

export interface PlanetHudProps {
  layers: LoadedLayer[];
  activeLayerId: string;
  onSelectLayer: (layerId: string) => void;
  mode: ViewMode;
  onAmazon: () => void;
  onBackToEarth: () => void;
  probe: Probe | null;
  fps: number | null;
  lite: boolean;
  sceneError: string | null;
  /** Sound controls, docked in the bottom-right panel so they never overlap the HUD. */
  audio?: ReactNode;
  /** Timeline bar (play, position, speed, dates), docked above the sound controls. */
  timeline?: ReactNode;
}

/** Below this the NFR1 target (30 frames per second) is missed. */
const FPS_TARGET = 30;

function formatLongitude(lon: number): string {
  if (Math.abs(lon) < 0.05) return "0.0°";
  return `${Math.abs(lon).toFixed(1)}° ${lon < 0 ? "W" : "E"}`;
}

function formatLatitude(lat: number): string {
  if (Math.abs(lat) < 0.05) return "0.0°";
  return `${Math.abs(lat).toFixed(1)}° ${lat < 0 ? "S" : "N"}`;
}

function modeLabel(mode: ViewMode): string {
  switch (mode) {
    case "globe":
      return "Planet view. Drag to turn it; click the Amazon or press Amazon.";
    case "to-map":
      return "Flying to the Amazon…";
    case "map":
      return "Amazon map.";
    case "to-globe":
      return "Back to the planet…";
  }
}

const panel = "pointer-events-auto rounded-lg bg-slate-950/75 p-3 text-sm shadow-lg backdrop-blur";
const button =
  "rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400";

export function PlanetHud(props: PlanetHudProps) {
  const { layers, activeLayerId, onSelectLayer, mode, onAmazon, onBackToEarth, probe, fps, lite, sceneError, audio, timeline } = props;
  const activeLayer = layers.find((layer) => layer.manifest.id === activeLayerId);

  return (
    <div data-testid="planet-hud" className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
      <div className="flex items-start justify-between gap-4">
        <div className={panel}>
          <h1 className="text-xl font-semibold">Earth Jukebox</h1>
          <label className="mt-2 flex items-center gap-2">
            <span className="text-slate-300">Layer</span>
            <select
              data-testid="planet-hud-layer-select"
              className="rounded bg-slate-800 px-2 py-1"
              value={activeLayerId}
              onChange={(event) => onSelectLayer(event.target.value)}
            >
              {layers.map(({ manifest, global }) => (
                <option key={manifest.id} value={manifest.id}>
                  {manifest.title}
                  {global ? "" : " (Amazon only)"}
                  {manifest.sample ? " (sample data)" : ""}
                </option>
              ))}
            </select>
          </label>
          {activeLayer && activeLayer.manifest.dates.length > 1 && (
            <p className="mt-1 text-xs text-slate-400">Showing the first instant: {activeLayer.manifest.dates[0]}</p>
          )}
        </div>

        <p
          data-testid="planet-hud-fps"
          className={`${panel} font-mono ${fps !== null && fps < FPS_TARGET ? "text-red-300" : "text-emerald-300"}`}
          title="Average frames per second over the last second (target: 30 or more)"
        >
          {fps === null ? "-- fps" : `${fps} fps`}
          {lite ? " · lite" : ""}
        </p>
      </div>

      {sceneError && (
        <p role="alert" data-testid="planet-hud-error" className={`${panel} self-center border border-amber-400 text-amber-100`}>
          {sceneError}
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div data-testid="planet-hud-probe" className={`${panel} min-w-56 font-mono`} aria-live="off">
          {probe ? (
            <>
              <p>
                <span data-testid="planet-hud-probe-lon">{formatLongitude(probe.lon)}</span>
                {", "}
                <span data-testid="planet-hud-probe-lat">{formatLatitude(probe.lat)}</span>
              </p>
              <p data-testid="planet-hud-probe-value">
                {activeLayer?.manifest.title ?? "Layer"}:{" "}
                {probe.value === null ? "no data here" : `${Math.round(probe.value * 100)} %`}
              </p>
            </>
          ) : (
            <p className="text-slate-400">Move the cursor over the planet or the map.</p>
          )}
        </div>

        <div className={`${panel} flex flex-col items-end gap-2`}>
          {timeline && <div className="w-full">{timeline}</div>}
          {audio && <div className="w-full">{audio}</div>}
          <p role="status" data-testid="planet-hud-status" className="text-slate-300">
            {modeLabel(mode)}
          </p>
          <div className="flex gap-2">
            <button type="button" data-testid="planet-hud-amazon-button" className={button} disabled={mode !== "globe"} onClick={onAmazon}>
              Amazon
            </button>
            <button
              type="button"
              data-testid="planet-hud-back-button"
              className={button}
              disabled={mode !== "map"}
              onClick={onBackToEarth}
            >
              Back to Earth
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
