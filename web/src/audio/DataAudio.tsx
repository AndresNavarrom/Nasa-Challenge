// Bridges the scene data to the sound engine.
//
// The region map keeps the point-driven voices. The planet view uses the
// visible-area overview: the scene publishes the sampled screen field through a
// ref, and a small interval turns every column into voices for the engine. All
// pan columns sound at once; only the data frame follows the shared timeline.

import { useEffect, useRef, type RefObject } from "react";
import type { JukeboxData, LoadedLayer } from "../data/types";
import { frameIndexAt, framePosition } from "../lib/timeline";
import { useListeningPoint } from "../scene/listeningPoint";
import type { ViewMode } from "../scene/FocusTransition";
import { useTimeline } from "../timeline/TimelineProvider";
import { sampleLayerAt } from "../lib/interpolate";
import type { SoundEngine } from "./engine";
import { buildOverviewColumns, type VisibleField } from "./overview";

/** How often the visible field is turned into sounding columns. */
const OVERVIEW_UPDATE_MS = 100;

export interface DataAudioProps {
  data: JukeboxData;
  engine: SoundEngine;
  activeLayer: LoadedLayer | null;
  mode: ViewMode;
  /** Blend the two instants around the position like the picture does (off in lite mode). */
  fade: boolean;
  overviewFieldRef: RefObject<VisibleField | null>;
}

export function DataAudio({
  data,
  engine,
  activeLayer,
  mode,
  fade,
  overviewFieldRef,
}: DataAudioProps) {
  const point = useListeningPoint();
  const { position } = useTimeline();
  const positionRef = useRef(position);
  positionRef.current = position;

  // Point mode belongs to the region map. On the planet the overview field is
  // the only data voice; during a return flight the overview keeps the last
  // visible field until the globe is back.
  useEffect(() => {
    const pointActive = mode === "map" || mode === "to-map";
    if (!pointActive || !activeLayer || !point) {
      for (const layer of data.layers) engine.setLayerIntensity(layer.manifest.id, null);
      return;
    }
    for (const layer of data.layers) {
      const frame = fade
        ? framePosition(positionRef.current, layer.region.frames)
        : frameIndexAt(positionRef.current, layer.region.frames);
      engine.setLayerIntensity(
        layer.manifest.id,
        sampleLayerAt(layer, data.bbox, point.lon, point.lat, frame),
      );
    }
    engine.setPan(point.screenX);
  }, [engine, data, activeLayer, point, position, mode, fade]);

  useEffect(() => {
    const overviewActive = mode === "globe" || mode === "to-globe";
    if (!overviewActive || !activeLayer) {
      engine.setOverviewEnabled(false);
      return;
    }
    engine.setOverviewEnabled(true);
    const tick = (): void => {
      const field = overviewFieldRef.current;
      if (!field) return;
      const frame = fade
        ? framePosition(positionRef.current, activeLayer.region.frames)
        : frameIndexAt(positionRef.current, activeLayer.region.frames);
      const columns = buildOverviewColumns(field, (lon, lat) =>
        sampleLayerAt(activeLayer, data.bbox, lon, lat, frame),
      );
      engine.setOverview(activeLayer.manifest.id, columns);
    };
    tick();
    const timer = window.setInterval(tick, OVERVIEW_UPDATE_MS);
    return () => {
      window.clearInterval(timer);
      engine.setOverviewEnabled(false);
    };
  }, [engine, data.bbox, activeLayer, mode, fade, overviewFieldRef]);

  return null;
}
