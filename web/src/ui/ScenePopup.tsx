// Scene popup: a nearly full-window image with the scene title and description
// written on the image itself, over a soft shade at its foot (no card, no frame
// and no dark backdrop around the picture). It fades and zooms in/out; the app
// keeps the map focused until the closing animation finishes.

import { useCallback, useEffect, useRef, useState } from "react";
import type { SceneDefinition } from "../scenes/types";

const ENTER_DELAY_MS = 550;
const EXIT_ANIMATION_MS = 300;

export interface ScenePopupProps {
  scene: SceneDefinition;
  onClose: () => void;
  /** Audio problem to show without closing the popup. */
  audioError?: string | null;
}

export function ScenePopup({
  scene,
  onClose,
  audioError = null,
}: ScenePopupProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // Let the map finish its zoom-in before the image starts fading in.
    const timer = setTimeout(() => setEntered(true), ENTER_DELAY_MS);
    return () => clearTimeout(timer);
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
      className={`fixed inset-3 z-30 overflow-hidden rounded-2xl shadow-2xl transition-opacity duration-300 sm:inset-4 ${
        shown ? "opacity-100" : "pointer-events-none opacity-0"
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
      <button
        ref={closeRef}
        type="button"
        data-testid="scene-popup-close"
        aria-label="Close scene"
        onClick={(event) => {
          event.stopPropagation();
          requestClose();
        }}
        className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-landing-ink/50 bg-landing-deep/60 text-landing-ink backdrop-blur hover:border-landing-ink hover:bg-landing-deep/80"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
        </svg>
      </button>
      {/* The text sits on the picture: only a shade rising from its foot keeps it readable. */}
      <div className="absolute inset-x-0 bottom-0 max-h-full overflow-auto bg-gradient-to-t from-landing-deep/95 via-landing-deep/60 to-transparent px-6 pb-6 pt-28 sm:px-10 sm:pb-9">
        <div className="max-w-2xl" onClick={(event) => event.stopPropagation()}>
          <h2
            id="scene-popup-title"
            data-testid="scene-popup-title"
            className="font-display text-3xl font-light tracking-[-0.02em] text-landing-ink sm:text-4xl"
          >
            {scene.title}
          </h2>
          <p
            className="mt-3 text-base leading-7 text-landing-ink/85"
            data-testid="scene-popup-description"
          >
            {scene.description}
          </p>
          {audioError && (
            <p role="alert" className="mt-2 text-sm text-amber-300">
              {audioError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
