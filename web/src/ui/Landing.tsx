// The landing page (Figma "Earth Jukebox — Landing Option B (Deep field)"), in
// three full-height sections stacked one under the other, each set on one
// visual reference:
//   1. Listen (#top)    — the forest silhouette: the title, one line, the button.
//   2. Layers (#layers) — the planet: each layer's planet beside its name.
//   3. About (#about)   — the forest again: how to listen, who made it, the button.
//
// The button that opens the jukebox is always the strongest thing on screen:
// titles are thin, calm and a step dimmer than body ink; the button is the only
// filled, bright shape, with a soft glow. No colour is pure black or pure white.
//
// "Open the jukebox" goes to #jukebox, where Root (main.tsx) loads the app; the
// landing itself loads no Earth data, so it opens at once. Fonts are bundled
// (@fontsource-variable) so nothing comes from the internet.

import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/sora";
import forestBack from "../assets/landing/forest-back.svg";
import forestFront from "../assets/landing/forest-front.svg";
import forestMiddle from "../assets/landing/forest-middle.svg";
import globeCo2 from "../assets/landing/globe-co2.jpg";
import globeForest from "../assets/landing/globe-forest.jpg";
import globeLightning from "../assets/landing/globe-lightning.jpg";
import globeSmoke from "../assets/landing/globe-smoke.jpg";
import { useEffect, useState, type ReactNode } from "react";
import { JUKEBOX_HASH } from "./landingRoute";

/** Name of the team, as it is written everywhere (README, HUD, landing). */
export const TEAM_NAME = "Sagitta";

const NAV = [
  { href: "#layers", label: "LAYERS" },
  { href: "#about", label: "ABOUT" },
] as const;

const LAYERS = [
  {
    title: "Forest height",
    text: "How tall the canopy stands, from cleared land to old-growth rainforest.",
    globe: globeForest,
  },
  { title: "Wildfire smoke", text: "Where smoke from burning forest gathers and how far it drifts.", globe: globeSmoke },
  {
    title: "Atmospheric CO2",
    text: "The carbon dioxide in the air above the basin, the gas the forest breathes in.",
    globe: globeCo2,
  },
  { title: "Lightning", text: "Where storms strike, flash by flash, across the tropics.", globe: globeLightning },
] as const;

/** How long each layer's planet stays before the next one fades in, and how long the fade takes. */
export const GLOBE_HOLD_MS = 3500;
export const GLOBE_FADE_MS = 600;

const STEPS = [
  "Press Start sound — browsers keep audio off until you ask.",
  "Pick a layer. Only its voice plays, so you hear one dataset at a time.",
  "Drag to turn the planet. The sound follows the part of the Earth in view.",
  "Double-click a region to fly in; on its map, click a point to lock its sound.",
] as const;

const POINTS = [
  {
    title: "Sound you can locate",
    text: "The audio pans between the left and right speakers as you move, so position is something you hear.",
  },
  {
    title: "A narrator on request",
    text: "Press V and the app reads aloud the layer, the view and where you are; I and H answer at any time.",
  },
  {
    title: "A tour you can repeat",
    text: "A few short steps explain the controls on first visit. Press ? at any time to repeat them.",
  },
] as const;

const TEAM = [
  "Danna Isabella Vergara Vélez",
  "Andrés David Osorno Vásquez",
  "Alberto Antonio Jaimes Pulido",
  "Samuel Betancur Muñoz",
  "Fernando González Rivero",
  "Andrés Navarro Marín",
] as const;

const REPO_URL = "https://github.com/Betha2516/Nasa-Challenge";

/** Small spaced capitals above a heading ("THE LAYERS"). */
function Eyebrow({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <p className={`font-label text-[11px] tracking-[0.26em] ${accent ? "text-landing-accent" : "text-landing-label"}`}>
      {children}
    </p>
  );
}

/** The three layers of forest silhouette at the foot of a section, fading into the deep background. */
function ForestBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[340px] overflow-hidden">
      <img alt="" src={forestBack} className="absolute inset-[38.82%_-5.76%_0_-2.78%] block size-full max-w-none" />
      <img alt="" src={forestMiddle} className="absolute inset-[51.4%_-5.56%_0_-2.78%] block size-full max-w-none" />
      <img alt="" src={forestFront} className="absolute inset-[64.13%_-4.51%_0_-2.78%] block size-full max-w-none" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#05070d_0%,rgba(5,7,13,0.6)_30%,rgba(5,7,13,0)_58%,rgba(5,7,13,0.55)_86%,#05070d_100%)]" />
    </div>
  );
}

/**
 * The planet of the layers section: each layer's planet in turn, fading into
 * the next, while the list beside it marks the same layer. Choosing a layer in
 * the list shows its planet at once. With reduced motion it changes without the fade.
 */
function LayerShowcase() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setShown((index) => (index + 1) % LAYERS.length), GLOBE_HOLD_MS);
    return () => window.clearInterval(timer);
  }, [shown]);

  return (
    <div className="grid w-full items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
      <div
        data-testid="landing-globe"
        className="relative mx-auto aspect-square w-full max-w-[520px] overflow-hidden rounded-full bg-[#0b111e] shadow-[0_0_120px_rgba(94,233,181,0.08)]"
      >
        {LAYERS.map((layer, index) => (
          <img
            key={layer.title}
            src={layer.globe}
            alt={index === shown ? `The planet showing ${layer.title.toLowerCase()}` : ""}
            aria-hidden={index !== shown}
            width={800}
            height={800}
            decoding="async"
            style={{ transitionDuration: `${GLOBE_FADE_MS}ms` }}
            className={`absolute inset-0 size-full object-cover transition-opacity ease-in-out motion-reduce:transition-none ${
              index === shown ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>
      <ol className="flex w-full flex-col text-left">
        {LAYERS.map((layer, index) => {
          const active = index === shown;
          return (
            <li key={layer.title} className="border-t border-landing-line last:border-b">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setShown(index)}
                className={`flex w-full items-baseline gap-5 py-6 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-landing-accent ${
                  active ? "text-landing-ink" : "text-landing-label hover:text-landing-mist"
                }`}
              >
                <span className={`font-label text-[11px] tracking-[0.26em] ${active ? "text-landing-accent" : ""}`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex flex-col gap-1.5">
                  <span className="font-display text-[clamp(1.375rem,2.6vw,1.75rem)] font-light tracking-[-0.02em]">
                    {layer.title}
                  </span>
                  <span className={`text-[15px] leading-[1.6] ${active ? "text-landing-mist" : "text-landing-label"}`}>
                    {layer.text}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * The call to action: the only filled, bright shape on the page, so no title
 * competes with it. Dark-green ink on mint (neither pure black nor pure white).
 */
function OpenJukebox() {
  return (
    <a
      href={JUKEBOX_HASH}
      data-testid="landing-open"
      className="inline-flex items-center gap-3 rounded-full bg-landing-accent px-9 py-4 text-[18px] font-semibold text-landing-cta-ink shadow-[0_0_48px_rgba(94,233,181,0.35)] transition-[background-color,box-shadow] hover:bg-landing-accent-strong hover:shadow-[0_0_64px_rgba(94,233,181,0.5)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-landing-accent"
    >
      Open the jukebox
      <span aria-hidden="true">→</span>
    </a>
  );
}

/** Section width of the design: 1120 px with 32 px sides, narrower on small screens. */
const content = "mx-auto flex w-full max-w-[1120px] flex-col items-center px-4 text-center sm:px-8";
/** Every section fills the screen's height, so the page reads as three screens. */
const screen = "relative flex min-h-svh scroll-mt-0 flex-col justify-center overflow-hidden";
/** Titles stay thin and a step dimmer than the button, whatever their size. */
const calmTitle = "font-display font-extralight text-landing-title";

export function Landing() {
  return (
    <div data-testid="landing" className="relative h-full overflow-y-auto scroll-smooth bg-landing-deep font-text text-landing-ink">
      <header className="absolute inset-x-0 top-0 z-10 py-7">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-4 font-label sm:px-8">
          <a
            href="#top"
            className="flex flex-col gap-1 text-[12px] tracking-[0.22em] text-landing-ink sm:flex-row sm:items-baseline sm:gap-2.5"
          >
            <span>EARTH JUKEBOX</span>
            <span className="text-[11px] tracking-[0.16em] text-landing-accent">
              <span aria-hidden="true" className="max-sm:hidden">
                ·{" "}
              </span>
              {TEAM_NAME.toUpperCase()}
            </span>
          </a>
          <nav aria-label="Sections" className="flex gap-5 text-[11px] tracking-[0.16em] text-landing-label sm:gap-7">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-landing-ink">
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main>
        {/* 1 · Listen — on the forest. */}
        <section id="top" data-testid="landing-section-listen" className={`${screen} pb-[200px] pt-28`}>
          <ForestBackdrop />
          <div className={`${content} relative gap-8`}>
            <Eyebrow>NASA SPACE APPS CHALLENGE</Eyebrow>
            <h1 className={`${calmTitle} max-w-[820px] text-[clamp(2.75rem,7vw,5rem)] leading-[1.04] tracking-[-0.04em]`}>
              Listen to the Lungs of the World.
            </h1>
            <p className="max-w-[540px] text-[17px] leading-[1.6] text-landing-mist sm:text-[18px]">
              NASA Earth data about the Amazon, turned into sound. Every layer has its own voice.
            </p>
            <div className="mt-4 flex flex-col items-center gap-4">
              <OpenJukebox />
              <p className="font-label text-[11px] tracking-[0.16em] text-landing-label">HEADPHONES RECOMMENDED</p>
            </div>
          </div>
        </section>

        {/* 2 · Layers — on the planet. */}
        <section id="layers" data-testid="landing-section-layers" className={`${screen} border-t border-landing-line py-24`}>
          <div className={`${content} gap-14`}>
            <div className="flex flex-col items-center gap-5">
              <Eyebrow>THE LAYERS</Eyebrow>
              <h2 className={`${calmTitle} max-w-[820px] text-[clamp(2.25rem,4.5vw,3.25rem)] leading-[1.08] tracking-[-0.035em]`}>
                Four datasets. Four voices.
              </h2>
              <p className="max-w-[600px] text-[17px] leading-[1.6] text-landing-mist">
                Shown only as pictures, Earth science reaches only the people who can see it. Earth Jukebox translates
                NASA's visualizations into sound: the forest, the fires, the air and the storms each sound their own way.
              </p>
            </div>
            <LayerShowcase />
          </div>
        </section>

        {/* 3 · About — how to listen and who made it, back on the forest. */}
        <section id="about" data-testid="landing-section-about" className={`${screen} border-t border-landing-line pb-[220px] pt-24`}>
          <ForestBackdrop />
          <div className={`${content} relative gap-16`}>
            <div className="flex flex-col items-center gap-5">
              <Eyebrow>HOW TO LISTEN</Eyebrow>
              <h2 className={`${calmTitle} max-w-[760px] text-[clamp(2rem,4vw,2.75rem)] leading-[1.1] tracking-[-0.03em]`}>
                Four moves from silence to the rainforest.
              </h2>
            </div>
            <ol className="grid w-full gap-8 text-left sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step} className="flex flex-col gap-2 border-t border-landing-line pt-5">
                  <Eyebrow accent>{String(index + 1).padStart(2, "0")}</Eyebrow>
                  <p className="text-[16px] leading-[1.6] text-landing-mist">{step}</p>
                </li>
              ))}
            </ol>
            <ul className="grid w-full gap-10 md:grid-cols-3">
              {POINTS.map((point) => (
                <li key={point.title} className="flex flex-col items-center gap-2">
                  <h3 className="font-display text-[17px] font-light tracking-[-0.01em] text-landing-title">{point.title}</h3>
                  <p className="text-[15px] leading-[1.6] text-landing-label">{point.text}</p>
                </li>
              ))}
            </ul>
            <div className="flex flex-col items-center gap-4">
              <p className="font-label text-[11px] tracking-[0.22em] text-landing-accent">
                TEAM {TEAM_NAME.toUpperCase()} · NASA SPACE APPS CHALLENGE
              </p>
              <p className="max-w-[640px] text-[15px] leading-[1.6] text-landing-mist">{TEAM.join(" · ")}</p>
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-[15px] text-landing-accent hover:underline">
                Betha2516/Nasa-Challenge
              </a>
            </div>
            <div className="flex flex-col items-center gap-4">
              <OpenJukebox />
              <p className="font-label text-[11px] tracking-[0.16em] text-landing-label">PUT YOUR HEADPHONES ON</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-landing-line pb-12 pt-7">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 font-label text-[11px] tracking-[0.16em] text-landing-label">
          <p>EARTHJUKEBOX.TECH</p>
          <p>NOT AN OFFICIAL NASA PRODUCT</p>
        </div>
      </footer>
    </div>
  );
}
