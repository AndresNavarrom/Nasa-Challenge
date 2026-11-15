// The controls over the 3D view. The planet sits in the middle, framed by two
// arcs that take the contrast colour of the picked layer:
//
// - on the left arc, one round button per layer choice (the plain Earth and the
//   layers); the picked one is the only one drawn and heard (FR1.4);
// - outside it, the side controls: "Amazon" / "Back to Earth" (FR2.1, FR2.2) in
//   one button that follows the view, the "Auto-rotate" switch and the sound;
// - on the right, the frames-per-second counter (NFR1), the compass, the
//   picked layer with what its sound means and the place being read (FR4.4),
//   the timeline along the arc and the sound spectrum under it;
// - at the bottom, the indicator of the place under the cursor and one line
//   that says where you are and what you can do next.
//
// On a view too small for the arcs (a phone, a small tablet: ui/arcLayout.ts)
// the same controls stack in compact panels, the timeline lies flat and the
// compass and the spectrum are left out.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { AudioStart } from "../audio/AudioStart";
import type { SoundEngine } from "../audio/engine";
import type { ViewMode } from "../scene/FocusTransition";
import type { Probe } from "../scene/EarthScene";
import type { ViewOrientation } from "../scene/geo";
import { useListeningPoint } from "../scene/listeningPoint";
import { ArcSpectrum, SPECTRUM_MIN_FROM_DEGREES, SPECTRUM_SPAN_DEGREES, SPECTRUM_TO_DEGREES } from "./ArcSpectrum";
import { arcFrame, arcPath, arcPoint, arcVisibleDegrees, spreadAngles, type ArcFrame } from "./arcLayout";
import { Compass } from "./Compass";
import { formatLatitude, formatLayerValue, formatLongitude } from "./coordinates";
import {
  BackIcon,
  Co2Icon,
  EarthIcon,
  ForestIcon,
  LayerIcon,
  LightningIcon,
  PinIcon,
  RotateIcon,
  SmokeIcon,
} from "./icons";
import { EARTH_VIEW_ID, layerChoices, layerForChoice, type LayerChoice, type WithManifest } from "./layerChoice";
import { MAP_SOUND_NOTE, OVERVIEW_SOUND_NOTE, layerStyle } from "./layerStyle";
import { TOUR_BUTTON_TEST_ID } from "./tourSteps";

export interface PlanetHudProps {
  /** Every layer of the data file, loaded or not (the buttons list them all). */
  layers: readonly WithManifest[];
  /** The picked choice: a layer id or EARTH_VIEW_ID. */
  activeLayerId: string;
  /** True while the grids of the chosen layer are downloading (the plain Earth is drawn meanwhile). */
  loadingLayer?: boolean;
  /** Why the chosen layer could not be loaded, or null. */
  layerLoadError?: string | null;
  onSelectLayer: (layerId: string) => void;
  /** Whether the planet turns by itself on the planet view (the "Auto-rotate" switch). */
  autoRotate: boolean;
  onToggleAutoRotate: (on: boolean) => void;
  mode: ViewMode;
  onAmazon: () => void;
  onBackToEarth: () => void;
  /** Name of the region the map view visits (or is flying to). */
  regionName?: string;
  /** Name of the region under the cursor, or null. */
  hoveredRegionName?: string | null;
  probe: Probe | null;
  fps: number | null;
  lite: boolean;
  sceneError: string | null;
  /** Value of the active layer at the selected point, or null when there is no data there. */
  selectedValue?: number | null;
  /** The sound engine behind the sound button and the spectrum. */
  engine?: SoundEngine;
  /** How the planet is turned, written by the scene on every frame (the compass reads it). */
  orientation?: RefObject<ViewOrientation | null>;
  /**
   * The timeline of the picked layer. It is given the circle of the arcs (to lie
   * along the right one) or null on a small view (to lie flat), and the layer's colour.
   */
  timeline?: (arc: ArcFrame | null, color: string) => ReactNode;
  /** Shows the welcome window and guided tour again (the "?" button). */
  onShowTour?: () => void;
}

/** Below this the NFR1 target (30 frames per second) is missed. */
const FPS_TARGET = 30;

/** Degrees between two layer buttons on the left arc, and where their row is centred (a little above the middle). */
const LAYER_STEP_DEGREES = 10;
const LAYER_CENTRE_DEGREES = -6;
/** Most of the left arc the layer buttons may take, however many layers the data has. */
const LAYER_MAX_SPAN_DEGREES = 48;
/** Half the side of a round button, in pixels (h-11 = 44 px). */
const BUTTON_HALF = 22;
/** How far the arcs are drawn either side of the middle; the view cuts them before that. */
const ARC_REACH_DEGREES = 56;

export function modeLabel(mode: ViewMode, regionName = "Amazon", hoveredRegionName: string | null = null): string {
  switch (mode) {
    case "globe":
      return hoveredRegionName
        ? `${hoveredRegionName}: double-click (or tap again) to fly there.`
        : "Overview of the visible planet. Drag to turn it; double-click a region to fly there.";
    case "to-map":
      return `Flying to ${regionName}…`;
    case "map":
      return `${regionName} map. Click a point to lock its sound; drag to move it; double-click to return.`;
    case "to-globe":
      return "Back to the planet…";
  }
}

const panel =
  "pointer-events-auto rounded-lg border border-landing-line bg-landing-deep/80 p-2 text-sm shadow-lg backdrop-blur sm:p-3";
const roundButton =
  "pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-landing-deep/85 shadow-lg backdrop-blur transition-colors disabled:cursor-not-allowed disabled:opacity-45";
const eyebrow = "font-label text-[10px] uppercase tracking-[0.18em] text-landing-label";

/** The size of an element, kept up to date as the window is resized or turned. */
function useElementSize(): [(element: HTMLElement | null) => void, { width: number; height: number }] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    if (!element) return undefined;
    const update = (): void => {
      const { width, height } = element.getBoundingClientRect();
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, size];
}

function ChoiceIcon({ id }: { id: string }) {
  switch (id) {
    case EARTH_VIEW_ID:
      return <EarthIcon />;
    case "forest":
      return <ForestIcon />;
    case "smoke":
      return <SmokeIcon />;
    case "co2":
      return <Co2Icon />;
    case "lightning":
      return <LightningIcon />;
    default:
      return <LayerIcon />;
  }
}

interface LayerButtonsProps {
  choices: readonly LayerChoice[];
  activeLayerId: string;
  loadingLayer: boolean;
  onSelectLayer: (layerId: string) => void;
  /** The circle of the arcs, or null to lay the buttons in a row. */
  arc: ArcFrame | null;
}

/**
 * One round button per layer choice, as a radio group: the arrow keys move to
 * the next choice and pick it. On the arcs each button sits on the left arc
 * with its name beside it (the picked one always, the others on hover or focus).
 */
function LayerButtons({ choices, activeLayerId, loadingLayer, onSelectLayer, arc }: LayerButtonsProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (step === 0 || choices.length === 0) return;
    event.preventDefault();
    const current = Math.max(0, choices.findIndex((choice) => choice.id === activeLayerId));
    const next = choices[(current + step + choices.length) % choices.length]!;
    onSelectLayer(next.id);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-layer-choice="${next.id}"]`)?.focus();
  };

  const step = Math.min(LAYER_STEP_DEGREES, LAYER_MAX_SPAN_DEGREES / Math.max(1, choices.length - 1));
  const angles = spreadAngles(choices.length, step, LAYER_CENTRE_DEGREES);
  const points = arc ? angles.map((degrees) => arcPoint(arc, "left", degrees)) : [];
  // The group's own box, so the guided tour can frame the buttons.
  const box = arc
    ? {
        left: Math.min(...points.map((point) => point.x)) - BUTTON_HALF,
        top: Math.min(...points.map((point) => point.y)) - BUTTON_HALF,
        width: Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x)) + BUTTON_HALF * 2,
        height: Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y)) + BUTTON_HALF * 2,
      }
    : null;

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Layer"
      data-testid="planet-hud-layer-select"
      className={box ? "absolute" : "flex flex-wrap gap-2"}
      style={box ?? undefined}
      onKeyDown={onKeyDown}
    >
      {choices.map((choice, index) => {
        const style = layerStyle(choice.id, choice.label);
        const active = choice.id === activeLayerId;
        const point = points[index];
        return (
          <div
            key={choice.id}
            className={`group flex items-center gap-2 ${box ? "absolute" : ""}`}
            style={box && point ? { left: point.x - box.left - BUTTON_HALF, top: point.y - box.top - BUTTON_HALF } : undefined}
          >
            <button
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={choice.label}
              title={choice.label}
              tabIndex={active ? 0 : -1}
              data-layer-choice={choice.id}
              data-testid={`planet-hud-layer-${choice.id}`}
              className={`${roundButton} relative`}
              style={
                active
                  ? { backgroundColor: style.color, borderColor: style.color, color: "#05070d" }
                  : { borderColor: `${style.color}99`, color: style.color }
              }
              onClick={() => onSelectLayer(choice.id)}
            >
              <ChoiceIcon id={choice.id} />
              {active && loadingLayer && (
                <span
                  aria-hidden="true"
                  className="absolute -inset-1.5 animate-spin rounded-full border-2 border-transparent motion-reduce:animate-none"
                  style={{ borderTopColor: style.color }}
                />
              )}
            </button>
            {box && (
              <span
                aria-hidden="true"
                className={`pointer-events-none whitespace-nowrap rounded-full bg-landing-deep/80 px-2 py-0.5 font-label text-[11px] tracking-[0.08em] transition-opacity ${
                  active ? "opacity-100" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                }`}
                style={{ color: style.color }}
              >
                {style.short}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface SideControlsProps {
  mode: ViewMode;
  onAmazon: () => void;
  onBackToEarth: () => void;
  autoRotate: boolean;
  onToggleAutoRotate: (on: boolean) => void;
  engine?: SoundEngine;
  /** A column with the names beside the buttons (the arcs), or a row without them (small views). */
  column: boolean;
}

/** The view button ("Amazon" on the planet, "Back to Earth" on a map), the Auto-rotate switch and the sound. */
function SideControls({ mode, onAmazon, onBackToEarth, autoRotate, onToggleAutoRotate, engine, column }: SideControlsProps) {
  const onMap = mode === "map" || mode === "to-map";
  // On their own dark pill, so they stay readable over a bright map.
  const name = "rounded-full bg-landing-deep/70 px-2 py-0.5 font-label text-[11px] tracking-[0.08em] text-landing-mist";
  const neutral = "border-landing-label/60 text-landing-ink hover:border-landing-ink";
  return (
    <div className={column ? "flex flex-col items-start gap-2" : "flex items-start gap-2"}>
      <div className="flex items-center gap-2">
        {onMap ? (
          <button
            type="button"
            data-testid="planet-hud-back-button"
            aria-label="Back to Earth"
            title="Back to Earth"
            className={`${roundButton} ${neutral}`}
            disabled={mode !== "map"}
            onClick={onBackToEarth}
          >
            <BackIcon />
          </button>
        ) : (
          <button
            type="button"
            data-testid="planet-hud-amazon-button"
            aria-label="Amazon"
            title="Fly to the Amazon"
            className={`${roundButton} ${neutral}`}
            disabled={mode !== "globe"}
            onClick={onAmazon}
          >
            <PinIcon />
          </button>
        )}
        {column && (
          <span aria-hidden="true" className={name}>
            {onMap ? "Back to Earth" : "Amazon"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="planet-hud-auto-rotate"
          aria-pressed={autoRotate}
          aria-label="Auto-rotate"
          title={autoRotate ? "Stop the planet's own turn" : "Let the planet turn by itself"}
          className={`${roundButton} ${
            autoRotate
              ? "border-landing-accent text-landing-accent hover:border-landing-ink hover:text-landing-ink"
              : "border-landing-line text-landing-label hover:border-landing-label"
          }`}
          onClick={() => onToggleAutoRotate(!autoRotate)}
        >
          <RotateIcon />
        </button>
        {column && (
          <span aria-hidden="true" className={name}>
            {autoRotate ? "Auto-rotate" : "Rotation off"}
          </span>
        )}
      </div>
      <AudioStart engine={engine} variant="round" className="pointer-events-auto" />
    </div>
  );
}

function FpsChip({ fps, lite }: { fps: number | null; lite: boolean }) {
  return (
    <p
      data-testid="planet-hud-fps"
      className={`${panel} shrink-0 font-mono ${fps !== null && fps < FPS_TARGET ? "text-red-300" : "text-landing-accent"}`}
      title="Average frames per second over the last second (target: 30 or more)"
    >
      {fps === null ? "-- fps" : `${fps} fps`}
      {lite ? " · lite" : ""}
    </p>
  );
}

/** The longitude, latitude and layer value of a place, one under the other. */
function PlaceRows({
  lon,
  lat,
  value,
  layerTitle,
  valueTestId,
}: {
  lon: number;
  lat: number;
  value: number | null;
  /** null on the plain Earth: no value row. */
  layerTitle: string | null;
  valueTestId: string;
}) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 font-mono text-xs">
      <dt className="text-landing-label">Lat</dt>
      <dd className="text-right">{formatLatitude(lat)}</dd>
      <dt className="text-landing-label">Lon</dt>
      <dd className="text-right">{formatLongitude(lon)}</dd>
      {layerTitle !== null && (
        <>
          <dt className="text-landing-label">Value</dt>
          <dd className="text-right" data-testid={valueTestId} title={layerTitle}>
            {formatLayerValue(value)}
          </dd>
        </>
      )}
    </dl>
  );
}

export function PlanetHud(props: PlanetHudProps) {
  const {
    layers,
    activeLayerId,
    loadingLayer = false,
    layerLoadError = null,
    onSelectLayer,
    autoRotate,
    onToggleAutoRotate,
    mode,
    onAmazon,
    onBackToEarth,
    regionName,
    hoveredRegionName,
    probe,
    fps,
    lite,
    sceneError,
    selectedValue = null,
    engine,
    orientation,
    timeline,
    onShowTour,
  } = props;
  // null on the plain Earth view, and while the chosen layer is loading or failed.
  const activeLayer = loadingLayer || layerLoadError ? null : layerForChoice(layers, activeLayerId);
  const selectedPoint = useListeningPoint();
  const [rootRef, view] = useElementSize();
  const arc = useMemo(() => arcFrame(view.width, view.height), [view.width, view.height]);
  const choices = layerChoices(layers);
  const activeChoice = choices.find((choice) => choice.id === activeLayerId);
  const style = layerStyle(activeLayerId, activeChoice?.label);
  const layerTitle = activeLayer?.manifest.title ?? null;
  const onMap = mode === "map" || mode === "to-map";

  const title = (
    <div className="pointer-events-auto flex items-center gap-3 self-start rounded-full bg-landing-deep/70 py-1 pl-3 pr-1 backdrop-blur">
      <h1 className="font-label text-[13px] font-medium uppercase tracking-[0.22em] text-landing-ink">Earth Jukebox</h1>
      {onShowTour && (
        <button
          type="button"
          data-testid={TOUR_BUTTON_TEST_ID}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-landing-label/60 text-sm font-medium text-landing-ink hover:border-landing-ink"
          aria-label="Show the guided tour"
          title="Show the guided tour"
          onClick={onShowTour}
        >
          ?
        </button>
      )}
    </div>
  );

  const layerStatus = (
    <>
      {loadingLayer && (
        <p role="status" data-testid="planet-hud-layer-loading" className="text-xs" style={{ color: style.color }}>
          Loading the layer data…
        </p>
      )}
      {layerLoadError && (
        <p role="alert" data-testid="planet-hud-layer-error" className="max-w-xs text-xs text-red-300">
          {layerLoadError}
        </p>
      )}
    </>
  );

  const errorBanner = sceneError && (
    <p role="alert" data-testid="planet-hud-error" className={`${panel} border-amber-400 text-amber-100`}>
      {sceneError}
    </p>
  );

  const hover = (
    <div data-testid="planet-hud-probe" className={`${panel} sm:min-w-44`} aria-live="off">
      <p className={eyebrow}>Hover</p>
      {probe ? (
        <p className="mt-1 font-mono text-xs text-landing-mist">
          <span data-testid="planet-hud-probe-lon">{formatLongitude(probe.lon)}</span>
          {", "}
          <span data-testid="planet-hud-probe-lat">{formatLatitude(probe.lat)}</span>
          {activeLayer && (
            <span data-testid="planet-hud-probe-value" className="block text-landing-ink">
              {activeLayer.manifest.title}: {formatLayerValue(probe.value)}
            </span>
          )}
        </p>
      ) : (
        <p className="mt-1 font-mono text-xs text-landing-label">—</p>
      )}
    </div>
  );

  // The place the sound reads on a map: the point the person clicked.
  const selected = onMap && (
    <div data-testid="planet-hud-selected-coords">
      <p className={eyebrow}>Listening point</p>
      {selectedPoint ? (
        <div className="mt-1">
          <PlaceRows
            lon={selectedPoint.lon}
            lat={selectedPoint.lat}
            value={selectedValue}
            layerTitle={layerTitle}
            valueTestId="planet-hud-selected-value"
          />
        </div>
      ) : (
        <p className="mt-1 font-mono text-xs text-landing-mist">click the map</p>
      )}
    </div>
  );

  const status = (
    <p role="status" data-testid="planet-hud-status" className="text-landing-mist">
      {modeLabel(mode, regionName, hoveredRegionName)}
    </p>
  );

  if (!arc) {
    // Small views: compact panels, stacked; the timeline lies flat and goes last.
    return (
      <div
        ref={rootRef}
        data-testid="planet-hud"
        className="hud-safe pointer-events-none absolute inset-0 flex flex-col justify-between gap-2"
      >
        <div className="flex items-start justify-between gap-2">
          <div className={`${panel} flex min-w-0 flex-col gap-2`}>
            {title}
            <LayerButtons
              choices={choices}
              activeLayerId={activeLayerId}
              loadingLayer={loadingLayer}
              onSelectLayer={onSelectLayer}
              arc={null}
            />
            <p className="font-label text-[11px] tracking-[0.08em]" style={{ color: style.color }}>
              {activeChoice?.label ?? style.short}
            </p>
            {layerStatus}
          </div>
          <FpsChip fps={fps} lite={lite} />
        </div>

        {errorBanner && <div className="self-center">{errorBanner}</div>}

        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-2">
            <SideControls
              mode={mode}
              onAmazon={onAmazon}
              onBackToEarth={onBackToEarth}
              autoRotate={autoRotate}
              onToggleAutoRotate={onToggleAutoRotate}
              engine={engine}
              column={false}
            />
            <div className="flex flex-col items-end gap-2">
              {selected && <div className={panel}>{selected}</div>}
              {hover}
            </div>
          </div>
          {timeline && (
            <div data-testid="planet-hud-timeline" className="w-full">
              {timeline(null, style.color)}
            </div>
          )}
          <div className="text-center text-xs max-sm:sr-only [@media(max-height:480px)]:sr-only">{status}</div>
        </div>
      </div>
    );
  }

  // The spectrum takes the lower part of the right arc, as far down as the view shows it.
  const spectrumTo = Math.min(SPECTRUM_TO_DEGREES, arcVisibleDegrees(arc, 28));
  const spectrumSpan = Math.min(SPECTRUM_SPAN_DEGREES, spectrumTo - SPECTRUM_MIN_FROM_DEGREES);

  // Room outside each arc at its middle, for the panels of the right column.
  const sideSpace = arc.cx - arc.radius;
  const columnWidth = Math.min(240, Math.max(132, sideSpace - 36));

  return (
    <div ref={rootRef} data-testid="planet-hud" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" data-testid="planet-hud-arcs">
        {(["left", "right"] as const).map((side) => (
          <g key={side} fill="none">
            <path
              d={arcPath(arc, side, -ARC_REACH_DEGREES, ARC_REACH_DEGREES, 9)}
              stroke="#e8edf5"
              strokeOpacity="0.1"
              strokeWidth="1"
            />
            {/* A dark line under the coloured one, so the arc reads over a bright map too. */}
            <path
              d={arcPath(arc, side, -ARC_REACH_DEGREES, ARC_REACH_DEGREES)}
              stroke="#05070d"
              strokeOpacity="0.55"
              strokeWidth="5"
            />
            <path
              d={arcPath(arc, side, -ARC_REACH_DEGREES, ARC_REACH_DEGREES)}
              stroke={style.color}
              strokeOpacity="0.85"
              strokeWidth="1.500"
              className="transition-[stroke] duration-300"
            />
          </g>
        ))}
      </svg>

      <LayerButtons
        choices={choices}
        activeLayerId={activeLayerId}
        loadingLayer={loadingLayer}
        onSelectLayer={onSelectLayer}
        arc={arc}
      />

      <div className="absolute left-4 top-4 flex max-w-xs flex-col gap-2">
        {title}
        {layerStatus}
      </div>

      <div className="absolute bottom-4 left-4 flex flex-col items-start gap-3">
        <SideControls
          mode={mode}
          onAmazon={onAmazon}
          onBackToEarth={onBackToEarth}
          autoRotate={autoRotate}
          onToggleAutoRotate={onToggleAutoRotate}
          engine={engine}
          column
        />
        {hover}
      </div>

      <div className="absolute right-4 top-4 flex flex-col items-end gap-3">
        <FpsChip fps={fps} lite={lite} />
        {orientation && <Compass orientation={orientation} color={style.color} />}
        <div data-testid="planet-hud-layer-info" className={`${panel} flex flex-col gap-2`} style={{ width: columnWidth }}>
          <div>
            <p className={eyebrow}>Layer</p>
            <p className="mt-0.5 flex items-center gap-2 font-medium">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: style.color }} />
              {activeChoice?.label ?? style.short}
            </p>
          </div>
          <p data-testid="planet-hud-sound-note" className="text-xs leading-snug text-landing-mist">
            {style.sound}
            {activeLayer && <span className="mt-1 block text-landing-label">{onMap ? MAP_SOUND_NOTE : OVERVIEW_SOUND_NOTE}</span>}
          </p>
          {selected ? (
            selected
          ) : (
            <div>
              <p className={eyebrow}>Cursor</p>
              {probe ? (
                <div className="mt-1">
                  <PlaceRows
                    lon={probe.lon}
                    lat={probe.lat}
                    value={probe.value}
                    layerTitle={layerTitle}
                    valueTestId="planet-hud-cursor-value"
                  />
                </div>
              ) : (
                <p className="mt-1 font-mono text-xs text-landing-label">move over the planet</p>
              )}
            </div>
          )}
        </div>
        {timeline && (
          <div data-testid="planet-hud-timeline" style={{ width: columnWidth }}>
            {timeline(arc, style.color)}
          </div>
        )}
      </div>

      {engine && <ArcSpectrum engine={engine} arc={arc} color={style.color} fromDegrees={spectrumTo - spectrumSpan} toDegrees={spectrumTo} />}

      {errorBanner && <div className="absolute left-1/2 top-4 max-w-md -translate-x-1/2">{errorBanner}</div>}

      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-landing-deep/70 px-4 py-1 text-center text-xs backdrop-blur"
        style={{ maxWidth: Math.max(240, arc.radius * 1.3) }}
      >
        {status}
      </div>
    </div>
  );
}
