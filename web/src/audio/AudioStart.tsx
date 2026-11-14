// Start / mute control for the sound engine (plan Step 10, block B1).
//
// Browsers keep audio locked until a user gesture, so the engine is only
// started from this button. The component is self-contained: it creates its own
// engine unless one is injected, and it disposes only what it owns.

import { useEffect, useState } from "react";
import { createSoundEngine, type SoundEngine } from "./engine";

const FULL_VOLUME = 0.8;

export interface AudioStartProps {
  engine?: SoundEngine;
  className?: string;
}

export function AudioStart({ engine: injectedEngine, className = "" }: AudioStartProps) {
  // Always create the fallback, but use the injected engine when there is one.
  // Keeping the engine in state (not in a ref that cleanup can clear) matters:
  // React StrictMode runs cleanup once on mount, and clearing the ref would make
  // the button start a different, silent engine than the one App feeds.
  const [fallbackEngine] = useState<SoundEngine>(() => createSoundEngine());
  const engine = injectedEngine ?? fallbackEngine;
  const ownsEngine = injectedEngine === undefined;
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

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
      setLevel(engine.getOutputLevel());
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
    const nextMuted = !muted;
    engine.setMasterVolume(nextMuted ? 0 : FULL_VOLUME);
    setMuted(nextMuted);
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`} data-testid="audio-controls">
      {!running ? (
        <button
          type="button"
          data-testid="audio-start"
          onClick={() => {
            void handleStart();
          }}
          className="rounded bg-emerald-500 px-4 py-2 font-medium text-black hover:bg-emerald-400"
        >
          Start sound
        </button>
      ) : (
        <button
          type="button"
          data-testid="audio-mute"
          aria-pressed={muted}
          onClick={handleMute}
          className="rounded border border-slate-500 px-4 py-2 font-medium text-slate-100 hover:border-slate-300"
        >
          {muted ? "Unmute" : "Mute"}
        </button>
      )}

      <div
        role="meter"
        aria-label="Sound output level"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={Number(level.toFixed(2))}
        data-testid="audio-meter"
        className="h-2 w-full overflow-hidden rounded bg-slate-700"
      >
        <div className="h-full origin-left bg-emerald-400" style={{ transform: `scaleX(${Math.min(1, Math.max(0, level))})` }} />
      </div>

      {error && (
        <p role="alert" data-testid="audio-error" className="text-sm text-red-300">
          The sound could not start: {error}
        </p>
      )}
    </div>
  );
}
