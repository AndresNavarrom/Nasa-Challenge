// Which page an address opens: the jukebox for #jukebox, the credits for
// #credits, the landing page for anything else (its own section links such as
// #layers included).

/** Hash of the jukebox page; the landing page's buttons link to it. */
export const JUKEBOX_HASH = "#jukebox";

/** Hash of the credits page; the landing page's Credits button links to it. */
export const CREDITS_HASH = "#credits";

/** True when `hash` (window.location.hash) opens the jukebox. */
export function isJukeboxHash(hash: string): boolean {
  return hash.toLowerCase() === JUKEBOX_HASH;
}

/** True when `hash` (window.location.hash) opens the credits page. */
export function isCreditsHash(hash: string): boolean {
  return hash.toLowerCase() === CREDITS_HASH;
}

export type Page = "landing" | "credits" | "jukebox";

/** The page an address opens. */
export function pageForHash(hash: string): Page {
  if (isJukeboxHash(hash)) return "jukebox";
  if (isCreditsHash(hash)) return "credits";
  return "landing";
}
