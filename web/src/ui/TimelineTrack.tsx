// The timeline of the picked layer. One mark per instant, placed by its real time
// (an hour of smoke, a month of lightning), with the day or year written at the
// marks that start one. The playhead shows the instant on screen and heard; it
// moves by itself at the pace of the planet's turn and keeps going on the map
// view, during a drag and with Auto-rotate off. Only the pause button stops it.
//
// On the arcs of the HUD (ui/arcLayout.ts) the line lies along the right arc,
// first instant at the bottom, and its controls sit in a small panel of the
// right column. On a small view the line lies flat under the controls. Either
// way the panel folds away, leaving only the date.
//
// The person can drag along the line or click it to pick a moment; the planet
// keeps turning and the timeline goes on from there. Arrow keys move one instant,
// Page Up / Page Down one turn (a day or a year), Home / End to the ends.
//
// A speed slider (4×–32×, starting at 4×) makes each turn cover more real
// time; the planet keeps its pace, and the panel says how much one turn
// covers ("1 turn = 4 days").
//
// A static layer (forest) shows the same line dimmed, with its one period.
// It only shows and changes the shared clock of TimelineProvider; it owns no clock.

import { useMemo, useRef, useState, type HTMLAttributes, type KeyboardEvent, type PointerEvent } from "react";
import type { LoadedLayer } from "../data/types";
import { dateLabelAt, frameIndexAt } from "../lib/timeline";
import {
  cadenceText,
  fractionAtPosition,
  framesPerTurn,
  positionAtFraction,
  positionOfFrame,
  timelineTicks,
  turnText,
  TIMELINE_MAX_SPEED,
  TIMELINE_MIN_SPEED,
  TIMELINE_SPEED_STEP,
} from "../lib/timelineTrack";
import {
  arcAngleAt,
  arcAngleOfFraction,
  arcFractionOfAngle,
  arcPath,
  arcPoint,
  type ArcFrame,
} from "./arcLayout";
import { ChevronIcon, PauseIcon, PlayIcon } from "./icons";
import { isTimed, trackValueText } from "./timelineFormat";

export interface TimelineTrackProps {
  /** The picked layer; a static one draws the dimmed line. */
  layer: LoadedLayer;
  position: number;
  /** True while the timeline plays; only the person pauses it. */
  playing: boolean;
  onTogglePlay: () => void;
  onSeek: (position: number) => void;
  /** Timeline speed: how many times the normal real time one turn covers. */
  speed: number;
  onSpeed: (speed: number) => void;
  /** The circle of the HUD's arcs: the line lies along the right one. Without it the line lies flat. */
  arc?: ArcFrame | null;
  /** Colour of the playhead and the part already played (the layer's contrast colour). */
  color?: string;
  className?: string;
}

/** Where the line lies on the right arc: the first instant below the middle, the last one above. */
export const TIMELINE_START_DEGREES = 7;
export const TIMELINE_END_DEGREES = -32;
/** Year or day labels closer than this along the arc are left out, in pixels. */
const MIN_LABEL_GAP = 13;

/** What the flat line and the arc line share as a slider: its name, its value, the pointer and the keys. */
type SliderProps = HTMLAttributes<Element>;

const panel =
  "pointer-events-auto rounded-lg border border-landing-line bg-landing-deep/80 px-3 py-2 text-sm text-landing-ink shadow-lg backdrop-blur";
const DEFAULT_COLOR = "#5ee9b5";

export function TimelineTrack(props: TimelineTrackProps) {
  const { layer, position, playing, onTogglePlay, onSeek, speed, onSpeed, arc = null, color = DEFAULT_COLOR, className = "" } = props;
  const { manifest } = layer;
  const timed = isTimed(layer);
  const frames = manifest.dates.length;
  const ticks = useMemo(() => (timed ? timelineTicks(manifest) : []), [manifest, timed]);
  const lineRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  const date = dateLabelAt(manifest, position);
  const head = timed ? fractionAtPosition(manifest, position) : 0;

  /** The place on the line (0..1) under a pointer, on the arc or on the flat line. */
  const fractionAt = (clientX: number, clientY: number): number | null => {
    if (arc) {
      return arcFractionOfAngle(TIMELINE_START_DEGREES, TIMELINE_END_DEGREES, arcAngleAt(arc, "right", clientX, clientY));
    }
    const box = lineRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return null;
    return (clientX - box.left) / box.width;
  };
  const seekAt = (clientX: number, clientY: number): void => {
    const fraction = fractionAt(clientX, clientY);
    if (fraction !== null) onSeek(positionAtFraction(manifest, fraction));
  };

  const onPointerDown = (event: PointerEvent<Element>): void => {
    if (!timed) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekAt(event.clientX, event.clientY);
  };
  const onPointerMove = (event: PointerEvent<Element>): void => {
    if (timed && event.currentTarget.hasPointerCapture(event.pointerId)) seekAt(event.clientX, event.clientY);
  };

  const onKeyDown = (event: KeyboardEvent<Element>): void => {
    if (!timed) return;
    const frame = frameIndexAt(position, frames);
    const turn = Math.max(1, Math.round(framesPerTurn(manifest.cadence, frames)));
    const targets: Record<string, number> = {
      ArrowLeft: frame - 1,
      ArrowDown: frame - 1,
      ArrowRight: frame + 1,
      ArrowUp: frame + 1,
      PageDown: frame - turn,
      PageUp: frame + turn,
      Home: 0,
      End: frames - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    onSeek(positionOfFrame(Math.min(frames - 1, Math.max(0, target)), frames));
  };

  /** What both lines share as a slider: its name, its value and the keys. */
  const slider: SliderProps = {
    role: "slider",
    tabIndex: timed ? 0 : -1,
    "aria-label": `${manifest.title} timeline`,
    "aria-disabled": !timed,
    "aria-valuemin": 1,
    "aria-valuemax": Math.max(1, frames),
    "aria-valuenow": timed ? frameIndexAt(position, frames) + 1 : 1,
    "aria-valuetext": trackValueText(layer, position),
    onPointerDown,
    onPointerMove,
    onKeyDown,
  };

  const fold = (
    <button
      type="button"
      data-testid="timeline-fold"
      aria-expanded={open}
      aria-label={open ? "Fold the timeline" : "Show the timeline"}
      title={open ? "Fold the timeline" : "Show the timeline"}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-landing-line text-landing-mist hover:border-landing-label hover:text-landing-ink"
      onClick={() => setOpen((current) => !current)}
    >
      <ChevronIcon open={open} />
    </button>
  );

  const dateText = (
    <span data-testid={`timeline-date-${manifest.id}`} className="font-mono text-landing-ink">
      {date}
    </span>
  );

  const playButton = timed ? (
    <button
      type="button"
      data-testid="timeline-play"
      aria-pressed={!playing}
      aria-label={playing ? "Pause the timeline" : "Play the timeline"}
      className="flex items-center gap-1 rounded-full border border-landing-line px-2 py-0.5 text-xs text-landing-mist hover:border-landing-label hover:text-landing-ink"
      onClick={onTogglePlay}
    >
      {playing ? <PauseIcon /> : <PlayIcon />}
      {playing ? "Pause" : "Play"}
    </button>
  ) : (
    <span data-testid="timeline-playing" className="text-xs text-landing-label">
      fixed layer
    </span>
  );

  const speedControl = timed && (
    <label className="flex min-w-0 items-center gap-2 text-xs">
      <span className="text-landing-label">Speed</span>
      <input
        type="range"
        data-testid="timeline-speed"
        className="min-w-0 flex-1 [color-scheme:dark]"
        style={{ accentColor: color }}
        min={TIMELINE_MIN_SPEED}
        max={TIMELINE_MAX_SPEED}
        step={TIMELINE_SPEED_STEP}
        value={speed}
        aria-label="Timeline speed"
        aria-valuetext={`${speed} times`}
        onChange={(event) => onSpeed(Number(event.target.value))}
      />
      <span className="font-mono text-landing-ink">{speed}×</span>
    </label>
  );

  const turn = timed && manifest.cadence && (
    <span data-testid="timeline-turn" className="text-xs text-landing-label">
      1 turn = {turnText(manifest.cadence, speed)}
    </span>
  );

  if (arc) {
    return (
      <>
        <div data-testid="timeline-track" className={`${panel} flex flex-col gap-1.5 ${className}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-label text-[10px] uppercase tracking-[0.18em] text-landing-label">Time</span>
            {fold}
          </div>
          <div className="text-xs">{dateText}</div>
          {open && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                {timed && manifest.cadence && <span className="text-xs text-landing-label">{cadenceText(manifest.cadence)}</span>}
                {playButton}
              </div>
              {speedControl}
              {turn}
            </>
          )}
        </div>
        {open && (
          <ArcLine arc={arc} color={color} timed={timed} head={head} ticks={ticks} period={manifest.dates[0] ?? ""} slider={slider} />
        )}
      </>
    );
  }

  return (
    <div data-testid="timeline-track" className={`${panel} flex flex-col gap-1 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs">
        <span className="text-landing-mist">
          {manifest.title}
          {timed && manifest.cadence && <span className="text-landing-label"> · {cadenceText(manifest.cadence)}</span>}
        </span>
        {dateText}
        <span className="flex items-center gap-2">
          {playButton}
          {fold}
        </span>
      </div>

      {open && timed && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex-1">{speedControl}</div>
          {turn}
        </div>
      )}

      {open && (
        <div
          ref={lineRef}
          data-testid="timeline-scrub"
          {...slider}
          className={`relative h-9 select-none rounded outline-none focus-visible:ring-2 focus-visible:ring-landing-accent ${
            timed ? "cursor-pointer touch-none" : "opacity-50"
          }`}
        >
          <div className="absolute inset-x-0 top-3 h-px bg-landing-label/60" />
          {timed ? (
            <>
              <div
                className="absolute left-0 top-[11px] h-[3px] rounded opacity-70"
                style={{ width: `${head * 100}%`, backgroundColor: color }}
              />
              {ticks.map((tick, index) => (
                <div
                  key={index}
                  className={`absolute w-px ${tick.major ? "top-1 h-4 bg-landing-mist" : "top-2 h-2 bg-landing-label/50"}`}
                  style={{ left: `${tick.fraction * 100}%` }}
                />
              ))}
              {ticks.map((tick, index) =>
                tick.major ? (
                  <span
                    key={`label-${index}`}
                    className={`absolute top-5 whitespace-nowrap text-[10px] text-landing-label ${
                      tick.fraction > 0.97 ? "-translate-x-full" : ""
                    }`}
                    style={{ left: `${tick.fraction * 100}%` }}
                  >
                    {tick.label}
                  </span>
                ) : null,
              )}
              <div
                className="absolute top-0.5 h-5 w-1.5 -translate-x-1/2 rounded-full shadow"
                style={{ left: `${head * 100}%`, backgroundColor: color }}
              />
            </>
          ) : (
            <>
              <div className="absolute inset-x-0 top-2 h-2 rounded bg-landing-label/40" />
              <span className="absolute inset-x-0 top-5 text-center text-[10px] text-landing-label">{manifest.dates[0]}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface ArcLineProps {
  arc: ArcFrame;
  color: string;
  timed: boolean;
  /** Playhead place on the line, 0..1. */
  head: number;
  ticks: ReturnType<typeof timelineTicks>;
  /** The one period of a static layer. */
  period: string;
  slider: SliderProps;
}

/**
 * The line along the right arc, drawn over the whole view (so it must not sit
 * inside a blurred panel, which would move it): marks towards the planet, the
 * part already played and the playhead in the layer's colour.
 */
function ArcLine({ arc, color, timed, head, ticks, period, slider }: ArcLineProps) {
  const angleOf = (fraction: number): number => arcAngleOfFraction(TIMELINE_START_DEGREES, TIMELINE_END_DEGREES, fraction);

  const marks = useMemo(() => {
    const line = (fraction: number, length: number): string => {
      const degrees = arcAngleOfFraction(TIMELINE_START_DEGREES, TIMELINE_END_DEGREES, fraction);
      const from = arcPoint(arc, "right", degrees);
      const to = arcPoint(arc, "right", degrees, -length);
      return `M${from.x.toFixed(1)} ${from.y.toFixed(1)}L${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    };
    const minor = ticks.filter((tick) => !tick.major).map((tick) => line(tick.fraction, 6)).join("");
    const major = ticks.filter((tick) => tick.major).map((tick) => line(tick.fraction, 12)).join("");
    // Labels too close to the one before along the arc are left out.
    const length = (Math.abs(TIMELINE_END_DEGREES - TIMELINE_START_DEGREES) * Math.PI * arc.radius) / 180;
    const labels: { x: number; y: number; text: string }[] = [];
    let last = Number.NEGATIVE_INFINITY;
    for (const tick of ticks) {
      if (!tick.major || !tick.label) continue;
      if ((tick.fraction - last) * length < MIN_LABEL_GAP) continue;
      last = tick.fraction;
      const point = arcPoint(arc, "right", arcAngleOfFraction(TIMELINE_START_DEGREES, TIMELINE_END_DEGREES, tick.fraction), -17);
      labels.push({ x: point.x, y: point.y, text: tick.label });
    }
    return { minor, major, labels };
  }, [arc, ticks]);

  const headPoint = arcPoint(arc, "right", angleOf(head));
  const middle = arcPoint(arc, "right", angleOf(0.5), -14);

  return (
    <svg className="pointer-events-none fixed inset-0 h-full w-full" data-testid="timeline-arc">
      <g
        data-testid="timeline-scrub"
        {...slider}
        className={`outline-none ${timed ? "cursor-pointer touch-none [&:focus-visible_.timeline-head]:stroke-[#ffd166]" : "opacity-50"}`}
        pointerEvents={timed ? "stroke" : "none"}
      >
        {/* A wide dark band along the arc: the line is easy to grab and its marks read over a bright map. */}
        <path
          d={arcPath(arc, "right", TIMELINE_START_DEGREES - 1.2, TIMELINE_END_DEGREES + 1.2, -7)}
          fill="none"
          stroke="#05070d"
          strokeOpacity="0.5"
          strokeWidth="34"
          strokeLinecap="round"
        />
        <path
          d={arcPath(arc, "right", TIMELINE_START_DEGREES, TIMELINE_END_DEGREES)}
          fill="none"
          stroke="#9aa8be"
          strokeOpacity={timed ? 0.55 : 0.8}
          strokeWidth={timed ? 1 : 5}
          strokeLinecap="round"
        />
        {timed ? (
          <>
            <path d={marks.minor} stroke="#8fa0b8" strokeOpacity="0.55" strokeWidth="1" />
            <path d={marks.major} stroke="#e8edf5" strokeOpacity="0.85" strokeWidth="1" />
            {marks.labels.map((label, index) => (
              <text
                key={index}
                x={label.x}
                y={label.y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="10"
                fill="#9aa8be"
                stroke="#05070d"
                strokeOpacity="0.8"
                strokeWidth="3"
                paintOrder="stroke"
                pointerEvents="none"
              >
                {label.text}
              </text>
            ))}
            {head > 0 && (
              <path
                d={arcPath(arc, "right", TIMELINE_START_DEGREES, angleOf(head))}
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}
            <circle
              className="timeline-head"
              cx={headPoint.x}
              cy={headPoint.y}
              r="6.500"
              fill={color}
              stroke="#05070d"
              strokeWidth="2"
            />
          </>
        ) : (
          <text
            x={middle.x}
            y={middle.y}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="10"
            fill="#9aa8be"
            stroke="#05070d"
            strokeOpacity="0.8"
            strokeWidth="3"
            paintOrder="stroke"
          >
            {period}
          </text>
        )}
      </g>
    </svg>
  );
}
