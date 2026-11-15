import type { Driver } from "driver.js";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DataAudio } from "./audio/DataAudio";
import type { SoundEngine } from "./audio/engine";
import type { VisibleField } from "./audio/overview";
import { useSoundEngine } from "./audio/useSoundEngine";
import {
  jukeboxDataOf,
  loadJukeboxCatalog,
  loadLayerGrids,
  type JukeboxCatalog,
} from "./data/loadManifest";
import type { JukeboxData, LayerId, LayerManifest, LoadedLayer } from "./data/types";
import { sampleLayerAt } from "./lib/interpolate";
import { frameBlend, frameIndexAt } from "./lib/timeline";
import { SpinAccumulator, playDelta, positionPerTurn } from "./lib/timelineTrack";
import { EarthScene, type Probe, type TargetView } from "./scene/EarthScene";
import type { ViewOrientation } from "./scene/geo";
import { loadScenes } from "./scenes/loadScenes";
import type { SceneDefinition, ScenesManifest } from "./scenes/types";
import type { ViewMode } from "./scene/FocusTransition";
import { AMAZON_REGION_ID, DEFAULT_REGIONS, loadWorldRegions, regionById, type Region } from "./scene/regions";
import {
  ListeningPointProvider,
  useListeningPoint,
} from "./scene/listeningPoint";
import { TIMELINE_UPDATE_HZ, TimelineProvider, useTimeline, useTimelineActions } from "./timeline/TimelineProvider";
import type { ArcFrame } from "./ui/arcLayout";
import { layerStyle } from "./ui/layerStyle";
import { PlanetHud } from "./ui/PlanetHud";
import { ScenePopup } from "./ui/ScenePopup";
import { EARTH_VIEW_ID, layerForChoice, type WithManifest } from "./ui/layerChoice";
import { layerVoices } from "./ui/soloLayer";
import { TimelineTrack } from "./ui/TimelineTrack";
import { startTour } from "./ui/tour";
import { browserFlagStore, hasSeenTour, markTourSeen, type TourAction } from "./ui/tourSteps";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; catalog: JukeboxCatalog; startLayers: LoadedLayer[] }
  | { status: "error"; message: string };

/**
 * Layers whose grids load before the planet shows: only the forest (about 0.3 MB),
 * which also shapes the region outlines. Every other layer (smoke 16 MB, CO2 9 MB,
 * lightning 5 MB) is fetched the first time it is chosen, so the planet appears
 * without waiting for them.
 */
const START_LAYER_IDS: readonly LayerId[] = ["forest"];

/** Approximate download size of a layer's grids, used to open the smallest timed layer in the tour. */
function layerGridBytes(layer: LayerManifest): number {
  const bytes = (grid: LayerManifest["region"] | null): number =>
    grid ? grid.width * grid.height * grid.frames : 0;
  return bytes(layer.global) + bytes(layer.region);
}

/** Data voices fade to this level while a scene popup is open, over 0.6 s. */
const SCENE_DATA_DUCK = 0.12;
const SCENE_DATA_FADE_SECONDS = 0.6;

/** Plan B switch: `?lite=1` in the address (half-resolution planet image, instant view changes). */
function readLiteMode(search: string): boolean {
  return new URLSearchParams(search).get("lite") === "1";
}

interface PlanetViewProps {
  /** The loaded layers only (a chosen layer joins once its grids have arrived). */
  data: JukeboxData;
  /** Every layer of the data file, loaded or not, for the picker. */
  layerCatalog: readonly WithManifest[];
  /** True while the chosen layer's grids are downloading. */
  loadingLayer?: boolean;
  /** Why the chosen layer could not be loaded, or null. */
  layerLoadError?: string | null;
  engine: SoundEngine;
  lite: boolean;
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
  layerCatalog,
  loadingLayer = false,
  layerLoadError = null,
  engine,
  lite,
  activeLayerId,
  onSelectLayer,
  onShowTour,
  scenes,
  onSceneSelect,
  onCloseScene,
  focusedScene,
}: PlanetViewProps) {
  // The pair of instants on screen and the nearest one, tagged with their layer so
  // a stale pair is never used for another. How far the picture is between the
  // two lives in a ref, read on every animation frame (no re-render).
  const [tracked, setTracked] = useState<TrackedFrames | null>(null);
  const positionRef = useRef(0);
  const frameMixRef = useRef(0);
  const [targetView, setTargetView] = useState<TargetView>("globe");
  const [mode, setMode] = useState<ViewMode>("globe");
  const [probe, setProbe] = useState<Probe | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [sceneHover, setSceneHover] = useState<{ scene: SceneDefinition; x: number; y: number } | null>(null);
  // The planet starts turning by itself; the "Auto-rotate" switch stops it.
  const [autoRotate, setAutoRotate] = useState(true);
  // How the planet is turned, written by the scene on every frame for the compass.
  const orientationRef = useRef<ViewOrientation | null>(null);
  const overviewFieldRef = useRef<VisibleField | null>(null);
  const handleOverviewField = useCallback((field: VisibleField | null) => {
    overviewFieldRef.current = field;
  }, []);

  // null: the plain Earth view, no layer drawn.
  const activeLayer = useMemo(
    () => layerForChoice(data.layers, activeLayerId),
    [data, activeLayerId],
  );
  // Right after a layer change the tracker has not reported yet: read the position
  // it last mirrored, so the textures are built once, at the right instant.
  const layerFrames = activeLayer?.region.frames ?? 1;
  const frames: Omit<TrackedFrames, "layerId"> =
    activeLayer === null
      ? { from: 0, to: 0, nearest: 0 }
      : tracked?.layerId === activeLayer.manifest.id
        ? tracked
        : framesAt(positionRef.current, layerFrames, !lite);
  const frame = frames.nearest;
  // The timeline plays on its own clock at the pace of the planet's turn: one
  // turn's time moves it by a day of hourly data or a year of monthly data
  // (positionPerTurn). Only the person pauses it (the pause button on the line);
  // a zoom into a region, a drag or Auto-rotate off do not. Handed on about 30
  // times a second; only the actions are read here, so this view does not
  // re-render as the timeline moves.
  const { step } = useTimelineActions();
  const [timelinePlaying, setTimelinePlaying] = useState(true);
  const perTurnRef = useRef(0);
  perTurnRef.current = activeLayer ? positionPerTurn(activeLayer.manifest) : 0;
  const clockRef = useRef<SpinAccumulator | null>(null);
  clockRef.current ??= new SpinAccumulator(1000 / TIMELINE_UPDATE_HZ, step);
  useEffect(() => clockRef.current?.reset(), [activeLayer]);
  // No clock for the plain Earth view or a static layer: nothing would move.
  const timelineMoves = perTurnRef.current > 0;
  useEffect(() => {
    if (!timelinePlaying || !timelineMoves) return;
    let frameId = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      clockRef.current?.add(playDelta((now - last) / 1000, perTurnRef.current), now);
      last = now;
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [timelinePlaying, timelineMoves]);
  const selectedPoint = useListeningPoint();
  const selectedValue =
    selectedPoint && activeLayer
      ? sampleLayerAt(activeLayer, data.bbox, selectedPoint.lon, selectedPoint.lat, frame)
      : null;
  // The regions of the world (the Amazon alone until regions.json arrives, or if it
  // cannot be read), the one the map view visits and the one under the cursor.
  // null while regions.json loads, so the region map is built once, with all of them.
  const [regions, setRegions] = useState<readonly Region[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadWorldRegions(data.baseUrl)
      .then((loaded) => {
        if (!cancelled) setRegions(loaded);
      })
      .catch((cause: unknown) => {
        console.error("Earth Jukebox could not load the world regions; only the Amazon is outlined:", cause);
        if (!cancelled) setRegions(DEFAULT_REGIONS);
      });
    return () => {
      cancelled = true;
    };
  }, [data.baseUrl]);
  const [focusRegionId, setFocusRegionId] = useState(AMAZON_REGION_ID);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const visitRegion = useCallback((regionId: string) => {
    setFocusRegionId(regionId);
    setTargetView("map");
  }, []);
  const showAmazon = useCallback(() => visitRegion(AMAZON_REGION_ID), [visitRegion]);
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
  // Every way back to the planet (the button, a double-click or double-tap on the
  // map) closes the open scene too.
  const requestView = useCallback(
    (view: TargetView) => {
      if (view === "globe") showEarth();
      else setTargetView(view);
    },
    [showEarth],
  );

  if (layerCatalog.length === 0) {
    return (
      <p
        role="alert"
        data-testid="data-error"
        className="m-8 rounded-lg border border-red-400 p-4 text-red-200"
      >
        The data file lists no layers.
      </p>
    );
  }

  return (
    <>
      <FrameTracker
        layerId={activeLayer?.manifest.id ?? ""}
        frames={layerFrames}
        fade={!lite}
        positionRef={positionRef}
        mixRef={frameMixRef}
        onFrames={setTracked}
      />
      <div className="absolute inset-0">
        <EarthScene
          data={data}
          activeLayer={activeLayer}
          frame={frames.from}
          nextFrame={frames.to}
          frameMix={frameMixRef}
          targetView={targetView}
          lite={lite}
          autoRotate={autoRotate}
          onRequestView={requestView}
          regions={regions}
          focusRegionId={focusRegionId}
          onFocusRegion={visitRegion}
          onHoverRegion={setHoveredRegionId}
          onModeChange={setMode}
          onProbe={setProbe}
          onFps={setFps}
          onSceneError={setSceneError}
          scenes={scenes?.scenes}
          onSceneSelect={handleSceneSelect}
          onSceneHover={handleSceneHover}
          focusedScene={focusedScene}
          onOverviewField={handleOverviewField}
          orientation={orientationRef}
          markerColor={layerStyle(activeLayer?.manifest.id ?? EARTH_VIEW_ID).color}
        />
      </div>
      <DataAudio
        data={data}
        engine={engine}
        activeLayer={activeLayer}
        mode={mode}
        fade={!lite}
        overviewFieldRef={overviewFieldRef}
      />
      <PlanetHud
        layers={layerCatalog}
        activeLayerId={loadingLayer || layerLoadError ? activeLayerId : (activeLayer?.manifest.id ?? EARTH_VIEW_ID)}
        loadingLayer={loadingLayer}
        layerLoadError={layerLoadError}
        onSelectLayer={onSelectLayer}
        autoRotate={autoRotate}
        onToggleAutoRotate={setAutoRotate}
        mode={mode}
        onAmazon={showAmazon}
        onBackToEarth={showEarth}
        regionName={regionById(focusRegionId, regions ?? DEFAULT_REGIONS)?.name ?? "Amazon"}
        hoveredRegionName={hoveredRegionId ? (regionById(hoveredRegionId, regions ?? DEFAULT_REGIONS)?.name ?? null) : null}
        probe={probe}
        fps={fps}
        lite={lite}
        sceneError={sceneError}
        selectedValue={selectedValue}
        engine={engine}
        orientation={orientationRef}
        timeline={
          activeLayer
            ? (arc, color) => (
                <TimelineControls
                  layer={activeLayer}
                  playing={timelinePlaying}
                  onTogglePlay={() => setTimelinePlaying((playing) => !playing)}
                  arc={arc}
                  color={color}
                />
              )
            : undefined
        }
        onShowTour={onShowTour}
      />
      {sceneHover && !focusedScene && (
        <div
          data-testid="scene-marker-title"
          className="pointer-events-none fixed z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full border border-landing-line bg-landing-deep/90 px-3 py-1 text-center text-xs text-landing-ink shadow"
          style={{ left: sceneHover.x, top: sceneHover.y - 10 }}
        >
          {sceneHover.scene.title}
        </div>
      )}
    </>
  );
}

interface TrackedFrames {
  layerId: string;
  /** Earlier instant of the fade (the picture's base). */
  from: number;
  /** Later instant the picture fades towards; equal to `from` without fading. */
  to: number;
  /** Instant nearest the timeline position: the one the date on the line names. */
  nearest: number;
}

/** The pair of instants around a position (or the nearest one twice, without fading). */
function framesAt(position: number, frames: number, fade: boolean): Omit<TrackedFrames, "layerId"> {
  const nearest = frameIndexAt(position, frames);
  if (!fade) return { from: nearest, to: nearest, nearest };
  const { from, to } = frameBlend(position, frames);
  return { from, to, nearest };
}

/**
 * Turns the shared timeline position into the instants of the active layer on
 * screen: the pair the picture fades between and the nearest one (the date on
 * the line). It reads the clock about 30 times a second, puts how far it is
 * between the pair in `mixRef` (read by the shader on every animation frame) and
 * reports only when an instant changes, so the planet view re-renders a few
 * times per instant, not on every clock tick. In lite mode it does not fade:
 * the nearest instant is shown alone.
 */
function FrameTracker({
  layerId,
  frames,
  fade,
  positionRef,
  mixRef,
  onFrames,
}: {
  layerId: string;
  frames: number;
  fade: boolean;
  positionRef: { current: number };
  mixRef: { current: number };
  onFrames: (tracked: TrackedFrames) => void;
}) {
  const { position } = useTimeline();
  positionRef.current = position;
  mixRef.current = fade ? frameBlend(position, frames).mix : 0;
  const { from, to, nearest } = framesAt(position, frames, fade);
  useEffect(() => {
    onFrames({ layerId, from, to, nearest });
  }, [layerId, from, to, nearest, onFrames]);
  return null;
}

/**
 * The timeline line bound to the shared clock. Only this component reads the
 * clock, so the moving playhead re-renders it alone, not the planet view around it.
 */
function TimelineControls(props: {
  layer: LoadedLayer;
  playing: boolean;
  onTogglePlay: () => void;
  arc: ArcFrame | null;
  color: string;
}) {
  const { layer, playing, onTogglePlay, arc, color } = props;
  const timeline = useTimeline();
  return (
    <TimelineTrack
      position={timeline.position}
      layer={layer}
      playing={playing}
      onTogglePlay={onTogglePlay}
      onSeek={timeline.seek}
      speed={timeline.speed}
      onSpeed={timeline.setSpeed}
      arc={arc}
      color={color}
    />
  );
}

/** Delay before the first-visit tour, so the HUD is laid out when it measures it. */
const TOUR_START_DELAY_MS = 400;

/**
 * The welcome window and guided tour: shown by itself on the first visit of
 * this browser, and again whenever `show` is called (the "?" button).
 */
function useGuidedTour(onAction: (action: TourAction) => void): () => void {
  const tourRef = useRef<Driver | null>(null);
  const actionRef = useRef(onAction);
  actionRef.current = onAction;

  const show = useCallback(() => {
    tourRef.current?.destroy();
    tourRef.current = startTour(
      () => {
        markTourSeen(browserFlagStore());
        tourRef.current = null;
      },
      (action) => actionRef.current(action),
    );
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

/**
 * The loaded layers, plus a way to load another one the first time it is chosen.
 * Each layer is fetched once; a failed one is retried when it is chosen again.
 */
function useLayerLoader(catalog: JukeboxCatalog, startLayers: LoadedLayer[]) {
  const [loaded, setLoaded] = useState<LoadedLayer[]>(startLayers);
  const [errors, setErrors] = useState<Partial<Record<LayerId, string>>>({});
  const pending = useRef(new Set<LayerId>());

  const request = useCallback(
    (layerId: string) => {
      const manifest = catalog.manifest.layers.find((layer) => layer.id === layerId);
      if (!manifest || pending.current.has(manifest.id)) return;
      if (loaded.some((layer) => layer.manifest.id === manifest.id)) return;
      pending.current.add(manifest.id);
      setErrors((current) => {
        const next = { ...current };
        delete next[manifest.id];
        return next;
      });
      loadLayerGrids(manifest, catalog.baseUrl)
        .then((layer) => {
          // Kept in the order of the data file, whatever order they arrive in.
          const order = catalog.manifest.layers.map((entry) => entry.id);
          setLoaded((current) =>
            [...current.filter((entry) => entry.manifest.id !== layer.manifest.id), layer].sort(
              (a, b) => order.indexOf(a.manifest.id) - order.indexOf(b.manifest.id),
            ),
          );
        })
        .catch((cause: unknown) => {
          console.error(`Earth Jukebox could not load the ${manifest.id} layer:`, cause);
          const message = cause instanceof Error ? cause.message : String(cause);
          setErrors((current) => ({
            ...current,
            [manifest.id]: `The ${manifest.title} data could not be loaded (${message}). Choose the layer again to retry.`,
          }));
        })
        .finally(() => pending.current.delete(manifest.id));
    },
    [catalog, loaded],
  );

  const data = useMemo(() => jukeboxDataOf(catalog, loaded), [catalog, loaded]);
  return { data, errors, request };
}

function JukeboxView({
  catalog,
  startLayers,
  lite,
}: {
  catalog: JukeboxCatalog;
  startLayers: LoadedLayer[];
  lite: boolean;
}) {
  const engine = useSoundEngine();
  // Starts on the plain Earth view, with no layer drawn and none sounding.
  const [activeLayerId, setActiveLayerId] = useState(EARTH_VIEW_ID);
  const { data, errors, request } = useLayerLoader(catalog, startLayers);
  const layerCatalog = useMemo(
    () => catalog.manifest.layers.map((manifest) => ({ manifest })),
    [catalog],
  );
  const selectLayer = useCallback(
    (layerId: string) => {
      setActiveLayerId(layerId);
      if (layerId !== EARTH_VIEW_ID) request(layerId);
    },
    [request],
  );
  const activeLoaded = data.layers.some((layer) => layer.manifest.id === activeLayerId);
  const layerLoadError =
    activeLayerId === EARTH_VIEW_ID ? null : (errors[activeLayerId as LayerId] ?? null);
  const loadingLayer = activeLayerId !== EARTH_VIEW_ID && !activeLoaded && layerLoadError === null;
  const previousLayerRef = useRef<string | null>(null);
  const handleTourAction = useCallback(
    (action: TourAction) => {
      if (action === "show-timeline") {
        if (previousLayerRef.current === null) previousLayerRef.current = activeLayerId;
        const current = catalog.manifest.layers.find((layer) => layer.id === activeLayerId);
        if (!current || current.static) {
          const timed = catalog.manifest.layers
            .filter((layer) => !layer.static)
            .sort((a, b) => layerGridBytes(a) - layerGridBytes(b))[0];
          if (timed) selectLayer(timed.id);
        }
        return;
      }
      if (previousLayerRef.current !== null) selectLayer(previousLayerRef.current);
      previousLayerRef.current = null;
    },
    [activeLayerId, catalog, selectLayer],
  );
  const showTour = useGuidedTour(handleTourAction);
  const [scenes, setScenes] = useState<ScenesManifest | null>(null);
  const [openScene, setOpenScene] = useState<SceneDefinition | null>(null);
  const [sceneAudioError, setSceneAudioError] = useState<string | null>(null);
  const closeScene = useCallback(() => setOpenScene(null), []);

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
    const voices = layerVoices(catalog.manifest.layers.map((layer) => layer.id), activeLayerId);
    for (const layer of catalog.manifest.layers) {
      engine.setLayerEnabled(layer.id, voices[layer.id] === true);
    }
  }, [engine, catalog, activeLayerId]);

  return (
    <>
      <PlanetView
        data={data}
        layerCatalog={layerCatalog}
        loadingLayer={loadingLayer}
        layerLoadError={layerLoadError}
        engine={engine}
        lite={lite}
        activeLayerId={activeLayerId}
        onSelectLayer={selectLayer}
        onShowTour={showTour}
        scenes={scenes}
        onSceneSelect={setOpenScene}
        onCloseScene={closeScene}
        focusedScene={openScene}
      />
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
    // Only manifest.json and the start layers (about 0.3 MB) before the planet shows;
    // the other layers load when they are chosen (useLayerLoader).
    loadJukeboxCatalog()
      .then(async (catalog) => {
        const startLayers = await Promise.all(
          catalog.manifest.layers
            .filter((layer) => START_LAYER_IDS.includes(layer.id))
            .map((layer) => loadLayerGrids(layer, catalog.baseUrl)),
        );
        if (!cancelled) setState({ status: "ready", catalog, startLayers });
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
              <h1 className="font-label text-sm font-medium uppercase tracking-[0.22em]">Earth Jukebox</h1>
              <p role="status" data-testid="data-loading" className="text-landing-mist">
                Loading data…
              </p>
            </div>
          )}

          {state.status === "error" && (
            <div className="mx-auto flex h-full max-w-3xl flex-col justify-center gap-4 p-8">
              <h1 className="font-label text-sm font-medium uppercase tracking-[0.22em]">Earth Jukebox</h1>
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
            <JukeboxView catalog={state.catalog} startLayers={state.startLayers} lite={lite} />
          )}
        </main>
      </ListeningPointProvider>
    </TimelineProvider>
  );
}
