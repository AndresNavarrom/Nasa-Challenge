// The landing page (Figma "Earth Jukebox — Landing Option B (Deep field)"):
// what the project is, its four layers, why sound, how to use it and who made
// it. "Open the jukebox" goes to #jukebox, where Root (main.tsx) loads the app;
// the landing itself loads no Earth data, so it opens at once.
//
// Composition of the first screen: by thirds. The words and the button take the
// left third; the planet takes the other two, at the eye of a golden spiral
// drawn faintly behind it, which leads the eye from the words to the planet.
// The title is kept light and moderate in size so it does not compete with the
// button, the only solid block of the accent colour on the page (60-30-10: the
// dark background, the light text and lines, the accent).
//
// Fonts are bundled (@fontsource-variable) so nothing comes from the internet.

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
import { LANDING_VIDEO, goldenSpiralPath } from "./landingMedia";

const NAV = [
  { href: "#layers", label: "LAYERS" },
  { href: "#why-sound", label: "WHY SOUND" },
  { href: "#how", label: "HOW" },
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

const POINTS = [
  {
    title: "Sound you can locate",
    text: "The audio pans between the left and right speakers as you move, so position is something you hear.",
  },
  {
    title: "The view, described",
    text: "A line of text always says where you are and what you can do next, on the globe or on the map.",
  },
  {
    title: "A tour you can repeat",
    text: "A short tour explains the controls on first visit. Press ? at any time to repeat it.",
  },
] as const;

const STEPS = [
  "Press Start sound — browsers keep audio off until you ask.",
  "Pick a layer. Only its voice plays, so you hear one dataset at a time.",
  "Drag to turn the planet. The sound follows the part of the Earth in view.",
  "Double-click a region to fly in; on its map, click a point to lock its sound and drag to move it.",
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

/**
 * The planet under the hero: each layer's planet in turn, fading into the next,
 * with the layer's name in the chip below. With reduced motion it changes
 * without the fade.
 */
function GlobeShowcase() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setShown((index) => (index + 1) % LAYERS.length), GLOBE_HOLD_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div
        data-testid="landing-globe"
        className="relative aspect-square w-full max-w-[560px] overflow-hidden rounded-full bg-[#0b111e]"
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
      <p className="rounded-full border border-landing-line bg-[#0b111e] px-4 py-2 font-label text-[13px] text-landing-mist">
        {LAYERS[shown]!.title}
      </p>
    </div>
  );
}

function OpenJukebox() {
  return (
    <a
      href={JUKEBOX_HASH}
      data-testid="landing-open"
      className="rounded-full bg-landing-accent px-9 py-4 text-[18px] font-semibold text-landing-deep shadow-[0_0_40px_rgba(94,233,181,0.28)] transition-colors hover:bg-landing-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-landing-accent"
    >
      Open the jukebox
    </a>
  );
}

/** The golden spiral behind the planet, drawn once. Its eye is the centre of its box. */
const SPIRAL = goldenSpiralPath(1000);

/** Section width of the design: 1120 px with 32 px sides, narrower on small screens. */
const content = "mx-auto flex w-full max-w-[1120px] flex-col items-center px-4 text-center sm:px-8";

export function Landing() {
  return (
    <div data-testid="landing" className="h-full overflow-y-auto scroll-smooth bg-landing-deep font-text text-landing-ink">
      <header className="py-7">
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
              SAGGITA
            </span>
          </a>
          <nav aria-label="Sections" className="flex gap-4 text-[11px] tracking-[0.16em] text-landing-label sm:gap-7">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`hover:text-landing-ink ${item.href === "#why-sound" || item.href === "#how" ? "max-sm:hidden" : ""}`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <section id="top" className="relative overflow-hidden pb-[120px] pt-10 sm:pt-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[340px] overflow-hidden">
            <img alt="" src={forestBack} className="absolute inset-[38.82%_-5.76%_0_-2.78%] block size-full max-w-none" />
            <img alt="" src={forestMiddle} className="absolute inset-[51.4%_-5.56%_0_-2.78%] block size-full max-w-none" />
            <img alt="" src={forestFront} className="absolute inset-[64.13%_-4.51%_0_-2.78%] block size-full max-w-none" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,#05070d_0%,rgba(5,7,13,0.6)_30%,rgba(5,7,13,0)_58%,rgba(5,7,13,0.55)_86%,#05070d_100%)]" />
          </div>
          <div className="relative mx-auto grid w-full max-w-[1120px] items-center gap-12 px-4 pb-[210px] sm:px-8 lg:grid-cols-3 lg:gap-8">
            {/* Left third: the words and the one thing to press. */}
            <div className="flex flex-col items-center gap-7 text-center lg:items-start lg:text-left">
              <Eyebrow>NASA SPACE APPS CHALLENGE</Eyebrow>
              <h1 className="font-display text-[clamp(2.5rem,4vw,3.25rem)] font-extralight leading-[1.08] tracking-[-0.04em]">
                Listen to <br className="max-lg:hidden" />
                the Amazon.
              </h1>
              <p className="max-w-[420px] text-[17px] leading-[1.6] text-landing-mist">
                NASA Earth data about the lungs of the world, turned into sound. Every layer has its own voice: move
                over the planet and hear how it changes from place to place.
              </p>
              <div className="flex flex-col items-center gap-3.5 pt-2 lg:items-start">
                <OpenJukebox />
                <p className="font-label text-[11px] tracking-[0.16em] text-landing-label">HEADPHONES RECOMMENDED</p>
              </div>
            </div>
            {/* The other two thirds: the planet, at the eye of the golden spiral. */}
            <div className="flex justify-center lg:col-span-2 lg:justify-end">
              <div className="relative w-full max-w-[560px]">
                {/* Its eye is the planet's centre: the box is 3.4 planets wide, moved up by 1.2. */}
                <svg
                  aria-hidden="true"
                  viewBox="-1000 -1000 2000 2000"
                  className="pointer-events-none absolute left-1/2 top-0 mt-[-120%] aspect-square w-[340%] max-w-none -translate-x-1/2 text-landing-ink"
                >
                  <path d={SPIRAL} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="2" />
                </svg>
                <div className="relative">
                  <GlobeShowcase />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="layers" className="scroll-mt-4 pb-[120px] pt-10">
          <div className={`${content} gap-[72px]`}>
            <div className="flex flex-col items-center gap-5">
              <Eyebrow>THE LAYERS</Eyebrow>
              <h2 className="max-w-[820px] font-display text-[clamp(2.5rem,5.5vw,3.75rem)] font-extralight leading-[1.08] tracking-[-0.04em]">
                Four datasets. Four voices.
              </h2>
              <p className="max-w-[560px] text-[18px] leading-[1.6] text-landing-mist">
                Pick them one at a time and learn each voice: the forest, the fires, the air and the storms each
                sound their own way.
              </p>
            </div>
            <ol className="w-full border-b border-landing-line">
              {LAYERS.map((layer, index) => (
                <li key={layer.title} className="flex flex-col items-center gap-3.5 border-t border-landing-line py-14">
                  <Eyebrow accent>{String(index + 1).padStart(2, "0")}</Eyebrow>
                  <h3 className="max-w-[620px] font-display text-[clamp(2rem,4vw,2.375rem)] font-light tracking-[-0.03em]">
                    {layer.title}
                  </h3>
                  <p className="max-w-[520px] text-[17px] leading-[1.6] text-landing-mist">{layer.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="why-sound" className="scroll-mt-4 pb-[120px] pt-24">
          <div className={`${content} gap-16`}>
            <div className="flex flex-col items-center gap-7">
              <Eyebrow>WHY SOUND</Eyebrow>
              <h2 className="max-w-[900px] font-display text-[clamp(2.5rem,6vw,4.25rem)] font-extralight leading-[1.04] tracking-[-0.045em]">
                Earth science shouldn't stop at the eyes.
              </h2>
              <p className="max-w-[620px] text-[18px] leading-[1.6] text-landing-mist">
                NASA's Earth Information Center shows our changing planet through striking visualizations. Shown only
                as pictures, that science reaches only the people who can see it. Earth Jukebox translates sight into
                sound, so the same data can be heard.
              </p>
            </div>
            <ul className="grid w-full gap-12 md:grid-cols-3">
              {POINTS.map((point) => (
                <li key={point.title} className="flex flex-col items-center gap-2.5">
                  <h3 className="font-display text-[19px] tracking-[-0.015em]">{point.title}</h3>
                  <p className="text-[16px] leading-[1.6] text-landing-mist">{point.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className="scroll-mt-4 pb-[120px]">
          <div className={`${content} gap-14`}>
            <h2 className="max-w-[760px] font-display text-[clamp(2.25rem,5vw,3.25rem)] font-extralight leading-[1.08] tracking-[-0.04em]">
              Four moves from silence to the rainforest.
            </h2>
            <ol className="flex w-full flex-col items-center gap-8">
              {STEPS.map((step, index) => (
                <li key={step} className="flex flex-col items-center gap-2">
                  <Eyebrow accent>{String(index + 1).padStart(2, "0")}</Eyebrow>
                  <p className="max-w-[560px] text-[18px] leading-[1.6]">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {LANDING_VIDEO && (
          <section id="video" className="scroll-mt-4 border-t border-landing-line py-24">
            <div className={`${content} gap-10`}>
              <div className="flex flex-col items-center gap-5">
                <Eyebrow>THE VIDEO</Eyebrow>
                <h2 className="max-w-[760px] font-display text-[clamp(2.25rem,5vw,3.25rem)] font-extralight leading-[1.08] tracking-[-0.04em]">
                  {LANDING_VIDEO.title}
                </h2>
              </div>
              <video
                data-testid="landing-video"
                controls
                preload="metadata"
                playsInline
                poster={LANDING_VIDEO.poster}
                aria-label={LANDING_VIDEO.title}
                className="aspect-video w-full max-w-[960px] rounded-2xl border border-landing-line bg-[#0b111e]"
              >
                <source src={LANDING_VIDEO.src} type={LANDING_VIDEO.type} />
              </video>
              <div className="flex flex-col items-center gap-3">
                <p className="max-w-[620px] text-[17px] leading-[1.6] text-landing-mist">{LANDING_VIDEO.thanks}</p>
                <p className="font-label text-[11px] tracking-[0.22em] text-landing-accent">MADE BY</p>
                <p className="max-w-[620px] text-[16px] leading-[1.6] text-landing-mist">{TEAM.join(" · ")}</p>
              </div>
            </div>
          </section>
        )}

        <section id="about" className="scroll-mt-4 border-t border-landing-line py-24">
          <div className={`${content} gap-10`}>
            <div className="flex flex-col items-center gap-5">
              <Eyebrow>ABOUT</Eyebrow>
              <h2 className="max-w-[700px] font-display text-[clamp(1.875rem,4vw,2.25rem)] font-light leading-[1.12] tracking-[-0.03em]">
                Built for the NASA Space Apps Challenge.
              </h2>
              <p className="max-w-[560px] text-[17px] leading-[1.6] text-landing-mist">
                Our answer to the Earth Jukebox challenge: pair Earth Information Center visuals with sonifications
                generated in real time, balancing faithful data with sound that is pleasant to listen to.
              </p>
            </div>
            <div className="flex flex-col items-center gap-[18px]">
              <p className="font-label text-[11px] tracking-[0.22em] text-landing-accent">TEAM SAGGITA</p>
              <p className="max-w-[620px] text-[16px] leading-[1.6] text-landing-mist">{TEAM.join(" · ")}</p>
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-[16px] text-landing-accent hover:underline">
                Betha2516/Nasa-Challenge
              </a>
            </div>
          </div>
        </section>

        <section className="border-t border-landing-line py-32">
          <div className={`${content} gap-8`}>
            <h2 className="max-w-[900px] font-display text-[clamp(3rem,8vw,5.5rem)] font-extralight leading-none tracking-[-0.05em]">
              Put your headphones on.
            </h2>
            <p className="max-w-[460px] text-[18px] leading-[1.6] text-landing-mist">
              The lungs of the world are playing right now.
            </p>
            <OpenJukebox />
          </div>
        </section>
      </main>

      <footer className="pb-12 pt-7">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 font-label text-[11px] tracking-[0.16em] text-landing-label">
          <p>EARTHJUKEBOX.TECH</p>
          <p>NOT AN OFFICIAL NASA PRODUCT</p>
        </div>
      </footer>
    </div>
  );
}
