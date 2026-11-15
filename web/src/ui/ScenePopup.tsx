// Scene popup: a nearly full-window image with the scene title and description
// floating in a card at the top right. It fades and zooms in/out; the app keeps
// the map focused until the closing animation finishes.

import { useCallback, useEffect, useRef, useState } from "react";
import type { SceneDefinition } from "../scenes/types";

const EXIT_ANIMATION_MS = 300;

export interface ScenePopupProps {
  scene: SceneDefinition;
  onClose: () => void;
  /** Audio problem to show without closing the popup. */
  audioError?: string | null;
}

export function ScenePopup({ scene, onClose, audioError = null }: ScenePopupProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    timerRef.current = setTimeout(onClose, EXIT_ANIMATION_MS);
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  const shown = entered && !closing;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scene-popup-title"
      data-testid="scene-popup"
      onClick={requestClose}
      className={`fixed inset-3 z-30 overflow-hidden rounded-xl bg-slate-950/80 shadow-2xl transition-opacity duration-300 sm:inset-4 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
    >
      <img
        src={`./${scene.image}`}
        alt={scene.imageAlt}
        data-testid="scene-popup-image"
        className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 ${
          shown ? "scale-100" : "scale-105"
        }`}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-slate-950/20" />
      <div
        className="absolute right-4 top-4 z-10 max-h-[calc(100%-2rem)] w-full max-w-md overflow-auto rounded-xl bg-slate-950/80 p-5 text-slate-100 shadow-xl backdrop-blur"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="scene-popup-title" data-testid="scene-popup-title" className="text-xl font-semibold">
              {scene.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300" data-testid="scene-popup-description">
              {scene.description}
            </p>
            {audioError && (
              <p role="alert" className="mt-2 text-sm text-amber-300">
                {audioError}
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            data-testid="scene-popup-close"
            aria-label="Close scene"
            onClick={requestClose}
            className="shrink-0 rounded-md border border-slate-500 px-3 py-1.5 text-sm hover:border-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
