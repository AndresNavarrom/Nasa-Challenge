import { useEffect, useState } from "react";
import { AudioStart } from "./audio/AudioStart";
import { useSoundEngine } from "./audio/useSoundEngine";
import { loadJukeboxData } from "./data/loadManifest";
import type { JukeboxData } from "./data/types";
import { sampleLayerAt } from "./lib/interpolate";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: JukeboxData }
  | { status: "error"; message: string };

/**
 * Starting shell: loads the prepared data and lists what arrived, so the data
 * path can be checked end to end. The planet, the Amazon map, the sound engine
 * and the controls (plan Steps 10 and 12-14) replace this body.
 */
export default function App() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const engine = useSoundEngine();

  useEffect(() => {
    let cancelled = false;
    loadJukeboxData()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : String(cause);
        console.error("Earth Jukebox could not load its data:", cause);
        if (!cancelled) setState({ status: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Temporary listening point: the centre of the Amazon at the first instant.
  // Step 12 (the planet and the map) replaces this with the point under the cursor.
  useEffect(() => {
    if (state.status !== "ready") return;
    const { data } = state;
    const lon = (data.bbox.west + data.bbox.east) / 2;
    const lat = (data.bbox.south + data.bbox.north) / 2;
    for (const layer of data.layers) {
      engine.setLayerIntensity(layer.manifest.id, sampleLayerAt(layer, data.bbox, lon, lat, 0));
    }
    engine.setPan(0.5);
  }, [engine, state]);

  return (
    <main className="mx-auto flex h-full max-w-3xl flex-col justify-center gap-6 p-8">
      <header>
        <h1 className="text-3xl font-semibold">Earth Jukebox</h1>
        <p className="mt-1 text-slate-300">Listen to the Amazon, the lungs of the world.</p>
        <AudioStart engine={engine} className="mt-4" />
        <p className="mt-2 text-xs text-slate-400">
          Until the planet is wired (Step 12), the sound follows a fixed point at the centre of the Amazon.
        </p>
      </header>

      {state.status === "loading" && (
        <p role="status" data-testid="data-loading">
          Loading data…
        </p>
      )}

      {state.status === "error" && (
        <p role="alert" data-testid="data-error" className="rounded border border-red-400 p-4 text-red-200">
          {state.message}
        </p>
      )}

      {state.status === "ready" && (
        <ul data-testid="layer-list" className="flex flex-col gap-3">
          {state.data.layers.map(({ manifest, global, region }) => (
            <li key={manifest.id} data-testid={`layer-list-item-${manifest.id}`} className="rounded border border-slate-600 p-4">
              <h2 className="text-xl font-medium">
                {manifest.title}
                {manifest.sample && (
                  <span className="ml-2 rounded bg-amber-300 px-2 py-0.5 text-sm text-black">sample data</span>
                )}
              </h2>
              <p className="mt-1 text-sm text-slate-300">{manifest.description}</p>
              <p className="mt-2 text-sm">
                {manifest.static ? "Fixed layer" : `${region.frames} instants`} · {manifest.dates[0]}
                {manifest.dates.length > 1 ? ` to ${manifest.dates[manifest.dates.length - 1]}` : ""} ·{" "}
                {global ? `planet ${global.width}×${global.height} + ` : "Amazon only, "}
                region {region.width}×{region.height}
              </p>
              <p className="mt-1 text-sm text-slate-400">Source: {manifest.source.title}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
