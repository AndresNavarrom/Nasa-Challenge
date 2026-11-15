import { describe, expect, it } from "vitest";
import { gridBytes } from "../data/loadManifest";
import {
  AMAZON_REGION,
  AMAZON_REGION_ID,
  FOREST_PRESENCE_MIN,
  buildRegionMap,
  focusBboxFor,
  isInsideRegion,
  loadWorldRegions,
  parseWorldRegions,
  rasterizeRegions,
  regionById,
  regionIndexAt,
  regionMapIndexAt,
  ringsBbox,
  withAmazon,
  type Region,
} from "./regions";

const DATA_BBOX = { west: -80, south: -20, east: -44, north: 8 };
const square: Region = { id: "square", name: "Square", rings: [[[0, 0], [10, 0], [10, 10], [0, 10]]] };
/** A 40° square with a 20° hole in the middle. */
const framed: Region = {
  id: "framed",
  name: "Framed",
  rings: [
    [[-20, -20], [20, -20], [20, 20], [-20, 20]],
    [[-10, -10], [10, -10], [10, 10], [-10, 10]],
  ],
};

/** Node's file reader, imported by name: the project has no Node type declarations. */
async function readDataFile(name: string): Promise<Uint8Array> {
  const fsModule = ["node", "fs"].join(":");
  const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as { readFileSync: (path: URL) => Uint8Array };
  return new Uint8Array(readFileSync(new URL(`../../public/data/${name}`, import.meta.url)));
}

describe("regions", () => {
  it("tests points with the even-odd rule over every ring, so holes stay out", () => {
    expect(isInsideRegion(5, 5, square)).toBe(true);
    expect(isInsideRegion(365, 5, square)).toBe(true); // 365° = 5°
    expect(isInsideRegion(15, 5, square)).toBe(false);
    expect(isInsideRegion(15, 0, framed)).toBe(true);
    expect(isInsideRegion(0, 0, framed)).toBe(false); // inside the hole
    expect(regionIndexAt(-5, -5, [framed, square])).toBeNull(); // the hole
    expect(regionIndexAt(5, 5, [framed, square])).toBe(1);
    expect(regionIndexAt(Number.NaN, 0, [square])).toBeNull();
  });

  it("puts the Amazon first and flies to the right rectangle", () => {
    const regions = withAmazon([square, { ...AMAZON_REGION, name: "Duplicate" }]);
    expect(regions.map((region) => region.id)).toEqual([AMAZON_REGION_ID, "square"]);
    expect(focusBboxFor(AMAZON_REGION, DATA_BBOX)).toBe(DATA_BBOX);
    expect(focusBboxFor(square, DATA_BBOX)).toEqual({ west: 0, south: 0, east: 10, north: 10 });
    const stored = { west: 1, south: 2, east: 3, north: 4 };
    expect(focusBboxFor({ ...square, bbox: stored }, DATA_BBOX)).toBe(stored);
    expect(regionById("square", regions)).toBe(square);
    expect(regionById("nowhere", regions)).toBeNull();
    expect(() => ringsBbox([[[0, 0], [0, 1], [0, 2]]])).toThrow(/enclose an area/);
    // The Amazon's search area fits the data rectangle, so its detailed images cover it.
    const amazon = ringsBbox(AMAZON_REGION.rings);
    expect(amazon.west).toBeGreaterThanOrEqual(DATA_BBOX.west);
    expect(amazon.east).toBeLessThanOrEqual(DATA_BBOX.east);
    expect(amazon.south).toBeGreaterThanOrEqual(DATA_BBOX.south);
    expect(amazon.north).toBeLessThanOrEqual(DATA_BBOX.north);
  });

  it("draws the region map with index + 1, the first region winning, and holes left empty", () => {
    // 36 x 18 cells of 10°: the square (0..10°, 0..10°) is exactly one cell.
    const cells = rasterizeRegions(36, 18, [square]);
    const cell = (lon: number, lat: number) => cells[Math.floor((90 - lat) / 10) * 36 + Math.floor((lon + 180) / 10)];
    expect(cell(5, 5)).toBe(1);
    expect(cell(-5, 5)).toBe(0);
    expect(cells.reduce((sum, value) => sum + value, 0)).toBe(1);

    const both = { width: 360, height: 180, cells: rasterizeRegions(360, 180, [square, framed]) };
    expect(regionMapIndexAt(both, 5, 5)).toBe(0); // the square wins over the frame's hole edge
    expect(regionMapIndexAt(both, 15, -15)).toBe(1);
    expect(regionMapIndexAt(both, -5, -5)).toBeNull(); // the hole
    expect(regionMapIndexAt(both, Number.NaN, 0)).toBeNull();
    expect(() => rasterizeRegions(0, 10, [square])).toThrow(/positive whole size/);
  });

  it("keeps only the forest of a forest-shaped region and gives the rest to the next region", () => {
    // Forest grid of 36 x 18 cells (10° each): forest in the west half of the area.
    const data = new Uint8Array(36 * 18);
    const forestCell = (lon: number, lat: number) => Math.floor((90 - lat) / 10) * 36 + Math.floor((lon + 180) / 10);
    for (let lon = -35; lon < 0; lon += 10) for (let lat = -35; lat < 40; lat += 10) data[forestCell(lon, lat)] = 200;
    const area: Region = { id: "area", name: "Area", shapeByForest: true, rings: [[[-40, -40], [40, -40], [40, 40], [-40, 40]]] };
    const below: Region = { id: "below", name: "Below", rings: [[[-60, -60], [60, -60], [60, 60], [-60, 60]]] };
    const map = buildRegionMap(360, 180, { width: 36, height: 18, frames: 1, data }, [area, below]);
    expect(regionMapIndexAt(map, -20, 0)).toBe(0); // forest inside the area
    expect(regionMapIndexAt(map, 25, 0)).toBe(1); // in the area but no forest: the next region
    expect(regionMapIndexAt(map, 100, 0)).toBeNull();

    // Low vegetation (under about 5 m) is not forest; without a usable grid the rings are used.
    const low = new Uint8Array(36 * 18).fill(FOREST_PRESENCE_MIN - 1);
    expect(regionMapIndexAt(buildRegionMap(360, 180, { width: 36, height: 18, frames: 1, data: low }, [area]), -20, 0)).toBeNull();
    expect(regionMapIndexAt(buildRegionMap(360, 180, null, [area]), 25, 0)).toBe(0);
    expect(regionMapIndexAt(buildRegionMap(360, 180, { width: 36, height: 18, frames: 1, data: new Uint8Array(3) }, [area]), 25, 0)).toBe(0);
  });

  it("reads the regions file and leaves out broken regions", () => {
    const regions = parseWorldRegions({
      regions: [
        { id: "a", name: "A", bbox: { west: 0, south: 0, east: 10, north: 10 }, rings: [[[0, 0], [10, 0], [10, 10]]] },
        { id: "b", name: "B", rings: [[[0, 0], [500, 0], [10, 10]]] }, // longitude out of range
        { id: "c", name: "C", rings: [] },
        "nonsense",
      ],
    });
    expect(regions.map((region) => region.id)).toEqual(["a"]);
    expect(regions[0]!.bbox).toEqual({ west: 0, south: 0, east: 10, north: 10 });
    expect(() => parseWorldRegions({})).toThrow(/no "regions" list/);
    expect(() => parseWorldRegions({ regions: [{ id: "c", name: "C", rings: [] }] })).toThrow(/no usable region/);
  });

  it("loads the regions file with the Amazon first and reports a missing file", async () => {
    const body = { regions: [{ id: "a", name: "A", rings: [[[0, 0], [10, 0], [10, 10]]] }] };
    const ok = async () => new Response(JSON.stringify(body), { status: 200 });
    expect((await loadWorldRegions("./data/", ok)).map((region) => region.id)).toEqual([AMAZON_REGION_ID, "a"]);
    const missing = async () => new Response("", { status: 404 });
    await expect(loadWorldRegions("./data/", missing)).rejects.toThrow(/\.\/data\/regions\.json could not be loaded \(HTTP 404\)/);
  });

  it("divides the real world into regions that cover every continent", async () => {
    const world = parseWorldRegions(JSON.parse(new TextDecoder().decode(await readDataFile("regions.json"))));
    expect(world.length).toBeGreaterThanOrEqual(20);
    const regions = withAmazon(world);
    const forest = await gridBytes((await readDataFile("forest_global.bin.gz")).slice().buffer, "forest_global.bin.gz");
    const map = buildRegionMap(1440, 720, { width: 1440, height: 720, frames: 1, data: forest }, regions);
    const at = (lon: number, lat: number) => {
      const index = regionMapIndexAt(map, lon, lat);
      return index === null ? null : regions[index]!.id;
    };
    expect(at(-60, -3)).toBe("amazon"); // Manaus
    expect(at(-77, -12)).toBe("south-america"); // Lima, outside the Amazon forest
    expect(at(15.3, -4.3)).toBe("central-africa"); // Kinshasa
    expect(at(2.35, 48.85)).toBe("western-europe"); // Paris
    expect(at(114, 0)).toBe("southeast-asia"); // Borneo
    expect(at(37.6, 55.75)).toBe("russia"); // Moscow
    expect(at(-100, 45)).toBe("north-america");
    expect(at(134, -25)).toBe("australia-and-new-zealand");
    expect(at(0, -80)).toBe("antarctica");
    expect(at(-30, 0)).toBeNull(); // Atlantic
    expect(at(110, -4)).toBeNull(); // Java Sea
  });
});
