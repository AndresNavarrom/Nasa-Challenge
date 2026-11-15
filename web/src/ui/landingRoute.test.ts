import { describe, expect, it } from "vitest";
import landingSource from "./Landing.tsx?raw";
import cssSource from "../index.css?raw";
import { GLOBE_FADE_MS, GLOBE_HOLD_MS, TEAM_NAME } from "./Landing";
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
    for (const id of ["layers", "about"]) {
      expect(landingSource).toContain(`href: "#${id}"`);
      expect(landingSource).toContain(`id="${id}"`);
    }
  });
});

describe("landing layout and colours", () => {
  it("is split into three full-height sections", () => {
    expect(landingSource.match(/<section\s/g)).toHaveLength(3);
    for (const id of ["listen", "layers", "about"]) {
      expect(landingSource).toContain(`data-testid="landing-section-${id}"`);
    }
    expect(landingSource).toContain("min-h-svh");
  });

  it("names the team Sagitta, never the old spelling", () => {
    expect(TEAM_NAME).toBe("Sagitta");
    expect(landingSource).not.toMatch(/saggita/i);
  });

  it("uses no pure black or pure white", () => {
    expect(landingSource).not.toMatch(/#000(000)?\b|#fff(fff)?\b|\b(text|bg|border)-(black|white)\b/i);
    expect(cssSource).not.toMatch(/--color-landing-[\w-]+:\s*#(000000|000|ffffff|fff);/i);
  });

  it("keeps the button the only filled bright shape, and every title thin", () => {
    // The mint fill appears once: in OpenJukebox.
    expect(landingSource.match(/\bbg-landing-accent(?!-)/g)).toHaveLength(1);
    expect(landingSource).toMatch(/<h1\s+className=\{`\$\{calmTitle\}/);
    expect(landingSource.match(/<h2\s+className=\{`\$\{calmTitle\}/g)).toHaveLength(2);
    expect(landingSource).toContain('const calmTitle = "font-display font-extralight text-landing-title"');
  });
});

describe("the planet of the layers section", () => {
  it("shows the four layers' planets in turn, marking the same layer in the list beside it", () => {
    for (const name of ["forest", "smoke", "co2", "lightning"]) {
      expect(landingSource).toContain(`../assets/landing/globe-${name}.jpg`);
    }
    expect(landingSource).toContain("aria-pressed={active}");
    expect(landingSource).toContain("onClick={() => setShown(index)}");
  });

  it("fades quickly and holds each planet long enough to see it", () => {
    expect(GLOBE_FADE_MS).toBeGreaterThan(0);
    expect(GLOBE_FADE_MS).toBeLessThanOrEqual(800);
    expect(GLOBE_HOLD_MS).toBeGreaterThan(GLOBE_FADE_MS * 3);
  });
});
