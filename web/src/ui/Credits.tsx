// The credits page (#credits): every NASA resource, sound, dataset, tool and
// reference the project uses (credits.ts), grouped as in the team's reference
// sheet. Reached from the Credits button of the landing page; "Back" returns
// to it. Same look as the landing: deep background, calm titles, no pure black
// or pure white.

import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/sora";
import { CREDIT_GROUPS, creditHost } from "./creditList";
import { TEAM_NAME } from "./Landing";

/** Where "Back" goes: the top of the landing page. */
export const BACK_HREF = "#top";

function BackLink() {
  return (
    <a
      href={BACK_HREF}
      data-testid="credits-back"
      className="rounded-full border border-landing-line px-4 py-1.5 font-label text-[11px] tracking-[0.16em] text-landing-mist transition-colors hover:border-landing-label hover:text-landing-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-landing-accent"
    >
      <span aria-hidden="true">← </span>BACK
    </a>
  );
}

export function Credits() {
  return (
    <div
      data-testid="credits"
      className="relative h-full overflow-y-auto bg-landing-deep font-text text-landing-ink"
    >
      <header className="py-7">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-4 font-label sm:px-8">
          <a
            href={BACK_HREF}
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
          <BackLink />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-16 px-4 pb-24 pt-10 sm:px-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <p className="font-label text-[11px] tracking-[0.26em] text-landing-label">CREDITS</p>
          <h1 className="max-w-[820px] font-display text-[clamp(2.25rem,5vw,3.25rem)] font-extralight leading-[1.08] tracking-[-0.035em] text-landing-title">
            The data, sounds and tools behind the jukebox.
          </h1>
          <p className="max-w-[600px] text-[17px] leading-[1.6] text-landing-mist">
            Earth Jukebox is built on NASA Earth science and on the generous work of many others. Every link opens
            the original source.
          </p>
          <nav aria-label="Credit groups" className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-label text-[11px] tracking-[0.16em] text-landing-label">
            {CREDIT_GROUPS.map((group) => (
              <a key={group.id} href={`#credits-${group.id}`} className="hover:text-landing-ink" onClick={(event) => {
                // The page lives under #credits: scroll to the group without changing the address.
                event.preventDefault();
                document.getElementById(`credits-${group.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}>
                {group.title.toUpperCase()}
              </a>
            ))}
          </nav>
        </div>

        {CREDIT_GROUPS.map((group) => (
          <section
            key={group.id}
            id={`credits-${group.id}`}
            aria-labelledby={`credits-${group.id}-title`}
            className="scroll-mt-6 border-t border-landing-line pt-10"
          >
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2
                id={`credits-${group.id}-title`}
                className="font-display text-[clamp(1.5rem,3vw,2rem)] font-light tracking-[-0.02em] text-landing-title"
              >
                {group.title}
              </h2>
              <p className="shrink-0 font-label text-[11px] tracking-[0.16em] text-landing-label">
                {group.items.length}
              </p>
            </div>
            <ul className="grid gap-x-10 gap-y-4 md:grid-cols-2">
              {group.items.map((credit) => (
                <li key={credit.url} className="flex flex-col gap-1">
                  <a
                    href={credit.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[15px] leading-[1.55] text-landing-ink underline decoration-landing-line underline-offset-4 transition-colors hover:text-landing-accent hover:decoration-landing-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-landing-accent"
                  >
                    {credit.text}
                  </a>
                  <span className="font-label text-[11px] tracking-[0.08em] text-landing-label">
                    {creditHost(credit.url)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="flex justify-center border-t border-landing-line pt-10">
          <BackLink />
        </div>
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
