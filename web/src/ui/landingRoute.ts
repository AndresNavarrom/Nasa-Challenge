// Which page an address opens: the jukebox for #jukebox, the landing page for
// anything else (its own section links such as #layers included).

/** Hash of the jukebox page; the landing page's buttons link to it. */
export const JUKEBOX_HASH = "#jukebox";

/** True when `hash` (window.location.hash) opens the jukebox. */
export function isJukeboxHash(hash: string): boolean {
  return hash.toLowerCase() === JUKEBOX_HASH;
}
