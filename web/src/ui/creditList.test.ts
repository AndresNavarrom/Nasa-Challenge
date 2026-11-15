import { describe, expect, it } from "vitest";
import creditsPageSource from "./Credits.tsx?raw";
import landingSource from "./Landing.tsx?raw";
import rootSource from "../Root.tsx?raw";
import { CREDIT_GROUPS, allCredits, creditHost } from "./creditList";
import { CREDITS_HASH, isCreditsHash, isJukeboxHash, pageForHash } from "./landingRoute";

describe("credits from the reference sheet", () => {
  it("keeps the sheet's groups, in order, with every row", () => {
    expect(CREDIT_GROUPS.map((group) => [group.title, group.items.length])).toEqual([
      ["NASA data and resources", 13],
      ["Sounds", 29],
      ["Map data", 2],
      ["Open-source code and tools", 10],
      ["Other references (not NASA)", 9],
    ]);
  });

  it("gives every credit a text and a full https link, each link once", () => {
    const credits = allCredits();
    for (const credit of credits) {
      expect(credit.text.trim()).toBe(credit.text);
      expect(credit.text.length).toBeGreaterThan(0);
      expect(credit.url).toMatch(/^https:\/\/\S+$/);
    }
    expect(new Set(credits.map((credit) => credit.url)).size).toBe(credits.length);
  });

  it("leaves out the sheet's header row and review notes", () => {
    for (const credit of allCredits()) {
      expect(credit.text).not.toMatch(/^Texto del enlace$|^Pendiente|no va en el formulario|Enlace sin abrir/);
    }
  });

  it("shows the site of each link, without www", () => {
    expect(creditHost("https://www.earthdata.nasa.gov/")).toBe("earthdata.nasa.gov");
    expect(creditHost("https://svs.gsfc.nasa.gov/3354/")).toBe("svs.gsfc.nasa.gov");
    expect(creditHost("not a url")).toBe("not a url");
  });
});

describe("credits page route", () => {
  it("opens the credits for #credits only, in any letter case", () => {
    expect(CREDITS_HASH).toBe("#credits");
    expect(isCreditsHash("#credits")).toBe(true);
    expect(isCreditsHash("#Credits")).toBe(true);
    expect(isCreditsHash("#credits-sounds")).toBe(false);
    expect(isCreditsHash("credits")).toBe(false);
  });

  it("picks one page per address", () => {
    expect(pageForHash("#jukebox")).toBe("jukebox");
    expect(pageForHash("#credits")).toBe("credits");
    for (const hash of ["", "#top", "#layers", "#about"]) expect(pageForHash(hash)).toBe("landing");
    expect(isJukeboxHash("#credits")).toBe(false);
  });

  it("is reached from the landing's Credits button and menu, and Root shows it", () => {
    expect(landingSource).toContain("href={CREDITS_HASH}");
    expect(landingSource).toContain('data-testid="landing-credits"');
    expect(landingSource).toContain('{ href: CREDITS_HASH, label: "CREDITS" }');
    expect(rootSource).toContain('if (page === "credits") return <Credits />;');
  });

  it("opens every source in a new tab and leads back to the landing", () => {
    expect(creditsPageSource).toContain('target="_blank"');
    expect(creditsPageSource).toContain('rel="noreferrer"');
    expect(creditsPageSource).toContain('export const BACK_HREF = "#top"');
  });

  it("uses no pure black or pure white", () => {
    expect(creditsPageSource).not.toMatch(/#000(000)?\b|#fff(fff)?\b|\b(text|bg|border)-(black|white)\b/i);
  });
});
