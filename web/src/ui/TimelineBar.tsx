// Timeline bar (plan Step 13, FR7). The timeline is static: it never moves by
// itself. The person picks the moment with the Time slider and it stays there;
// the bar also shows the date each changing layer is at. It only shows and
// changes the shared clock of TimelineProvider; it owns no clock.
//
// Same look as the HUD: slate text, mono numbers like the place indicator, and
// the slider in the app's green.

import type { LoadedLayer } from "../data/types";
import { dateLabelAt } from "../lib/timeline";
import { SCRUB_STEP, formatPercent, scrubValueText, timedLayers } from "./timelineFormat";

export interface TimelineBarProps {
  position: number;
  /** Every layer; the bar shows the date of the ones that change over time. */
  layers: LoadedLayer[];
  onSeek: (position: number) => void;
  className?: string;
}

const slider = "w-full cursor-pointer accent-emerald-600 [color-scheme:dark]";

export function TimelineBar(props: TimelineBarProps) {
  const { position, layers, onSeek, className = "" } = props;
  const dated = timedLayers(layers);

  return (
    <div data-testid="timeline-bar" className={`flex flex-col gap-2 ${className}`}>
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
