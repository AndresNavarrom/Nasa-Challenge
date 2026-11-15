import type { Driver } from "driver.js";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AudioStart } from "./audio/AudioStart";
import type { SoundEngine } from "./audio/engine";
import { useSoundEngine } from "./audio/useSoundEngine";
import { loadJukeboxData } from "./data/loadManifest";
import type { JukeboxData } from "./data/types";
import { sampleLayerAt } from "./lib/interpolate";
import { frameIndexAt, framePosition } from "./lib/timeline";
import { EarthScene, type Probe, type TargetView } from "./scene/EarthScene";
import type { ViewMode } from "./scene/FocusTransition";
import {
  ListeningPointProvider,
  useListeningPoint,
} from "./scene/listeningPoint";
import { TimelineProvider, useTimeline } from "./timeline/TimelineProvider";
import { allHeard, isHeard, withHeard, type HeardLayers } from "./ui/heardLayers";
import { PlanetHud } from "./ui/PlanetHud";
import { TimelineBar } from "./ui/TimelineBar";
import { EARTH_VIEW_ID, layerForChoice } from "./ui/layerChoice";
import { startTour } from "./ui/tour";
import { browserFlagStore, hasSeenTour, markTourSeen } from "./ui/tourSteps";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: JukeboxData }
  | { status: "error"; message: string };

/** Plan B switch: `?lite=1` in the address (half-resolution planet image, instant view changes). */
function readLiteMode(search: string): boolean {
  return new URLSearchParams(search).get("lite") === "1";
}

interface PlanetViewProps {
  data: JukeboxData;
  lite: boolean;
  audio?: ReactNode;
  timeline?: ReactNode;
  heard?: HeardLayers;
  onToggleHeard?: (layerId: string, on: boolean) => void;
  onShowTour?: () => void;
}

/** The planet, the Amazon map and their controls, once the data is loaded. Starts on the plain Earth, with no layer drawn. */
function PlanetView({
  data,
  lite,
  audio,
  timeline,
  heard,
  onToggleHeard,
  onShowTour,
}: PlanetViewProps) {
  const [activeLayerId, setActiveLayerId] = useState(EARTH_VIEW_ID);
  const [frame, setFrame] = useState(0);
  const [targetView, setTargetView] = useState<TargetView>("globe");
  const [mode, setMode] = useState<ViewMode>("globe");
  const [probe, setProbe] = useState<Probe | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);

  // null: the plain Earth view, no layer drawn.
  const activeLayer = useMemo(
    () => layerForChoice(data.layers, activeLayerId),
    [data, activeLayerId],
  );
  const showAmazon = useCallback(() => setTargetView("map"), []);
  const showEarth = useCallback(() => setTargetView("globe"), []);

  if (data.layers.length === 0) {
    return (
      <p
        role="alert"
        data-testid="data-error"
        className="m-8 rounded border border-red-400 p-4 text-red-200"
      >
        The data file lists no layers.
      </p>
    );
  }

  return (
    <>
      <FrameTracker frames={activeLayer?.region.frames ?? 1} onFrame={setFrame} />
      <div className="absolute inset-0">
        <EarthScene
          data={data}
          activeLayer={activeLayer}
          frame={activeLayer ? Math.min(frame, activeLayer.region.frames - 1) : 0}
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
        activeLayerId={activeLayer?.manifest.id ?? EARTH_VIEW_ID}
        onSelectLayer={setActiveLayerId}
        mode={mode}
        onAmazon={showAmazon}
        onBackToEarth={showEarth}
        probe={probe}
        fps={fps}
        lite={lite}
        sceneError={sceneError}
        audio={audio}
        timeline={timeline}
        heard={heard}
        onToggleHeard={onToggleHeard}
        onShowTour={onShowTour}
      />
    </>
  );
}

/**
 * Turns the shared timeline position into the instant of the active layer that
 * is on screen (the same one the timeline bar's date names). It reads the clock
 * about 30 times a second but reports only when the instant changes, so the
 * planet view re-renders once per instant, not on every clock tick.
 */
function FrameTracker({ frames, onFrame }: { frames: number; onFrame: (frame: number) => void }) {
  const { position } = useTimeline();
  const frame = frameIndexAt(position, frames);
  useEffect(() => {
    onFrame(frame);
  }, [frame, onFrame]);
  return null;
}

/**
 * Feeds the sound engine from the point under the cursor and the shared
 * timeline position (plan Step 10, FR3, FR6 and FR7). Lives inside
 * ListeningPointProvider, so the scene publishes the point without knowing
 * about audio. The timeline starts paused at 0; the timeline bar plays it.
 */
function AudioListener({
  data,
  engine,
}: {
  data: JukeboxData;
  engine: SoundEngine;
}) {
  const point = useListeningPoint();
  const { position } = useTimeline();

  useEffect(() => {
    if (!point) {
      for (const layer of data.layers) {
        engine.setLayerIntensity(layer.manifest.id, null);
      }
      return;
    }
    for (const layer of data.layers) {
      // Shared normalized position -> this layer's own fractional instant.
      // Static layers have one frame, so framePosition returns 0 and
      // sampleLayerAt ignores time for them.
      const frame = framePosition(position, layer.region.frames);
      engine.setLayerIntensity(
        layer.manifest.id,
        sampleLayerAt(layer, data.bbox, point.lon, point.lat, frame),
      );
    }
    engine.setPan(point.screenX);
  }, [engine, data, point, position]);

  return null;
}

/**
 * The timeline bar bound to the shared clock. Only this component reads the
 * clock, so while the sequence plays (about 30 updates a second) it re-renders
 * alone, not the planet view around it.
 */
function TimelineControls({ layers }: { layers: JukeboxData["layers"] }) {
  const timeline = useTimeline();
  return (
    <TimelineBar
      className="w-56"
      position={timeline.position}
      playing={timeline.playing}
      speed={timeline.speed}
      durationSeconds={timeline.durationSeconds}
      layers={layers}
      onSeek={timeline.seek}
      onToggle={timeline.toggle}
      onSpeed={timeline.setSpeed}
    />
  );
}

/** Delay before the first-visit tour, so the HUD is laid out when it measures it. */
const TOUR_START_DELAY_MS = 400;

/**
 * The welcome window and guided tour: shown by itself on the first visit of
 * this browser, and again whenever `show` is called (the "?" button).
 */
function useGuidedTour(): () => void {
  const tourRef = useRef<Driver | null>(null);

  const show = useCallback(() => {
    tourRef.current?.destroy();
    tourRef.current = startTour(() => {
      markTourSeen(browserFlagStore());
      tourRef.current = null;
    });
  }, []);

  useEffect(() => {
    if (hasSeenTour(browserFlagStore())) return undefined;
    const timer = window.setTimeout(show, TOUR_START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [show]);

  // Close a tour that is still open when the view goes away.
  useEffect(() => () => tourRef.current?.destroy(), []);

  return show;
}

function JukeboxView({ data, lite }: { data: JukeboxData; lite: boolean }) {
  const engine = useSoundEngine();
  const [heard, setHeard] = useState<HeardLayers>(() => allHeard(data.layers.map((layer) => layer.manifest.id)));
  const toggleHeard = useCallback((layerId: string, on: boolean) => setHeard((current) => withHeard(current, layerId, on)), []);
  const showTour = useGuidedTour();

  // A layer that is not heard keeps its data and drawing; only its voice goes quiet.
  useEffect(() => {
    for (const layer of data.layers) {
      engine.setLayerEnabled(layer.manifest.id, isHeard(heard, layer.manifest.id));
    }
  }, [engine, data, heard]);

  return (
    <>
      <PlanetView
        data={data}
        lite={lite}
        audio={<AudioStart engine={engine} className="w-56" />}
        timeline={<TimelineControls layers={data.layers} />}
        heard={heard}
        onToggleHeard={toggleHeard}
        onShowTour={showTour}
      />
      <AudioListener data={data} engine={engine} />
    </>
  );
}

/**
 * Loads the prepared data, then shows the 3D planet with the Amazon map
 * transition (plan Step 12) and the sound of the listening point (Step 10).
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
    <TimelineProvider>
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
              <p
                role="alert"
                data-testid="data-error"
                className="rounded border border-red-400 p-4 text-red-200"
              >
                {state.message}
              </p>
            </div>
          )}

          {state.status === "ready" && (
            <JukeboxView data={state.data} lite={lite} />
          )}
        </main>
      </ListeningPointProvider>
    </TimelineProvider>
  );
}
