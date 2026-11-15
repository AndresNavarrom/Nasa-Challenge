import {
  LAYER_IDS,
  type BoundingBox,
  type Cadence,
  type Grid,
  type GridInfo,
  type JukeboxData,
  type LayerId,
  type LayerManifest,
  type LoadedLayer,
  type Manifest,
} from "./types";

/** Error with a message that can be shown to the person running the demo. */
export class DataLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataLoadError";
  }
}

const PREP_HINT =
  "Run the data preparation step (see README.md, section \"Preparing the data\") and reload.";

type FetchLike = (input: string) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, where: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new DataLoadError(`manifest.json: "${where}" must be a non-empty text. ${PREP_HINT}`);
  }
  return value;
}

function requirePositiveInt(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new DataLoadError(`manifest.json: "${where}" must be a positive whole number. ${PREP_HINT}`);
  }
  return value;
}

function requireFiniteNumber(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DataLoadError(`manifest.json: "${where}" must be a number. ${PREP_HINT}`);
  }
  return value;
}

function parseGridInfo(value: unknown, where: string): GridInfo {
  if (!isRecord(value)) {
    throw new DataLoadError(`manifest.json: "${where}" is missing. ${PREP_HINT}`);
  }
  return {
    width: requirePositiveInt(value.width, `${where}.width`),
    height: requirePositiveInt(value.height, `${where}.height`),
    frames: requirePositiveInt(value.frames, `${where}.frames`),
    file: requireString(value.file, `${where}.file`),
    texture: requireString(value.texture, `${where}.texture`),
  };
}

/** `PT<n>H`, `P<n>D` or `P<n>M`, the only cadences jukebox-prep writes. */
export function parseCadence(text: string): Cadence | null {
  const match = /^(?:PT(\d+)H|P(\d+)([DM]))$/.exec(text);
  if (!match) return null;
  const count = Number(match[1] ?? match[2]);
  if (!Number.isInteger(count) || count <= 0) return null;
  if (match[1] !== undefined) return { unit: "hour", count };
  return { unit: match[3] === "D" ? "day" : "month", count };
}

/** Instant times (ISO 8601 UTC texts) as milliseconds, checked to be one per date and in order. */
function parseTimes(value: unknown, dates: number, where: string): number[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value) || value.length !== dates) {
    throw new DataLoadError(`manifest.json: "${where}.times" must list one time per date (${dates}). ${PREP_HINT}`);
  }
  const times = value.map((text) => (typeof text === "string" ? Date.parse(text) : Number.NaN));
  times.forEach((time, index) => {
    if (!Number.isFinite(time) || (index > 0 && time <= times[index - 1]!)) {
      throw new DataLoadError(
        `manifest.json: "${where}.times[${index}]" must be a UTC time later than the one before it. ${PREP_HINT}`,
      );
    }
  });
  return times;
}

function parseLayer(value: unknown, index: number): LayerManifest {
  const where = `layers[${index}]`;
  if (!isRecord(value)) {
    throw new DataLoadError(`manifest.json: "${where}" must be an object. ${PREP_HINT}`);
  }
  const id = requireString(value.id, `${where}.id`);
  if (!(LAYER_IDS as readonly string[]).includes(id)) {
    throw new DataLoadError(
      `manifest.json: "${where}.id" is "${id}" but must be one of ${LAYER_IDS.join(", ")}. ${PREP_HINT}`,
    );
  }
  if (!isRecord(value.source)) {
    throw new DataLoadError(`manifest.json: "${where}.source" is missing. ${PREP_HINT}`);
  }
  if (!Array.isArray(value.dates) || value.dates.some((d) => typeof d !== "string")) {
    throw new DataLoadError(`manifest.json: "${where}.dates" must be a list of texts. ${PREP_HINT}`);
  }
  const region = parseGridInfo(value.region, `${where}.region`);
  const global = value.global == null ? null : parseGridInfo(value.global, `${where}.global`);
  const dates = value.dates as string[];
  if (dates.length !== region.frames) {
    throw new DataLoadError(
      `manifest.json: "${where}" lists ${dates.length} dates but its region grid has ${region.frames} frames. ${PREP_HINT}`,
    );
  }
  if (global && global.frames !== region.frames) {
    throw new DataLoadError(
      `manifest.json: "${where}" has ${global.frames} global frames but ${region.frames} region frames. ${PREP_HINT}`,
    );
  }
  const times = parseTimes(value.times, dates.length, where);
  let cadence: Cadence | undefined;
  if (value.cadence != null) {
    cadence = parseCadence(requireString(value.cadence, `${where}.cadence`)) ?? undefined;
    if (!cadence) {
      throw new DataLoadError(
        `manifest.json: "${where}.cadence" must look like "PT1H", "P1D" or "P1M". ${PREP_HINT}`,
      );
    }
  }
  return {
    id: id as LayerId,
    title: requireString(value.title, `${where}.title`),
    description: requireString(value.description, `${where}.description`),
    source: {
      title: requireString(value.source.title, `${where}.source.title`),
      url: requireString(value.source.url, `${where}.source.url`),
    },
    static: value.static === true,
    sample: value.sample === true,
    dates,
    ...(times ? { times } : {}),
    ...(cadence ? { cadence } : {}),
    global,
    region,
  };
}

function parseBbox(value: unknown): BoundingBox {
  if (!isRecord(value) || !isRecord(value.bbox)) {
    throw new DataLoadError(`manifest.json: "region.bbox" is missing. ${PREP_HINT}`);
  }
  const bbox: BoundingBox = {
    west: requireFiniteNumber(value.bbox.west, "region.bbox.west"),
    south: requireFiniteNumber(value.bbox.south, "region.bbox.south"),
    east: requireFiniteNumber(value.bbox.east, "region.bbox.east"),
    north: requireFiniteNumber(value.bbox.north, "region.bbox.north"),
  };
  if (bbox.west >= bbox.east || bbox.south >= bbox.north) {
    throw new DataLoadError(
      `manifest.json: "region.bbox" is not a valid rectangle (west < east and south < north are required). ${PREP_HINT}`,
    );
  }
  return bbox;
}

/** Validates the parsed JSON of manifest.json. Exported for reuse; throws DataLoadError. */
export function parseManifest(json: unknown): Manifest {
  if (!isRecord(json) || !Array.isArray(json.layers) || json.layers.length === 0) {
    throw new DataLoadError(`manifest.json has no "layers" list. ${PREP_HINT}`);
  }
  const layers = json.layers.map(parseLayer);
  const seen = new Set<string>();
  for (const layer of layers) {
    if (seen.has(layer.id)) {
      throw new DataLoadError(`manifest.json lists the layer "${layer.id}" twice. ${PREP_HINT}`);
    }
    seen.add(layer.id);
  }
  return { layers, region: { bbox: parseBbox(json.region) } };
}

async function fetchChecked(fetcher: FetchLike, url: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(url);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new DataLoadError(`Could not read ${url} (${detail}). ${PREP_HINT}`);
  }
  if (!response.ok) {
    throw new DataLoadError(`Could not read ${url} (HTTP ${response.status}). ${PREP_HINT}`);
  }
  return response;
}

/** True when the bytes start with the gzip signature (1f 8b). */
function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/**
 * The bytes of a grid file. `.bin.gz` grids (what jukebox-prep writes) are
 * inflated here; a server that already sent them decompressed
 * (`Content-Encoding: gzip`) hands over plain bytes, which are used as they are.
 */
export async function gridBytes(raw: ArrayBuffer, url: string): Promise<Uint8Array> {
  const bytes = new Uint8Array(raw);
  if (!isGzip(bytes)) return bytes;
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new DataLoadError(`${url} is not a valid gzip file (${detail}). ${PREP_HINT}`);
  }
}

async function loadGrid(fetcher: FetchLike, baseUrl: string, info: GridInfo): Promise<Grid> {
  const url = baseUrl + info.file;
  const response = await fetchChecked(fetcher, url);
  const data = await gridBytes(await response.arrayBuffer(), url);
  const expected = info.width * info.height * info.frames;
  if (data.length !== expected) {
    throw new DataLoadError(
      `${url} has ${data.length} bytes but the manifest declares ${info.width} x ${info.height} x ${info.frames} = ${expected}. ${PREP_HINT}`,
    );
  }
  return { width: info.width, height: info.height, frames: info.frames, data };
}

/**
 * Reads manifest.json and every grid file it names.
 * Fails with a DataLoadError naming the file when one is missing or its size is wrong.
 */
export async function loadJukeboxData(
  baseUrl = "./data/",
  fetcher: FetchLike = (input) => fetch(input),
): Promise<JukeboxData> {
  const manifestUrl = `${baseUrl}manifest.json`;
  const response = await fetchChecked(fetcher, manifestUrl);
  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new DataLoadError(`${manifestUrl} is not valid JSON (${detail}). ${PREP_HINT}`);
  }
  const manifest = parseManifest(json);
  const layers: LoadedLayer[] = await Promise.all(
    manifest.layers.map(async (layer) => ({
      manifest: layer,
      global: layer.global ? await loadGrid(fetcher, baseUrl, layer.global) : null,
      region: await loadGrid(fetcher, baseUrl, layer.region),
    })),
  );
  return { layers, bbox: manifest.region.bbox, baseUrl };
}
