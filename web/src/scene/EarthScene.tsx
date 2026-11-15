// The 3D view: canvas, camera, the planet mesh, the click on the Amazon
// (FR2.1), the listening point under the cursor (FR4.3) and the active layer's
// value there (FR4.4). The base image is earth-8k.jpg when the graphics card
// accepts 8192-pixel textures and earth-4k.jpg otherwise, plus the Amazon crop
// earth-amazon.jpg (FR1.2, FR1.3). Lite mode (`?lite=1`, plan B) always uses
// earth-4k.jpg, fewer segments, no antialiasing and switches views at once.
// The forest layer is drawn from the GEDI height images forest-height-8k.png
// (or -4k.png, same rule as the base image) and forest-height-amazon.png, and
// lightning from the dots image lightning-4k.png (one size: 4096 pixels fit every
// card); the sound and the probe keep reading the grids.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RedFormat,
  RepeatWrapping,
  TextureLoader,
  type Texture,
  type WebGLRenderer,
} from "three";
import type { JukeboxData, LoadedLayer } from "../data/types";
import type { SceneDefinition } from "../scenes/types";
import { sceneMapPosition } from "../scenes/geometry";
import { sampleLayerAt } from "../lib/interpolate";
import { FOREST_HEIGHT_IMAGES, REGION_BASE_IMAGE, REGION_FOREST_HEIGHT_IMAGE, pickBaseImage, pickImage } from "./baseImage";
import { dotImageFor } from "./dotImage";
import { EarthMesh, type DotImage, type GlobeHit, type ReliefImages } from "./EarthMesh";
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
import { GLOBE_RADIUS, isInsideBbox, screenX01 } from "./geo";
import { FIRST_INSTANT, disposeLayerTextures, layerTextureFor, rampFor, type LayerTextures } from "./layerTexture";
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
  /** null: the plain Earth, no layer drawn. */
  activeLayer: LoadedLayer | null;
  targetView: TargetView;
  lite: boolean;
  onRequestView: (view: TargetView) => void;
  onModeChange: (mode: ViewMode) => void;
  onProbe: (probe: Probe | null) => void;
  onFps: (fps: number) => void;
  /** A problem that leaves the view usable (for example a base image missing). */
  onSceneError: (message: string | null) => void;
  /** Clickable scene points on the Amazon map. */
  scenes?: SceneDefinition[];
  onSceneSelect?: (scene: SceneDefinition) => void;
  /** Scene whose popup is open; the map zooms towards its point. */
  focusedScene?: SceneDefinition | null;
}

const CAMERA_FOV = 45;
/** The layer drawn from the sharp GEDI height images (forest-height-*.png). */
const SHARP_RELIEF_LAYER = "forest";
/** The layer drawn from the sharp dots image (lightning-4k.png). */
const DOT_IMAGE_LAYER = "lightning";
/** Largest anisotropic filtering used on those images. */
const MAX_ANISOTROPY = 8;
// Dense enough for the raised forest relief to show its shape (about 0.7 degrees per vertex).
const FULL_SEGMENTS = { width: 512, height: 256 };
const LITE_SEGMENTS = { width: 64, height: 32 };

function emptyLayerTextures(): LayerTextures {
  const region = new DataTexture(new Uint8Array(4), 1, 1);
  region.needsUpdate = true;
  return { global: null, region, heightGlobal: null, heightRegion: null, opacity: 0.8, baseDim: 0 };
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
 * A success (or a new URL) clears the message, so a fixed image stops the banner.
 * A null URL loads nothing. `configure` runs on the texture before it is first
 * drawn (filters, format), so it applies to the first upload to the GPU.
 */
function useImageTexture(
  url: string | null,
  failureMessage: string,
  onError: (message: string | null) => void,
  configure?: (texture: Texture) => void,
): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const messageRef = useRef(failureMessage);
  messageRef.current = failureMessage;
  const configureRef = useRef(configure);
  configureRef.current = configure;

  useEffect(() => {
    onErrorRef.current(null);
    if (url === null) return;
    let cancelled = false;
    let loaded: Texture | null = null;
    new TextureLoader().load(
      url,
      (result) => {
        if (cancelled) {
          result.dispose();
          return;
        }
        configureRef.current?.(result);
        loaded = result;
        setTexture(loaded);
        onErrorRef.current(null);
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

/**
 * A greyscale image (forest height, lightning dots) as a one-channel texture (R8:
 * a quarter of the memory of RGBA), north row first like the grids, with mipmaps
 * so the planet does not shimmer when the image is drawn much smaller than its
 * size and so the shader can read mean values per vertex, per shading step or for
 * the glow around the lightning dots.
 */
function configureGreyImage(texture: Texture, wrapAround: boolean, anisotropy: number): void {
  texture.format = RedFormat;
  texture.colorSpace = NoColorSpace; // heights, not colours: no conversion on upload
  texture.flipY = false;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = wrapAround ? RepeatWrapping : ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
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
  const {
    data,
    activeLayer,
    targetView,
    lite,
    onRequestView,
    onModeChange,
    onProbe,
    onFps,
    onSceneError,
    scenes,
    onSceneSelect,
    focusedScene,
    setListeningPoint,
  } = props;
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);

  const view = useRef<ViewState>(createViewState());
  const [mode, setModeState] = useState<ViewMode>("globe");
  const modeRef = useRef<ViewMode>("globe");
  const targetRef = useRef<TargetView>(targetView);
  targetRef.current = targetView;
  const cancelRef = useRef<CancelTransition | null>(null);
  const focusRef = useRef({ x: 0, y: 0, zoom: 0 });
  const lastHitRef = useRef<GlobeHit | null>(null);
  const lastProbeRef = useRef<Probe | null>(null);
  const [baseError, setBaseError] = useState<string | null>(null);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [layerError, setLayerError] = useState<string | null>(null);
  const [forestGlobalError, setForestGlobalError] = useState<string | null>(null);
  const [forestRegionError, setForestRegionError] = useState<string | null>(null);
  const [lightningError, setLightningError] = useState<string | null>(null);

  const maxTextureSize = useMemo(() => readMaxTextureSize(gl), [gl]);
  const baseUrl = `${data.baseUrl}${pickBaseImage(maxTextureSize, lite)}`;
  const baseTexture = useImageTexture(
    baseUrl,
    `The planet image (${baseUrl}) could not be loaded, so the planet is drawn without it. The layers, the map and the controls still work.`,
    setBaseError,
  );
  const regionUrl = `${data.baseUrl}${REGION_BASE_IMAGE}`;
  const regionBaseTexture = useImageTexture(
    regionUrl,
    `The detailed Amazon image (${regionUrl}) could not be loaded, so the Amazon is drawn from the planet image. Everything else still works.`,
    setRegionError,
  );

  // Sharp forest images: requested the first time the forest is chosen and then
  // kept, so switching back to it is instant. The Earth view and other layers
  // never wait for them.
  const forestActive = activeLayer?.manifest.id === SHARP_RELIEF_LAYER;
  const [forestWanted, setForestWanted] = useState(forestActive);
  useEffect(() => {
    if (forestActive) setForestWanted(true);
  }, [forestActive]);
  const anisotropy = useMemo(() => {
    try {
      return Math.max(1, Math.min(MAX_ANISOTROPY, gl.capabilities.getMaxAnisotropy()));
    } catch {
      return 1;
    }
  }, [gl]);
  const configureGlobalHeight = useCallback((texture: Texture) => configureGreyImage(texture, true, anisotropy), [anisotropy]);
  const configureRegionHeight = useCallback((texture: Texture) => configureGreyImage(texture, false, anisotropy), [anisotropy]);
  const forestGlobalUrl = forestWanted ? `${data.baseUrl}${pickImage(maxTextureSize, lite, FOREST_HEIGHT_IMAGES)}` : null;
  const forestGlobal = useImageTexture(
    forestGlobalUrl,
    `The sharp forest image (${forestGlobalUrl}) could not be loaded, so the forest is drawn from the coarser grid. Everything else still works.`,
    setForestGlobalError,
    configureGlobalHeight,
  );
  const forestRegionUrl = forestWanted ? `${data.baseUrl}${REGION_FOREST_HEIGHT_IMAGE}` : null;
  const forestRegion = useImageTexture(
    forestRegionUrl,
    `The sharp Amazon forest image (${forestRegionUrl}) could not be loaded, so the forest is drawn from the coarser grid. Everything else still works.`,
    setForestRegionError,
    configureRegionHeight,
  );
  const reliefImages = useMemo<ReliefImages | null>(
    () =>
      forestActive && forestGlobal && forestRegion
        ? { global: forestGlobal, region: forestRegion, ramp: rampFor(SHARP_RELIEF_LAYER) }
        : null,
    [forestActive, forestGlobal, forestRegion],
  );

  // Sharp lightning dots: requested the first time lightning is shown, then kept
  // (same rule as the forest images), so start-up does not wait for them.
  const lightningActive = activeLayer?.manifest.id === DOT_IMAGE_LAYER;
  const dotStyle = lightningActive ? dotImageFor(DOT_IMAGE_LAYER) : null;
  const [lightningWanted, setLightningWanted] = useState(lightningActive);
  useEffect(() => {
    if (lightningActive) setLightningWanted(true);
  }, [lightningActive]);
  const lightningFile = dotImageFor(DOT_IMAGE_LAYER)?.file ?? null;
  const lightningUrl = lightningWanted && lightningFile ? `${data.baseUrl}${lightningFile}` : null;
  const lightningTexture = useImageTexture(
    lightningUrl,
    `The sharp lightning image (${lightningUrl}) could not be loaded, so lightning is drawn from the coarser grid. Everything else still works.`,
    setLightningError,
    configureGlobalHeight,
  );
  const dotImage = useMemo<DotImage | null>(
    () => (dotStyle && lightningTexture ? { texture: lightningTexture, style: dotStyle } : null),
    [dotStyle, lightningTexture],
  );

  const layer = useMemo(() => {
    // The plain Earth view: an empty (fully transparent) layer, so only the planet shows.
    if (activeLayer === null) return { textures: emptyLayerTextures(), error: null };
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
      setLayerError(`${layer.error} The layer is not drawn.`);
    } else {
      setLayerError(null);
    }
    return () => disposeLayerTextures(layer.textures);
  }, [layer]);

  // One banner for every source: a good layer or image clears itself without
  // hiding a failure somewhere else.
  // The forest image banners only show while the forest is the layer on screen.
  const forestError = forestActive ? (forestGlobalError ?? forestRegionError) : null;
  // Likewise the lightning image banner, only while lightning is on screen.
  const lightningImageError = lightningActive ? lightningError : null;
  useEffect(() => {
    onSceneError(layerError ?? baseError ?? regionError ?? forestError ?? lightningImageError ?? null);
  }, [layerError, baseError, regionError, forestError, lightningImageError, onSceneError]);

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

  // Zoom the map towards the open scene; zoom back out when it closes.
  useEffect(() => {
    const focused = focusedScene && modeRef.current === "map";
    const target = focused ? sceneMapPosition(focusedScene, data.bbox) : { x: 0, y: 0 };
    const base = Math.max(0.01, mapCameraZ(data.bbox, CAMERA_FOV, size.width / size.height) - GLOBE_RADIUS);
    const zoom = focused ? base * 0.45 : 0;
    gsap.killTweensOf(focusRef.current);
    gsap.to(focusRef.current, {
      x: target.x,
      y: target.y,
      zoom,
      duration: 0.55,
      ease: "power2.inOut",
    });
    return () => {
      gsap.killTweensOf(focusRef.current);
    };
  }, [focusedScene, data.bbox, size.width, size.height, lite]);

  useFrame(() => {
    const state = view.current;
    const focus = focusRef.current;
    if (modeRef.current === "map") {
      // Keep the Amazon framed if the window is resized while on the map.
      state.cameraZ = mapCameraZ(data.bbox, CAMERA_FOV, size.width / size.height);
      camera.position.set(focus.x, focus.y, state.cameraZ - focus.zoom);
      camera.lookAt(focus.x, focus.y, GLOBE_RADIUS);
    } else {
      camera.position.set(0, 0, state.cameraZ);
      camera.lookAt(0, 0, 0);
    }
  });

  const probeFor = useCallback(
    (hit: GlobeHit): Probe => ({
      lon: hit.lon,
      lat: hit.lat,
      value: activeLayer ? sampleLayerAt(activeLayer, data.bbox, hit.lon, hit.lat, FIRST_INSTANT) : null,
    }),
    [activeLayer, data.bbox],
  );

  // The pointer can deliver several moves per frame; publish the latest one once.
  const pendingHover = useRef<GlobeHit | null | undefined>(undefined);
  const hoverFrame = useRef<number | null>(null);

  const publishHover = useCallback(() => {
    hoverFrame.current = null;
    const hit = pendingHover.current;
    pendingHover.current = undefined;
    if (hit === undefined) return;
    // While the view changes, keep the last point (and the sound) as it is.
    if (modeRef.current === "to-map" || modeRef.current === "to-globe") return;
    lastHitRef.current = hit;
    if (!hit) {
      lastProbeRef.current = null;
      setListeningPoint(null);
      onProbe(null);
      return;
    }
    const rect = gl.domElement.getBoundingClientRect();
    setListeningPoint({ lon: hit.lon, lat: hit.lat, screenX: screenX01(hit.clientX, rect.left, rect.width) });
    const probe = probeFor(hit);
    // The cursor may rest while the point is looked up again; do not repaint for the same reading.
    const last = lastProbeRef.current;
    if (last && last.lon === probe.lon && last.lat === probe.lat && last.value === probe.value) return;
    lastProbeRef.current = probe;
    onProbe(probe);
  }, [gl, setListeningPoint, onProbe, probeFor]);

  const handleHover = useCallback(
    (hit: GlobeHit | null) => {
      // While the view changes, keep the last point (and the sound) as it is.
      if (modeRef.current === "to-map" || modeRef.current === "to-globe") return;
      pendingHover.current = hit;
      if (hoverFrame.current === null) {
        hoverFrame.current = requestAnimationFrame(publishHover);
      }
    },
    [publishHover],
  );

  useEffect(
    () => () => {
      if (hoverFrame.current !== null) cancelAnimationFrame(hoverFrame.current);
    },
    [],
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
        raiseRelief={!lite}
        reliefImages={reliefImages}
        dotImage={dotImage}
        scenes={scenes}
        onSceneSelect={onSceneSelect}
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
