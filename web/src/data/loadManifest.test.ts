import { describe, expect, it } from "vitest";
import { DataLoadError, gridBytes, loadJukeboxData, parseCadence } from "./loadManifest";
import type { LayerManifest, Manifest } from "./types";

const manifest: Manifest = {
  layers: [
    {
      id: "forest",
      title: "Forest height",
      description: "Fixed base layer",
      source: { title: "GEDI Forest Height (NASA SVS 4950)", url: "https://svs.gsfc.nasa.gov/4950" },
      static: true,
      sample: false,
      dates: ["Apr 2019 - Apr 2020"],
      global: { width: 4, height: 2, frames: 1, file: "forest_global.bin", texture: "forest_global.png" },
      region: { width: 2, height: 2, frames: 1, file: "forest_region.bin", texture: "forest_region.png" },
    },
    {
      id: "smoke",
      title: "Wildfire smoke",
      description: "Amazon only",
      source: { title: "Air Quality Model Runs (NASA SVS 5533)", url: "https://svs.gsfc.nasa.gov/5533" },
      static: false,
      sample: false,
      dates: ["First", "Second"],
      global: null,
      region: { width: 2, height: 2, frames: 2, file: "smoke_region.bin", texture: "smoke_region.png" },
    },
  ],
  region: { bbox: { west: -80, south: -20, east: -44, north: 8 } },
};

/** Gzip bytes the way jukebox-prep writes .bin.gz grids. */
async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A stand-in for `fetch` that serves the given files and answers 404 for anything else. */
function fakeFetch(files: Record<string, BodyInit>) {
  return async (url: string): Promise<Response> => {
    const body = files[url];
    return body === undefined ? new Response("not found", { status: 404 }) : new Response(body);
  };
}

function filesFor(json: unknown): Record<string, BodyInit> {
  return {
    "./data/manifest.json": JSON.stringify(json),
    "./data/forest_global.bin": new Uint8Array(8),
    "./data/forest_region.bin": new Uint8Array(4),
    "./data/smoke_region.bin": new Uint8Array(8).fill(255),
  };
}

describe("loadJukeboxData", () => {
  it("loads the manifest and every grid it names", async () => {
    const data = await loadJukeboxData("./data/", fakeFetch(filesFor(manifest)));

    expect(data.layers.map((layer) => layer.manifest.id)).toEqual(["forest", "smoke"]);
    expect(data.bbox).toEqual(manifest.region.bbox);
    expect(data.layers[0]?.global?.data.length).toBe(8);
    // A region-only layer loads without a whole-planet grid.
    expect(data.layers[1]?.global).toBeNull();
    expect(data.layers[1]?.region.frames).toBe(2);
    expect(data.layers[1]?.region.data[0]).toBe(255);
  });

  it("names the file when a grid is missing or has the wrong size", async () => {
    const missing = filesFor(manifest);
    delete missing["./data/smoke_region.bin"];
    await expect(loadJukeboxData("./data/", fakeFetch(missing))).rejects.toThrow(/smoke_region\.bin.*HTTP 404/);

    const truncated = { ...filesFor(manifest), "./data/forest_global.bin": new Uint8Array(5) };
    const failure = loadJukeboxData("./data/", fakeFetch(truncated));
    await expect(failure).rejects.toBeInstanceOf(DataLoadError);
    await expect(failure).rejects.toThrow(/forest_global\.bin has 5 bytes.*= 8/);
  });

  it("rejects a manifest that does not match the data format", async () => {
    const load = (json: unknown) => loadJukeboxData("./data/", fakeFetch(filesFor(json)));

    await expect(load({ layers: [] })).rejects.toThrow(/no "layers" list/);
    await expect(load({ ...manifest, region: { bbox: { west: 10, south: 0, east: -10, north: 5 } } })).rejects.toThrow(
      /not a valid rectangle/,
    );
    const unknownLayer = { ...manifest, layers: [{ ...manifest.layers[0], id: "ozone" }] };
    await expect(load(unknownLayer)).rejects.toThrow(/must be one of forest, smoke, co2/);
    const wrongDates = { ...manifest, layers: [{ ...manifest.layers[1], dates: ["Only one"] }] };
    await expect(load(wrongDates)).rejects.toThrow(/1 dates but its region grid has 2 frames/);
    await expect(loadJukeboxData("./data/", fakeFetch({ "./data/manifest.json": "{not json" }))).rejects.toThrow(
      /not valid JSON/,
    );
  });

  it("reads the optional sharp images of a layer, one per date, and rejects broken ones", async () => {
    const load = (json: unknown) => loadJukeboxData("./data/", fakeFetch(filesFor(json)));
    const smoke = manifest.layers[1]!; // two dates
    const sharp = {
      global: { width: 4096, height: 2048, files: ["smoke_sharp_global_00.png", "smoke_sharp_global_01.png"] },
      region: { width: 1152, height: 896, files: ["smoke_sharp_region_00.png", "smoke_sharp_region_01.png"] },
    };
    const withSharp = { ...manifest, layers: [manifest.layers[0], { ...smoke, sharp }] };
    const data = await load(withSharp);
    expect(data.layers[1]!.manifest.sharp).toEqual(sharp);
    expect(data.layers[0]!.manifest.sharp).toBeUndefined(); // no sharp images: the field stays out

    const onlyRegion = { ...manifest, layers: [manifest.layers[0], { ...smoke, sharp: { region: sharp.region } }] };
    expect((await load(onlyRegion)).layers[1]!.manifest.sharp).toEqual({ region: sharp.region });

    const oneShort = { ...manifest, layers: [manifest.layers[0], { ...smoke, sharp: { global: { ...sharp.global, files: ["a.png"] } } }] };
    await expect(load(oneShort)).rejects.toThrow(/sharp\.global\.files" must list one image for each of the 2 dates/);
    const badWidth = { ...manifest, layers: [manifest.layers[0], { ...smoke, sharp: { global: { ...sharp.global, width: 0 } } }] };
    await expect(load(badWidth)).rejects.toThrow(/sharp\.global\.width/);
    const notObject = { ...manifest, layers: [manifest.layers[0], { ...smoke, sharp: "yes" }] };
    await expect(load(notObject)).rejects.toThrow(/sharp" must be an object/);
  });

  it("accepts a data file with the lightning layer in place of co2 (FR7.2)", async () => {
    const lightning: LayerManifest = {
      id: "lightning",
      title: "Lightning",
      description: "2017 - 2023 accumulated",
      source: { title: "Lightning from the ISS (NASA SVS 5011)", url: "https://svs.gsfc.nasa.gov/5011" },
      static: true,
      sample: false,
      dates: ["2017 - 2023 (accumulated)"],
      global: { width: 4, height: 2, frames: 1, file: "lightning_global.bin", texture: "lightning_global.png" },
      region: { width: 2, height: 2, frames: 1, file: "lightning_region.bin", texture: "lightning_region.png" },
    };
    const withLightning: Manifest = { ...manifest, layers: [...manifest.layers, lightning] };
    const files = {
      ...filesFor(withLightning),
      "./data/lightning_global.bin": new Uint8Array(8).fill(200),
      "./data/lightning_region.bin": new Uint8Array(4),
    };

    const data = await loadJukeboxData("./data/", fakeFetch(files));

    expect(data.layers.map((layer) => layer.manifest.id)).toEqual(["forest", "smoke", "lightning"]);
    expect(data.layers[2]?.global?.data[0]).toBe(200);
    // co2 is still a known id, even though the data file no longer lists it.
    const withCo2 = { ...manifest, layers: [{ ...manifest.layers[1], id: "co2" }] };
    await expect(loadJukeboxData("./data/", fakeFetch(filesFor(withCo2)))).resolves.toBeDefined();
  });

  it("inflates .bin.gz grids and keeps grids a server already sent decompressed", async () => {
    const gz = structuredClone(manifest);
    gz.layers[1]!.region.file = "smoke_region.bin.gz";
    const files = filesFor(gz);
    files["./data/smoke_region.bin.gz"] = await gzip(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));

    const data = await loadJukeboxData("./data/", fakeFetch(files));
    expect(Array.from(data.layers[1]!.region.data)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    // Same file name, plain bytes (Content-Encoding: gzip already undone by the browser).
    files["./data/smoke_region.bin.gz"] = new Uint8Array(8).fill(9);
    const plain = await loadJukeboxData("./data/", fakeFetch(files));
    expect(plain.layers[1]!.region.data[0]).toBe(9);

    await expect(gridBytes(new Uint8Array([0x1f, 0x8b, 0, 0]).buffer, "bad.bin.gz")).rejects.toThrow(/bad\.bin\.gz/);
  });

  it("reads the instant times and the cadence of a timed layer", async () => {
    const timed = structuredClone(manifest) as unknown as { layers: Record<string, unknown>[] };
    timed.layers[1]!.times = ["2026-09-01T00:30:00Z", "2026-09-01T01:30:00Z"];
    timed.layers[1]!.cadence = "PT1H";

    const data = await loadJukeboxData("./data/", fakeFetch(filesFor(timed)));
    const smoke = data.layers[1]!.manifest;
    expect(smoke.times).toEqual([Date.UTC(2026, 8, 1, 0, 30), Date.UTC(2026, 8, 1, 1, 30)]);
    expect(smoke.cadence).toEqual({ unit: "hour", count: 1 });
    // Layers without them (static, sample data) simply have none.
    expect(data.layers[0]!.manifest.times).toBeUndefined();
    expect(data.layers[0]!.manifest.cadence).toBeUndefined();

    timed.layers[1]!.times = ["2026-09-01T01:30:00Z", "2026-09-01T00:30:00Z"];
    await expect(loadJukeboxData("./data/", fakeFetch(filesFor(timed)))).rejects.toThrow(/times\[1\]/);
    timed.layers[1]!.times = ["2026-09-01T00:30:00Z"];
    await expect(loadJukeboxData("./data/", fakeFetch(filesFor(timed)))).rejects.toThrow(/one time per date/);
    timed.layers[1]!.times = undefined;
    timed.layers[1]!.cadence = "hourly";
    await expect(loadJukeboxData("./data/", fakeFetch(filesFor(timed)))).rejects.toThrow(/cadence/);
  });
});

describe("parseCadence", () => {
  it("reads hours, days and months and rejects anything else", () => {
    expect(parseCadence("PT1H")).toEqual({ unit: "hour", count: 1 });
    expect(parseCadence("PT6H")).toEqual({ unit: "hour", count: 6 });
    expect(parseCadence("P1D")).toEqual({ unit: "day", count: 1 });
    expect(parseCadence("P3M")).toEqual({ unit: "month", count: 3 });
    expect(parseCadence("P0M")).toBeNull();
    expect(parseCadence("1H")).toBeNull();
    expect(parseCadence("P1Y")).toBeNull();
  });
});
