import { useCallback, useEffect, useMemo, useState } from "react";
import { loadJukeboxData } from "./data/loadManifest";
import type { JukeboxData } from "./data/types";
import { EarthScene, type Probe, type TargetView } from "./scene/EarthScene";
import type { ViewMode } from "./scene/FocusTransition";
import { ListeningPointProvider } from "./scene/listeningPoint";
import { PlanetHud } from "./ui/PlanetHud";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: JukeboxData }
  | { status: "error"; message: string };

/** Plan B switch: `?lite=1` in the address (half-resolution planet image, instant view changes). */
function readLiteMode(search: string): boolean {
  return new URLSearchParams(search).get("lite") === "1";
}

/** Layer shown first: the first one with a whole-planet grid (forest today), else the first listed. */
function defaultLayerId(data: JukeboxData): string {
  const withGlobal = data.layers.find((layer) => layer.global !== null) ?? data.layers[0];
  return withGlobal?.manifest.id ?? "";
}

/** The planet, the Amazon map and their controls, once the data is loaded. */
function PlanetView({ data, lite }: { data: JukeboxData; lite: boolean }) {
  const [activeLayerId, setActiveLayerId] = useState(() => defaultLayerId(data));
  const [targetView, setTargetView] = useState<TargetView>("globe");
  const [mode, setMode] = useState<ViewMode>("globe");
  const [probe, setProbe] = useState<Probe | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);

  const activeLayer = useMemo(
    () => data.layers.find((layer) => layer.manifest.id === activeLayerId) ?? data.layers[0],
    [data, activeLayerId],
  );
  const showAmazon = useCallback(() => setTargetView("map"), []);
  const showEarth = useCallback(() => setTargetView("globe"), []);

  if (!activeLayer) {
    return (
      <p role="alert" data-testid="data-error" className="m-8 rounded border border-red-400 p-4 text-red-200">
        The data file lists no layers.
      </p>
    );
  }

  return (
    <>
      <div className="absolute inset-0">
        <EarthScene
          data={data}
          activeLayer={activeLayer}
          targetView={targetView}
          lite={lite}
          onRequestView={setTargetView}
          onModeChange={setMode}
          onProbe={setProbe}
          onFps={setFps}
          onSceneError={setSceneError}
        />
      </div>
      <PlanetHud
        layers={data.layers}
        activeLayerId={activeLayer.manifest.id}
        onSelectLayer={setActiveLayerId}
        mode={mode}
        onAmazon={showAmazon}
        onBackToEarth={showEarth}
        probe={probe}
        fps={fps}
        lite={lite}
        sceneError={sceneError}
      />
    </>
  );
}

/**
 * Loads the prepared data, then shows the 3D planet with the Amazon map
 * transition (plan Step 12). The sound engine reads the listening point from
 * ListeningPointProvider (see scene/listeningPoint.tsx).
 */
export default function App() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const lite = useMemo(() => readLiteMode(window.location.search), []);

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

  return (
    <ListeningPointProvider>
      <main className="relative h-full w-full overflow-hidden">
        {state.status === "loading" && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <h1 className="text-3xl font-semibold">Earth Jukebox</h1>
            <p role="status" data-testid="data-loading">
              Loading data…
            </p>
          </div>
        )}

        {state.status === "error" && (
          <div className="mx-auto flex h-full max-w-3xl flex-col justify-center gap-4 p-8">
            <h1 className="text-3xl font-semibold">Earth Jukebox</h1>
            <p role="alert" data-testid="data-error" className="rounded border border-red-400 p-4 text-red-200">
              {state.message}
            </p>
          </div>
        )}

        {state.status === "ready" && <PlanetView data={state.data} lite={lite} />}
      </main>
    </ListeningPointProvider>
  );
}
