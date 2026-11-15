// Timeline bar (plan Step 13, FR7): play and pause the sequence, move through
// it, change its speed, and read the date each changing layer is at. It only
// shows and changes the shared clock of TimelineProvider; it owns no clock.
//
// Same look as the HUD: the green button of the bottom-right panel, slate text,
// mono numbers like the place indicator, and sliders in the app's green.

import type { LoadedLayer } from "../data/types";
import { MAX_SPEED, MIN_SPEED } from "../lib/playback";
import { dateLabelAt } from "../lib/timeline";
import {
  SCRUB_STEP,
  SPEED_STEP,
  formatElapsed,
  formatPercent,
  formatSpeed,
  scrubValueText,
  timedLayers,
} from "./timelineFormat";

export interface TimelineBarProps {
  position: number;
  playing: boolean;
  speed: number;
  durationSeconds: number;
  /** Every layer; the bar shows the date of the ones that change over time. */
  layers: LoadedLayer[];
  onSeek: (position: number) => void;
  onToggle: () => void;
  onSpeed: (speed: number) => void;
  className?: string;
}

const button =
  "rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400";
const slider = "w-full cursor-pointer accent-emerald-600 [color-scheme:dark]";

export function TimelineBar(props: TimelineBarProps) {
  const { position, playing, speed, durationSeconds, layers, onSeek, onToggle, onSpeed, className = "" } = props;
  const dated = timedLayers(layers);

  return (
    <div data-testid="timeline-bar" className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <button type="button" data-testid="timeline-play" className={button} aria-pressed={playing} onClick={onToggle}>
          {playing ? "Pause" : "Play"}
        </button>
        <p className="font-mono text-xs text-slate-400" data-testid="timeline-elapsed">
          {formatElapsed(position, durationSeconds, speed)}
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-slate-300">
          Time <span className="font-mono text-xs text-slate-400">{formatPercent(position)}</span>
        </span>
        <input
          type="range"
          data-testid="timeline-scrub"
          className={slider}
          min={0}
          max={1}
          step={SCRUB_STEP}
          value={position}
          aria-valuetext={scrubValueText(position)}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-slate-300">
          Speed <span className="font-mono text-xs text-slate-400">{formatSpeed(speed)}</span>
        </span>
        <input
          type="range"
          data-testid="timeline-speed"
          className={slider}
          min={MIN_SPEED}
          max={MAX_SPEED}
          step={SPEED_STEP}
          value={speed}
          aria-valuetext={`${formatSpeed(speed)} speed`}
          onChange={(event) => onSpeed(Number(event.target.value))}
        />
      </label>

      {dated.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Date of each layer">
          {dated.map(({ manifest }) => (
            <li key={manifest.id} data-testid={`timeline-date-${manifest.id}`}>
              <span className="text-slate-300">{manifest.title}</span>
              <span className="block font-mono text-xs text-slate-400">{dateLabelAt(manifest, position)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
