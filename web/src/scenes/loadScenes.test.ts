import { describe, expect, it, vi } from "vitest";
import { loadScenes, parseScenesManifest, ScenesLoadError } from "./loadScenes";

const valid = {
  version: 1,
  transition: { id: "arpa", file: "audio/samples/arpa.ogg" },
  scenes: [
    {
      id: "birds",
      title: "Birds",
      description: "Birds of the Amazon",
      lon: -68.546,
      lat: -3.398,
      image: "scenes/birds/birds.jpg",
      imageAlt: "Birds",
      loop: "scenes/birds/birds.ogg",
      loopGain: 0.8,
      imageCredit: null,
      audioCredit: null,
    },
  ],
};

describe("scenes manifest", () => {
  it("parses the generated manifest", () => {
    const manifest = parseScenesManifest(valid);
    expect(manifest.transition.file).toBe("audio/samples/arpa.ogg");
    expect(manifest.scenes[0]).toMatchObject({
      id: "birds",
      lon: -68.546,
      lat: -3.398,
      loopGain: 0.8,
    });
  });

  it("rejects duplicate ids, missing fields and bad gains", () => {
    expect(() =>
      parseScenesManifest({ ...valid, scenes: [valid.scenes[0], valid.scenes[0]] }),
    ).toThrow(ScenesLoadError);
    expect(() =>
      parseScenesManifest({ ...valid, scenes: [{ ...valid.scenes[0], lon: "west" }] }),
    ).toThrow(/lon must be a number/);
    expect(() =>
      parseScenesManifest({ ...valid, scenes: [{ ...valid.scenes[0], loopGain: 2 }] }),
    ).toThrow(/loopGain/);
    expect(() => parseScenesManifest({ ...valid, transition: null })).toThrow(/transition/);
  });

  it("loads through a fetch-like function and reports HTTP errors", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(valid), { status: 200 }));
    const manifest = await loadScenes("./scenes/", fetcher);
    expect(fetcher).toHaveBeenCalledWith("./scenes/manifest.json");
    expect(manifest.scenes).toHaveLength(1);

    const broken = vi.fn(async () => new Response("missing", { status: 404 }));
    await expect(loadScenes("./scenes/", broken)).rejects.toThrow(/HTTP 404/);
  });
});
