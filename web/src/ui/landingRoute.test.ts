import { describe, expect, it } from "vitest";
import landingSource from "./Landing.tsx?raw";
import { GLOBE_FADE_MS, GLOBE_HOLD_MS } from "./Landing";
import { JUKEBOX_HASH, isJukeboxHash } from "./landingRoute";

describe("landing page or jukebox", () => {
  it("opens the jukebox for #jukebox, in any letter case", () => {
    expect(isJukeboxHash("#jukebox")).toBe(true);
    expect(isJukeboxHash("#Jukebox")).toBe(true);
  });

  it("stays on the landing page with no hash or one of its own section links", () => {
    for (const hash of ["", "#", "#top", "#layers", "#why-sound", "#how", "#about"]) {
      expect(isJukeboxHash(hash)).toBe(false);
    }
  });

  it("does not open the jukebox for a hash that only starts like it", () => {
    expect(isJukeboxHash("#jukebox-old")).toBe(false);
    expect(isJukeboxHash("jukebox")).toBe(false);
  });

  it("links both buttons of the landing page to the jukebox", () => {
    expect(JUKEBOX_HASH).toBe("#jukebox");
    expect(landingSource).toContain("href={JUKEBOX_HASH}");
    expect(landingSource.match(/<OpenJukebox \/>/g)).toHaveLength(2);
  });

  it("gives every section the menu links to an id", () => {
    for (const id of ["layers", "why-sound", "how", "about"]) {
      expect(landingSource).toContain(`href: "#${id}"`);
      expect(landingSource).toContain(`id="${id}"`);
    }
  });
});

describe("the planet under the hero", () => {
  it("shows the four layers' planets in turn, each named in the chip", () => {
    for (const name of ["forest", "smoke", "co2", "lightning"]) {
      expect(landingSource).toContain(`../assets/landing/globe-${name}.jpg`);
    }
    expect(landingSource).toContain("{LAYERS[shown]!.title}");
  });

  it("fades quickly and holds each planet long enough to see it", () => {
    expect(GLOBE_FADE_MS).toBeGreaterThan(0);
    expect(GLOBE_FADE_MS).toBeLessThanOrEqual(800);
    expect(GLOBE_HOLD_MS).toBeGreaterThan(GLOBE_FADE_MS * 3);
  });
});
