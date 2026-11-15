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
import type { JukeboxData, LoadedLayer } from "./data/types";
import { sampleLayerAt } from "./lib/interpolate";
import { framePosition } from "./lib/timeline";
import { EarthScene, type Probe, type TargetView } from "./scene/EarthScene";
import { loadScenes } from "./scenes/loadScenes";
import type { SceneDefinition, ScenesManifest } from "./scenes/types";
import type { ViewMode } from "./scene/FocusTransition";
import {
  ListeningPointProvider,
  useListeningPoint,
} from "./scene/listeningPoint";
import { TimelineProvider, useTimeline } from "./timeline/TimelineProvider";
import { PlanetHud } from "./ui/PlanetHud";
import { ScenePopup } from "./ui/ScenePopup";
import { TimelineBar } from "./ui/TimelineBar";
import { EARTH_VIEW_ID, layerForChoice } from "./ui/layerChoice";
import { layerVoices } from "./ui/soloLayer";
import { timelineLayer } from "./ui/timelineFormat";
import { startTour } from "./ui/tour";
import { browserFlagStore, hasSeenTour, markTourSeen } from "./ui/tourSteps";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: JukeboxData }
  | { status: "error"; message: string };

/** Data voices fade to this level while a scene popup is open, over 0.6 s. */
const SCENE_DATA_DUCK = 0.12;
const SCENE_DATA_FADE_SECONDS = 0.6;

/** Plan B switch: `?lite=1` in the address (half-resolution planet image, instant view changes). */
function readLiteMode(search: string): boolean {
  return new URLSearchParams(search).get("lite") === "1";
}

interface PlanetViewProps {
  data: JukeboxData;
  lite: boolean;
  audio?: ReactNode;
  timeline?: ReactNode;
  /** The layer picker's value: a layer id or EARTH_VIEW_ID. */
  activeLayerId: string;
  onSelectLayer: (layerId: string) => void;
  onShowTour?: () => void;
  scenes?: ScenesManifest | null;
  onSceneSelect?: (scene: SceneDefinition) => void;
  onCloseScene?: () => void;
  focusedScene?: SceneDefinition | null;
}

/** The planet, the Amazon map and their controls, once the data is loaded. Starts on the plain Earth, with no layer drawn. */
function PlanetView({
  data,
  lite,
  audio,
  timeline,
  activeLayerId,
  onSelectLayer,
  onShowTour,
  scenes,
  onSceneSelect,
  onCloseScene,
  focusedScene,
}: PlanetViewProps) {
  const [targetView, setTargetView] = useState<TargetView>("globe");
  const [mode, setMode] = useState<ViewMode>("globe");
  const [probe, setProbe] = useState<Probe | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [sceneHover, setSceneHover] = useState<{ scene: SceneDefinition; x: number; y: number } | null>(null);
  // The planet starts turning by itself; the "Auto-rotate" switch stops it.
  const [autoRotate, setAutoRotate] = useState(true);

  // null: the plain Earth view, no layer drawn.
  const activeLayer = useMemo(
    () => layerForChoice(data.layers, activeLayerId),
    [data, activeLayerId],
  );
  const selectedPoint = useListeningPoint();
  const { position } = useTimeline();
  const selectedValue =
    selectedPoint && activeLayer
      ? sampleLayerAt(
          activeLayer,
          data.bbox,
          selectedPoint.lon,
          selectedPoint.lat,
          framePosition(position, activeLayer.region.frames),
        )
      : null;
  const showAmazon = useCallback(() => setTargetView("map"), []);
  const showEarth = useCallback(() => {
    setSceneHover(null);
    onCloseScene?.();
    setTargetView("globe");
  }, [onCloseScene]);
  const handleSceneSelect = useCallback(
    (scene: SceneDefinition) => {
      setSceneHover(null);
      onSceneSelect?.(scene);
    },
    [onSceneSelect],
  );
  const handleSceneHover = useCallback(
    (scene: SceneDefinition | null, clientX?: number, clientY?: number) => {
      if (!scene || clientX === undefined || clientY === undefined) {
        setSceneHover(null);
        return;
      }
      setSceneHover({ scene, x: clientX, y: clientY });
    },
    [],
  );

  useEffect(() => {
    if (targetView !== "map") setSceneHover(null);
  }, [targetView]);

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
      <div className="absolute inset-0">
        <EarthScene
          data={data}
          activeLayer={activeLayer}
          targetView={targetView}
          lite={lite}
          autoRotate={autoRotate}
          onRequestView={setTargetView}
          onModeChange={setMode}
          onProbe={setProbe}
          onFps={setFps}
          onSceneError={setSceneError}
          scenes={scenes?.scenes}
          onSceneSelect={handleSceneSelect}
          onSceneHover={handleSceneHover}
          focusedScene={focusedScene}
        />
      </div>
      <PlanetHud
        layers={data.layers}
        activeLayerId={activeLayer?.manifest.id ?? EARTH_VIEW_ID}
        onSelectLayer={onSelectLayer}
        autoRotate={autoRotate}
        onToggleAutoRotate={setAutoRotate}
        mode={mode}
        onAmazon={showAmazon}
        onBackToEarth={showEarth}
        probe={probe}
        fps={fps}
        lite={lite}
        sceneError={sceneError}
        selectedValue={selectedValue}
        audio={audio}
        timeline={timeline}
        onShowTour={onShowTour}
      />
      {sceneHover && !focusedScene && (
        <div
          data-testid="scene-marker-title"
          className="pointer-events-none fixed z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-slate-950/90 px-2 py-1 text-center text-xs text-white shadow"
          style={{ left: sceneHover.x, top: sceneHover.y - 10 }}
        >
          {sceneHover.scene.title}
        </div>
      )}
    </>
  );
}

/**
 * Feeds the sound engine from the point under the cursor and the shared
 * timeline position (plan Step 10, FR3, FR6 and FR7). Lives inside
 * ListeningPointProvider, so the scene publishes the point without knowing
 * about audio. The timeline is static: it starts at 0 and only the Time
 * slider of the timeline bar moves it.
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
 * clock, so moving the Time slider re-renders it alone, not the planet view
 * around it.
 */
function TimelineControls({ layer }: { layer: LoadedLayer }) {
  const timeline = useTimeline();
  return (
    <TimelineBar
      className="w-56"
      position={timeline.position}
      layer={layer}
      onSeek={timeline.seek}
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
  // Starts on the plain Earth view, with no layer drawn and none sounding.
  const [activeLayerId, setActiveLayerId] = useState(EARTH_VIEW_ID);
  const showTour = useGuidedTour();
  const [scenes, setScenes] = useState<ScenesManifest | null>(null);
  const [openScene, setOpenScene] = useState<SceneDefinition | null>(null);
  const [sceneAudioError, setSceneAudioError] = useState<string | null>(null);
  const closeScene = useCallback(() => setOpenScene(null), []);
  // The timeline bar only for a picked layer that changes over time (smoke, CO2).
  const timedLayer = useMemo(() => timelineLayer(data.layers, activeLayerId), [data, activeLayerId]);

  useEffect(() => {
    let cancelled = false;
    loadScenes()
      .then((manifest) => {
        if (!cancelled) setScenes(manifest);
      })
      .catch((cause: unknown) => {
        console.warn("Earth Jukebox could not load its scenes:", cause);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Scene audio: ARPA and the loop start together; the loop fades in over 0.5 s
  // while ARPA keeps playing over it. Closing or switching stops both.
  useEffect(() => {
    if (!openScene) {
      engine.stopSceneAudio();
      engine.setDataVoiceDuck(1, SCENE_DATA_FADE_SECONDS);
      return;
    }
    let cancelled = false;
    setSceneAudioError(null);
    const start = async (): Promise<void> => {
      try {
        if (engine.state === "idle") await engine.start();
        if (cancelled) return;
        engine.setDataVoiceDuck(SCENE_DATA_DUCK, SCENE_DATA_FADE_SECONDS);
        const transition = `./${scenes?.transition.file ?? "audio/samples/arpa.ogg"}`;
        await Promise.all([
          engine.playSceneTransition(transition),
          engine.playSceneLoop(`./${openScene.loop}`, {
            gain: openScene.loopGain,
            fadeInSeconds: 0.5,
          }),
        ]);
      } catch (cause) {
        if (cancelled) return;
        engine.stopSceneAudio();
        engine.setDataVoiceDuck(1, SCENE_DATA_FADE_SECONDS);
        setSceneAudioError(
          `The scene sound could not start: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
    };
    void start();
    return () => {
      cancelled = true;
      engine.stopSceneAudio();
      engine.setDataVoiceDuck(1, SCENE_DATA_FADE_SECONDS);
    };
  }, [engine, openScene, scenes]);

  // The layers never mix: only the picked layer sounds (plain Earth: none).
  useEffect(() => {
    const voices = layerVoices(data.layers.map((layer) => layer.manifest.id), activeLayerId);
    for (const { manifest } of data.layers) {
      engine.setLayerEnabled(manifest.id, voices[manifest.id] === true);
    }
  }, [engine, data, activeLayerId]);

  return (
    <>
      <PlanetView
        data={data}
        lite={lite}
        audio={<AudioStart engine={engine} className="w-56" />}
        timeline={timedLayer ? <TimelineControls layer={timedLayer} /> : undefined}
        activeLayerId={activeLayerId}
        onSelectLayer={setActiveLayerId}
        onShowTour={showTour}
        scenes={scenes}
        onSceneSelect={setOpenScene}
        onCloseScene={closeScene}
        focusedScene={openScene}
      />
      <AudioListener data={data} engine={engine} />
      {openScene && (
        <ScenePopup scene={openScene} onClose={closeScene} audioError={sceneAudioError} />
      )}
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
