// The listening point (FR4.3): the place under the cursor that the sound engine
// (plan Step 10) reads, without depending on the 3D scene.
//
//   const point = useListeningPoint();   // { lon, lat, screenX } or null
//
// It is null when the cursor is outside the planet or the map, and during the
// whole transition between them. `screenX` is 0 at the left edge of the 3D
// canvas and 1 at its right edge.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface ListeningPoint {
  /** Longitude in degrees, -180..180. */
  lon: number;
  /** Latitude in degrees, -90..90. */
  lat: number;
  /** Horizontal position in the 3D canvas, 0 (left) to 1 (right). */
  screenX: number;
}

type SetListeningPoint = (point: ListeningPoint | null) => void;

const ListeningPointContext = createContext<ListeningPoint | null>(null);
// The setter lives in its own context so writers do not re-render on every move.
const SetListeningPointContext = createContext<SetListeningPoint | null>(null);

function samePoint(a: ListeningPoint | null, b: ListeningPoint | null): boolean {
  if (a === null || b === null) return a === b;
  return a.lon === b.lon && a.lat === b.lat && a.screenX === b.screenX;
}

export function ListeningPointProvider({ children }: { children: ReactNode }) {
  const [point, setPoint] = useState<ListeningPoint | null>(null);
  const update = useCallback<SetListeningPoint>((next) => {
    setPoint((previous) => (samePoint(previous, next) ? previous : next));
  }, []);
  return (
    <SetListeningPointContext.Provider value={update}>
      <ListeningPointContext.Provider value={point}>{children}</ListeningPointContext.Provider>
    </SetListeningPointContext.Provider>
  );
}

/** The current listening point, or null when nothing is under the cursor. */
export function useListeningPoint(): ListeningPoint | null {
  return useContext(ListeningPointContext);
}

/** Setter used by the scene. Throws when called outside ListeningPointProvider. */
export function useSetListeningPoint(): SetListeningPoint {
  const setter = useContext(SetListeningPointContext);
  if (!setter) {
    throw new Error("useSetListeningPoint must be used inside <ListeningPointProvider>.");
  }
  return setter;
}
