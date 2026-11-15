// Parts of the landing page kept apart from its layout: the video of the
// project and the golden spiral drawn behind the planet.

export interface LandingVideo {
  /** File served with the app (web/public), so it plays without the internet. */
  src: string;
  /** MIME type of the file ("video/mp4"). */
  type: string;
  /** Still shown before it plays, also served with the app. */
  poster?: string;
  /** Heading of the section. */
  title: string;
  /** The thanks under the video. */
  thanks: string;
}

/**
 * The project's video. null until the team has the file: the landing then
 * shows no video section at all (no empty frame). To publish it, put the file
 * in web/public/video/ and fill this in, for example:
 *
 *   { src: "./video/earth-jukebox.mp4", type: "video/mp4", poster: "./video/earth-jukebox.jpg",
 *     title: "Earth Jukebox in two minutes.", thanks: "Thank you for listening. ..." }
 */
export const LANDING_VIDEO: LandingVideo | null = null;

/** The golden ratio: each quarter turn of the spiral is this many times farther from its eye. */
const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * SVG path of a golden spiral around (0, 0): it starts `turns` turns in, near
 * the eye, and opens out to `radius`. Every quarter turn its distance from the
 * eye grows by the golden ratio. Points are 1/72 of a turn apart, joined by lines.
 */
export function goldenSpiralPath(radius: number, turns = 3): string {
  const steps = Math.max(1, Math.round(turns * 72));
  const parts: string[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const turn = (step / steps) * turns;
    // `turns` turns before the end, the distance is radius / PHI^(4 * turns).
    const distance = radius * PHI ** (4 * (turn - turns));
    const angle = turn * 2 * Math.PI;
    const x = distance * Math.cos(angle);
    const y = distance * Math.sin(angle);
    parts.push(`${step === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join("");
}
