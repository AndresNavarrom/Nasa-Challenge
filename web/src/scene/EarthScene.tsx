// The 3D view: canvas, camera, the planet mesh, the click on the Amazon
// (FR2.1), the listening point under the cursor (FR4.3) and the active layer's
// value there (FR4.4). The base image is earth-8k.jpg when the graphics card
// accepts 8192-pixel textures and earth-4k.jpg otherwise, plus the Amazon crop
// earth-amazon.jpg (FR1.2, FR1.3). Lite mode (`?lite=1`, plan B) always uses
// earth-4k.jpg, fewer segments, no antialiasing and switches views at once.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataTexture, TextureLoader, type Texture, type WebGLRenderer } from "three";
import type { JukeboxData, LoadedLayer } from "../data/types";
import { sampleLayerAt } from "../lib/interpolate";
import { REGION_BASE_IMAGE, pickBaseImage } from "./baseImage";
import { EarthMesh, type GlobeHit } from "./EarthMesh";
import {
  GLOBE_CAMERA_Z,
  createViewState,
  mapCameraZ,
  playFocus,
  playReturn,
  type CancelTransition,
  type ViewMode,
  type ViewState,
} from "./FocusTransition";
import { isInsideBbox, screenX01 } from "./geo";
import { FIRST_INSTANT, disposeLayerTextures, layerTextureFor, type LayerTextures } from "./layerTexture";
import { useSetListeningPoint, type ListeningPoint } from "./listeningPoint";

export type TargetView = "globe" | "map";

/** What the on-screen indicator shows: the place under the cursor and the active layer's value (0..1 or null). */
export interface Probe {
  lon: number;
  lat: number;
  value: number | null;
}

export interface EarthSceneProps {
  data: JukeboxData;
  activeLayer: LoadedLayer;
  targetView: TargetView;
  lite: boolean;
  onRequestView: (view: TargetView) => void;
  onModeChange: (mode: ViewMode) => void;
  onProbe: (probe: Probe | null) => void;
  onFps: (fps: number) => void;
  /** A problem that leaves the view usable (for example a base image missing). */
  onSceneError: (message: string) => void;
}

const CAMERA_FOV = 45;
const FULL_SEGMENTS = { width: 128, height: 64 };
const LITE_SEGMENTS = { width: 64, height: 32 };

function emptyLayerTextures(): LayerTextures {
  const region = new DataTexture(new Uint8Array(4), 1, 1);
  region.needsUpdate = true;
  return { global: null, region };
}

/** WebGL's largest texture side, or null when the renderer does not report it. */
function readMaxTextureSize(gl: WebGLRenderer): number | null {
  try {
    const size = gl.capabilities.maxTextureSize;
    return typeof size === "number" && Number.isFinite(size) && size > 0 ? size : null;
  } catch (cause) {
    console.warn("Earth Jukebox could not read the largest texture size; using the 4096 planet image.", cause);
    return null;
  }
}

/**
 * Loads an image as a texture. On failure it logs the cause, reports
 * `failureMessage` and leaves the texture null, so the caller draws without it.
 */
function useImageTexture(url: string, failureMessage: string, onError: (message: string) => void): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const messageRef = useRef(failureMessage);
  messageRef.current = failureMessage;

  useEffect(() => {
    let cancelled = false;
    let loaded: Texture | null = null;
    new TextureLoader().load(
      url,
      (result) => {
        if (cancelled) {
          result.dispose();
          return;
        }
        loaded = result;
        setTexture(loaded);
      },
      undefined,
      (cause) => {
        if (cancelled) return;
        console.error(`Earth Jukebox could not load ${url}:`, cause);
        onErrorRef.current(messageRef.current);
      },
    );
    return () => {
      cancelled = true;
      loaded?.dispose();
      setTexture(null);
    };
  }, [url]);

  return texture;
}

/** Average frames per second over the last second, reported once a second. */
function FpsProbe({ onFps }: { onFps: (fps: number) => void }) {
  const counter = useRef({ frames: 0, since: performance.now() });
  useFrame(() => {
    const current = counter.current;
    current.frames += 1;
    const now = performance.now();
    const elapsed = now - current.since;
    if (elapsed >= 1000) {
      onFps(Math.round((current.frames * 1000) / elapsed));
      current.frames = 0;
      current.since = now;
    }
  });
  return null;
}

interface SceneContentsProps extends EarthSceneProps {
  setListeningPoint: (point: ListeningPoint | null) => void;
}

function SceneContents(props: SceneContentsProps) {
  const { data, activeLayer, targetView, lite, onRequestView, onModeChange, onProbe, onFps, onSceneError, setListeningPoint } =
    props;
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);

  const view = useRef<ViewState>(createViewState());
  const [mode, setModeState] = useState<ViewMode>("globe");
  const modeRef = useRef<ViewMode>("globe");
  const targetRef = useRef<TargetView>(targetView);
  targetRef.current = targetView;
  const cancelRef = useRef<CancelTransition | null>(null);
  const lastHitRef = useRef<GlobeHit | null>(null);
  const lastProbeRef = useRef<Probe | null>(null);

  const maxTextureSize = useMemo(() => readMaxTextureSize(gl), [gl]);
  const baseUrl = `${data.baseUrl}${pickBaseImage(maxTextureSize, lite)}`;
  const baseTexture = useImageTexture(
    baseUrl,
    `The planet image (${baseUrl}) could not be loaded, so the planet is drawn without it. The layers, the map and the controls still work.`,
    onSceneError,
  );
  const regionUrl = `${data.baseUrl}${REGION_BASE_IMAGE}`;
  const regionBaseTexture = useImageTexture(
    regionUrl,
    `The detailed Amazon image (${regionUrl}) could not be loaded, so the Amazon is drawn from the planet image. Everything else still works.`,
    onSceneError,
  );

  const layer = useMemo(() => {
    try {
      return { textures: layerTextureFor(activeLayer), error: null };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return { textures: emptyLayerTextures(), error: message };
    }
  }, [activeLayer]);
  useEffect(() => {
    if (layer.error) {
      console.error("Earth Jukebox could not draw a layer:", layer.error);
      onSceneError(`${layer.error} The layer is not drawn.`);
    }
    return () => disposeLayerTextures(layer.textures);
  }, [layer, onSceneError]);

  const setMode = (next: ViewMode) => {
    modeRef.current = next;
    setModeState(next);
    onModeChange(next);
    if (next === "to-map" || next === "to-globe") {
      // The indicator hides during the transition, but the listening point stays
      // where it was so the sound does not cut out (FR5.2).
      onProbe(null);
      lastProbeRef.current = null;
    }
  };

  // Moves towards the requested view; called again when a transition ends in
  // case the request changed meanwhile.
  const advanceRef = useRef<() => void>(() => {});
  advanceRef.current = () => {
    const current = modeRef.current;
    const target = targetRef.current;
    const instant = lite;
    if (target === "map" && current === "globe") {
      setMode("to-map");
      const cameraZ = mapCameraZ(data.bbox, CAMERA_FOV, size.width / size.height);
      cancelRef.current = playFocus(view.current, { bbox: data.bbox, cameraZ }, {
        instant,
        onComplete: () => {
          setMode("map");
          advanceRef.current();
        },
      });
    } else if (target === "globe" && current === "map") {
      setMode("to-globe");
      cancelRef.current = playReturn(view.current, {
        instant,
        onComplete: () => {
          setMode("globe");
          advanceRef.current();
        },
      });
    }
  };
  useEffect(() => {
    advanceRef.current();
  }, [targetView]);
  useEffect(() => () => cancelRef.current?.(), []);

  useFrame(() => {
    const state = view.current;
    if (modeRef.current === "map") {
      // Keep the Amazon framed if the window is resized while on the map.
      state.cameraZ = mapCameraZ(data.bbox, CAMERA_FOV, size.width / size.height);
    }
    camera.position.set(0, 0, state.cameraZ);
    camera.lookAt(0, 0, 0);
  });

  const handleHover = useCallback(
    (hit: GlobeHit | null) => {
      // While the view changes, keep the last point (and the sound) as it is.
      if (modeRef.current === "to-map" || modeRef.current === "to-globe") return;
      lastHitRef.current = hit;
      if (!hit) {
        setListeningPoint(null);
        lastProbeRef.current = null;
        onProbe(null);
        return;
      }
      const rect = gl.domElement.getBoundingClientRect();
      setListeningPoint({ lon: hit.lon, lat: hit.lat, screenX: screenX01(hit.clientX, rect.left, rect.width) });
      const value = sampleLayerAt(activeLayer, data.bbox, hit.lon, hit.lat, FIRST_INSTANT);
      // The cursor may rest while the point is looked up again; do not repaint for the same reading.
      const last = lastProbeRef.current;
      if (last && last.lon === hit.lon && last.lat === hit.lat && last.value === value) return;
      const probe = { lon: hit.lon, lat: hit.lat, value };
      lastProbeRef.current = probe;
      onProbe(probe);
    },
    [gl, activeLayer, data.bbox, setListeningPoint, onProbe],
  );

  // A new layer changes the reading under a cursor that has not moved.
  useEffect(() => {
    lastProbeRef.current = null;
    const hit = lastHitRef.current;
    if (hit) handleHover(hit);
  }, [handleHover]);

  const handleGlobeClick = useCallback(
    (lon: number, lat: number) => {
      if (isInsideBbox(lon, lat, data.bbox)) onRequestView("map");
    },
    [data.bbox, onRequestView],
  );

  return (
    <>
      <EarthMesh
        baseTexture={baseTexture}
        regionBaseTexture={regionBaseTexture}
        layerTextures={layer.textures}
        bbox={data.bbox}
        view={view}
        mode={mode}
        segments={lite ? LITE_SEGMENTS : FULL_SEGMENTS}
        onHover={handleHover}
        onGlobeClick={handleGlobeClick}
      />
      <FpsProbe onFps={onFps} />
    </>
  );
}

function EarthSceneView(props: EarthSceneProps) {
  // Read outside the Canvas and passed in, so no context has to cross the renderer.
  const setListeningPoint = useSetListeningPoint();
  return (
    <Canvas
      data-testid="planet-canvas"
      camera={{ fov: CAMERA_FOV, position: [0, 0, GLOBE_CAMERA_Z], near: 0.01, far: 100 }}
      dpr={props.lite ? 1 : [1, 2]}
      gl={{ antialias: !props.lite }}
      fallback={
        <p role="alert" data-testid="planet-webgl-error" className="p-8 text-red-200">
          This browser cannot draw the 3D planet (WebGL is not available).
        </p>
      }
    >
      <SceneContents {...props} setListeningPoint={setListeningPoint} />
    </Canvas>
  );
}

export const EarthScene = memo(EarthSceneView);
