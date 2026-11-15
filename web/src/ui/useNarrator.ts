// Owns one narrator (narrator.ts) for the lifetime of the component that calls
// it, and mirrors whether it is on and whether it is speaking into React state.

import { useCallback, useEffect, useRef, useState } from "react";
import { Narrator, browserSpeech } from "./narrator";
import { narratorTogglePhrase } from "./narration";
import { browserFlagStore } from "./tourSteps";

export interface NarratorHandle {
  narrator: Narrator;
  /** False where the browser cannot speak: the Voice button is hidden. */
  supported: boolean;
  enabled: boolean;
  speaking: boolean;
  /** Switches the narrator on or off and says so. */
  toggle: () => void;
}

export function useNarrator(): NarratorHandle {
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const narratorRef = useRef<Narrator | null>(null);
  narratorRef.current ??= new Narrator({
    ...browserSpeech(),
    store: browserFlagStore(),
    onSpeakingChange: setSpeaking,
    onEnabledChange: setEnabled,
  });
  const narrator = narratorRef.current;

  // The remembered choice is read in the constructor; show it once mounted.
  useEffect(() => {
    setEnabled(narrator.enabled);
    return () => narrator.stop();
  }, [narrator]);

  const toggle = useCallback(() => {
    const on = !narrator.enabled;
    narrator.setEnabled(on, narratorTogglePhrase(on));
  }, [narrator]);

  return { narrator, supported: narrator.supported, enabled, speaking, toggle };
}
