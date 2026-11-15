// Start / mute control for the sound engine (plan Step 10, block B1).
//
// Browsers keep audio locked until a user gesture, so the engine is only
// started from this button. The component is self-contained: it creates its own
// engine unless one is injected, and it disposes only what it owns.

import { useEffect, useRef, useState } from "react";
import { SpeakerIcon } from "../ui/icons";
import { createSoundEngine, type SoundEngine } from "./engine";

const FULL_VOLUME = 0.8;
/** The meter and aria-valuenow change at most this often; the ear does not need 60 Hz. */
const LEVEL_INTERVAL_MS = 100;

export interface AudioStartProps {
  engine?: SoundEngine;
  className?: string;
  /**
   * "round": the HUD's side control. "Start sound" is a labelled accent pill (the
   * one thing to press first); once the sound runs it becomes a round speaker
   * button like its neighbours, with the level bar under it.
   */
  variant?: "panel" | "round";
}

export function AudioStart({ engine: injectedEngine, className = "", variant = "panel" }: AudioStartProps) {
  // Always create the fallback, but use the injected engine when there is one.
  // Keeping the engine in state (not in a ref that cleanup can clear) matters:
  // React StrictMode runs cleanup once on mount, and clearing the ref would make
  // the button start a different, silent engine than the one App feeds.
  const [fallbackEngine] = useState<SoundEngine>(() => createSoundEngine());
  const engine = injectedEngine ?? fallbackEngine;
  const ownsEngine = injectedEngine === undefined;
  // An engine that already runs (the HUD swaps its layout when the window is
  // resized, which mounts this control again) shows "Mute", not "Start sound".
  const [running, setRunning] = useState(() => engine.state === "running");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const lastLevelAt = useRef(0);

  useEffect(() => {
    return () => {
      if (ownsEngine) {
        fallbackEngine.dispose();
      }
    };
  }, [ownsEngine, fallbackEngine]);

  useEffect(() => {
    if (!running) {
      setLevel(0);
      return;
    }
    let frame = 0;
    const tick = (): void => {
      // The system (or the page) can suspend the context; do not keep saying "Mute".
      if (engine.state !== "running") {
        setRunning(false);
        return;
      }
      const now = performance.now();
      if (now - lastLevelAt.current >= LEVEL_INTERVAL_MS) {
        lastLevelAt.current = now;
        setLevel(engine.getOutputLevel());
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [engine, running]);

  const handleStart = async (): Promise<void> => {
    setError(null);
    try {
      await engine.start();
      setRunning(true);
      setMuted(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const handleMute = (): void => {
    // Mute is a fade to zero, not a context suspend: unmuting is instant and
    // needs no extra user gesture (team decision on the PR review).
    const nextMuted = !muted;
    engine.setMasterVolume(nextMuted ? 0 : FULL_VOLUME);
    setMuted(nextMuted);
  };

  const round = variant === "round";

  return (
    <div
      className={`flex flex-col gap-2 ${round ? "items-start" : ""} ${className}`}
      data-testid="audio-controls"
    >
      {!running ? (
        <button
          type="button"
          data-testid="audio-start"
          onClick={() => {
            void handleStart();
          }}
          className={
            round
              ? "flex h-11 items-center gap-2 rounded-full bg-landing-accent pl-3 pr-4 font-medium text-landing-deep shadow-lg hover:bg-landing-ink"
              : "rounded-full bg-landing-accent px-4 py-2 font-medium text-landing-deep hover:bg-landing-ink"
          }
        >
          {round && <SpeakerIcon />}
          Start sound
        </button>
      ) : (
        <button
          type="button"
          data-testid="audio-mute"
          aria-pressed={muted}
          aria-label={round ? (muted ? "Unmute" : "Mute") : undefined}
          title={round ? (muted ? "Unmute" : "Mute") : undefined}
          onClick={handleMute}
          className={
            round
              ? `flex h-11 w-11 items-center justify-center rounded-full border bg-landing-deep/85 shadow-lg backdrop-blur ${
                  muted
                    ? "border-landing-line text-landing-label hover:border-landing-label"
                    : "border-landing-accent text-landing-accent hover:border-landing-ink hover:text-landing-ink"
                }`
              : "rounded-full border border-landing-label px-4 py-2 font-medium text-landing-ink hover:border-landing-ink"
          }
        >
          {round ? <SpeakerIcon muted={muted} /> : muted ? "Unmute" : "Mute"}
        </button>
      )}

      <div
        role="meter"
        aria-label="Sound output level"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={Number(level.toFixed(2))}
        data-testid="audio-meter"
        className={`h-1.5 overflow-hidden rounded-full bg-landing-line ${round ? "w-11" : "w-full"}`}
      >
        <div className="h-full origin-left bg-landing-accent" style={{ transform: `scaleX(${Math.min(1, Math.max(0, level))})` }} />
      </div>

      {error && (
        <p role="alert" data-testid="audio-error" className={`text-sm text-red-300 ${round ? "max-w-40" : ""}`}>
          The sound could not start: {error}
        </p>
      )}
    </div>
  );
}
