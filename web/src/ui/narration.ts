// What the narrator says (narrator.ts speaks it): short sentences about the
// layer, the view, the place and the date, kept free of React and of the
// browser's speech API so they can be tested in Node.
//
// The words follow the interface, which is in English.

import type { LoadedLayer } from "../data/types";
import type { ViewMode } from "../scene/FocusTransition";

/** Language of the narrator's voice; matches the language of the interface. */
export const NARRATION_LANG = "en";

export type Level = "low" | "medium" | "high";

/** Low, medium or high for a layer value between 0 and 1 (thirds of the scale). */
export function levelOf(value: number): Level {
  if (value < 1 / 3) return "low";
  if (value < 2 / 3) return "medium";
  return "high";
}

/** "Wildfire smoke: high, 72 percent", or "Wildfire smoke: no data here". */
export function valuePhrase(layerTitle: string, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return `${layerTitle}: no data here.`;
  const clamped = Math.min(1, Math.max(0, value));
  return `${layerTitle}: ${levelOf(clamped)}, ${Math.round(clamped * 100)} percent.`;
}

function degrees(value: number, positive: string, negative: string): string {
  const rounded = Math.round(Math.abs(value));
  if (rounded === 0) return "0 degrees";
  return `${rounded} degrees ${value < 0 ? negative : positive}`;
}

/** "3 degrees south, 60 degrees west": whole degrees, easier to follow by ear. */
export function coordsPhrase(lon: number, lat: number): string {
  return `${degrees(lat, "north", "south")}, ${degrees(lon, "east", "west")}`;
}

/** The first sentence of a text (a layer description runs on for several). */
export function firstSentence(text: string): string {
  const match = /^(.+?[.!?])(\s|$)/s.exec(text.trim());
  return (match?.[1] ?? text).trim();
}

/** Said when the layer picker changes. */
export function layerChangePhrase(layer: LoadedLayer | null): string {
  if (!layer) return "Earth, no layer. The planet is silent.";
  return `${layer.manifest.title}. ${firstSentence(layer.manifest.description)}`;
}

/** Said when the view changes; null where nothing needs saying (the way back). */
export function modePhrase(mode: ViewMode, regionName: string): string | null {
  switch (mode) {
    case "to-map":
      return `Flying to ${regionName}.`;
    case "map":
      return `${regionName} map. Move over it to hear each place. Press I to hear where you are.`;
    case "globe":
      return "Back on the planet.";
    case "to-globe":
      return null;
  }
}

export interface WhereAmIContext {
  mode: ViewMode;
  regionName: string;
  layer: LoadedLayer | null;
  /** Date label of the instant on screen, or "" without a layer. */
  dateLabel: string;
  /** Point under the cursor or locked on the map, or null. */
  point: { lon: number; lat: number } | null;
  /** Active layer value at `point` (0..1), or null when there is no data there. */
  value: number | null;
  /** Whether the timeline is playing. */
  playing: boolean;
}

/** The answer to "where am I?" (the I key): view, layer, date, place and value. */
export function whereAmIPhrase(context: WhereAmIContext): string {
  const { mode, regionName, layer, dateLabel, point, value, playing } = context;
  const parts: string[] = [];
  switch (mode) {
    case "globe":
      parts.push("You are on the planet view.");
      break;
    case "to-map":
      parts.push(`Flying to ${regionName}.`);
      break;
    case "map":
      parts.push(`You are on the ${regionName} map.`);
      break;
    case "to-globe":
      parts.push("Going back to the planet.");
      break;
  }
  if (!layer) {
    parts.push("No layer is chosen, so there is no data sound. Choose a layer with the buttons on the left arc.");
  } else {
    parts.push(`Layer: ${layer.manifest.title}.`);
    if (dateLabel) {
      const timed = !layer.manifest.static && layer.manifest.dates.length > 1;
      parts.push(timed ? `Date: ${dateLabel}, ${playing ? "playing" : "paused"}.` : `Period: ${dateLabel}.`);
    }
  }
  if (point) {
    parts.push(`Point: ${coordsPhrase(point.lon, point.lat)}.`);
    if (layer) parts.push(valuePhrase(layer.manifest.title, value));
  } else if (mode === "map" || mode === "globe") {
    parts.push("No point is under the cursor.");
  }
  return parts.join(" ");
}

/** Said when a scene of the Amazon map opens. */
export function scenePhrase(scene: { title: string; description: string }): string {
  return `${scene.title}. ${scene.description} Press Escape to close it.`;
}

/** Said on the H key. */
export const HELP_PHRASE =
  "Keys: V turns the narrator on or off. I tells you where you are. H repeats this help. " +
  "Tab moves between the controls; the layer buttons on the left arc choose what you hear. " +
  "On the timeline, the left and right arrows move one instant. Escape closes a scene.";

/** Said when the narrator is switched on or off. */
export function narratorTogglePhrase(on: boolean): string {
  return on ? "Narrator on. Press H for the keys, I to hear where you are." : "Narrator off.";
}

/** Just the fields of a SpeechSynthesisVoice the choice needs, so tests can pass plain objects. */
export interface VoiceInfo {
  lang: string;
  default: boolean;
  localService: boolean;
}

/**
 * The voice for `lang` ("en"): the browser's default voice when it speaks that
 * language, then a voice of that language on this machine, then any voice of
 * that language. Null when there is none (the browser then picks one itself).
 */
export function pickVoice<V extends VoiceInfo>(voices: readonly V[], lang: string): V | null {
  const wanted = lang.toLowerCase();
  const matching = voices.filter((voice) => {
    const voiceLang = voice.lang.toLowerCase().replace("_", "-");
    return voiceLang === wanted || voiceLang.startsWith(`${wanted}-`);
  });
  return (
    matching.find((voice) => voice.default) ??
    matching.find((voice) => voice.localService) ??
    matching[0] ??
    null
  );
}
