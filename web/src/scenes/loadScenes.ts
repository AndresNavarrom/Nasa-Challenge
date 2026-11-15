// Loads and validates web/public/scenes/manifest.json.

import type { SceneDefinition, ScenesManifest } from "./types";

export class ScenesLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenesLoadError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, where: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ScenesLoadError(`${where} must be a non-empty text.`);
  }
  return value;
}

function requireFinite(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ScenesLoadError(`${where} must be a number.`);
  }
  return value;
}

function parseScene(value: unknown, index: number): SceneDefinition {
  const where = `scenes[${index}]`;
  if (!isRecord(value)) throw new ScenesLoadError(`${where} must be an object.`);
  const loopGain = value.loopGain === undefined ? 1 : requireFinite(value.loopGain, `${where}.loopGain`);
  if (loopGain < 0 || loopGain > 1) throw new ScenesLoadError(`${where}.loopGain must be between 0 and 1.`);
  const credit = (key: string): string | null => {
    const entry = value[key];
    if (entry === null || entry === undefined) return null;
    return requireString(entry, `${where}.${key}`);
  };
  return {
    id: requireString(value.id, `${where}.id`),
    title: requireString(value.title, `${where}.title`),
    description: requireString(value.description, `${where}.description`),
    lon: requireFinite(value.lon, `${where}.lon`),
    lat: requireFinite(value.lat, `${where}.lat`),
    image: requireString(value.image, `${where}.image`),
    imageAlt: requireString(value.imageAlt, `${where}.imageAlt`),
    loop: requireString(value.loop, `${where}.loop`),
    loopGain,
    imageCredit: credit("imageCredit"),
    audioCredit: credit("audioCredit"),
  };
}

/** Validates the parsed JSON of scenes/manifest.json. */
export function parseScenesManifest(json: unknown): ScenesManifest {
  if (!isRecord(json) || !Array.isArray(json.scenes) || json.scenes.length === 0) {
    throw new ScenesLoadError("scenes/manifest.json has no scenes.");
  }
  if (!isRecord(json.transition)) {
    throw new ScenesLoadError("scenes/manifest.json has no transition.");
  }
  const scenes = json.scenes.map(parseScene);
  const ids = new Set<string>();
  for (const scene of scenes) {
    if (ids.has(scene.id)) throw new ScenesLoadError(`Duplicate scene id: ${scene.id}`);
    ids.add(scene.id);
  }
  return {
    version: typeof json.version === "number" ? json.version : 1,
    transition: {
      id: requireString(json.transition.id, "transition.id"),
      file: requireString(json.transition.file, "transition.file"),
    },
    scenes,
  };
}

/** Reads scenes/manifest.json from the app's public folder. */
export async function loadScenes(
  baseUrl = "./scenes/",
  fetcher: (input: string) => Promise<Response> = (input) => fetch(input),
): Promise<ScenesManifest> {
  const url = `${baseUrl}manifest.json`;
  let response: Response;
  try {
    response = await fetcher(url);
  } catch (cause) {
    throw new ScenesLoadError(`Could not read ${url} (${cause instanceof Error ? cause.message : String(cause)}).`);
  }
  if (!response.ok) throw new ScenesLoadError(`Could not read ${url} (HTTP ${response.status}).`);
  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    throw new ScenesLoadError(`${url} is not valid JSON (${cause instanceof Error ? cause.message : String(cause)}).`);
  }
  return parseScenesManifest(json);
}
