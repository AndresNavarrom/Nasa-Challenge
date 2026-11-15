// Chooses the page: the landing page, or the jukebox when the address ends in
// #jukebox ("Open the jukebox"). The jukebox (three.js, the Earth data) is
// loaded only then, so the landing opens fast. The browser's back button
// returns from the jukebox to the landing page.

import { lazy, Suspense, useEffect, useState } from "react";
import { isJukeboxHash } from "./ui/landingRoute";
import { Landing } from "./ui/Landing";

const App = lazy(() => import("./App"));

export function Root() {
  const [jukebox, setJukebox] = useState(() => isJukeboxHash(window.location.hash));

  useEffect(() => {
    const onHashChange = (): void => setJukebox(isJukeboxHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (!jukebox) return <Landing />;
  return (
    <Suspense
      fallback={
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <h1 className="font-label text-sm font-medium uppercase tracking-[0.22em]">Earth Jukebox</h1>
          <p role="status" className="text-landing-mist">
            Loading…
          </p>
        </div>
      }
    >
      <App />
    </Suspense>
  );
}
