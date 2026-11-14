// Owns one sound engine for the lifetime of the component that calls it.
//
// Kept separate from App.tsx so the scene (Step 12) and the controls (Steps
// 13-14) can share the same engine without creating another AudioContext.

import { useEffect, useRef } from "react";
import { createSoundEngine, type SoundEngine } from "./engine";

export function useSoundEngine(): SoundEngine {
  const engineRef = useRef<SoundEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = createSoundEngine();
  }
  const engine = engineRef.current;

  useEffect(() => {
    return () => {
      engine.dispose();
    };
  }, [engine]);

  return engine;
}
