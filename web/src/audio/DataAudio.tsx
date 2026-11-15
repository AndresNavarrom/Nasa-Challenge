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
import { OVERVIEW_INSTRUMENTS, buildOverviewColumns, type VisibleField } from "./overview";
import { TEMPO_BEATS_PER_FRAME, tempoIndex, tempoStep } from "./tempo";

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
  const tempoRef = useRef<{ layerId: string; index: number; position: number } | null>(null);

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

  // A data-time mark for each layer unit. It follows the shared timeline, so it
  // pauses with Auto-rotate and accelerates with the timeline speed. A seek
  // that jumps several units is ignored instead of firing a burst.
  useEffect(() => {
    const beats = activeLayer ? TEMPO_BEATS_PER_FRAME[activeLayer.manifest.id] : undefined;
    const step =
      activeLayer && mode === "globe"
        ? tempoStep(activeLayer.region.frames, beats)
        : null;
    if (!activeLayer || step === null) {
      tempoRef.current = null;
      return;
    }
    const index = tempoIndex(position, step);
    const previous = tempoRef.current;
    if (
      previous &&
      previous.layerId === activeLayer.manifest.id &&
      position >= previous.position &&
      index > previous.index
    ) {
      const crossed = index - previous.index;
      if (crossed <= 2) engine.playTempoBeat(activeLayer.manifest.id);
    }
    tempoRef.current = {
      layerId: activeLayer.manifest.id,
      index,
      position,
    };
  }, [engine, activeLayer, position, mode]);

  // Forest gets a sparse bird ambience over the overview field. It belongs to
  // the planet view; the region map keeps the focused point voice.
  useEffect(() => {
    const forestOverview =
      (mode === "globe" || mode === "to-globe") && activeLayer?.manifest.id === "forest";
    engine.setForestBirds(forestOverview);
    return () => engine.setForestBirds(false);
  }, [engine, mode, activeLayer]);

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
      const columns = buildOverviewColumns(
        field,
        (lon, lat) => sampleLayerAt(activeLayer, data.bbox, lon, lat, frame),
        OVERVIEW_INSTRUMENTS[activeLayer.manifest.id].scale,
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
