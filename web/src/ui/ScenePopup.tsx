// Scene popup: the image, title and description of a clickable map point.
// It is plain DOM above the canvas; the scene audio is handled by the app.

import { useEffect, useRef } from "react";
import type { SceneDefinition } from "../scenes/types";

export interface ScenePopupProps {
  scene: SceneDefinition;
  onClose: () => void;
  /** Audio problem to show without closing the popup. */
  audioError?: string | null;
}

export function ScenePopup({ scene, onClose, audioError = null }: ScenePopupProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4"
      data-testid="scene-popup-backdrop"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scene-popup-title"
        data-testid="scene-popup"
        className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl bg-slate-900 p-4 text-slate-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={`./${scene.image}`}
          alt={scene.imageAlt}
          data-testid="scene-popup-image"
          className="max-h-72 w-full rounded-lg object-cover"
        />
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="scene-popup-title" data-testid="scene-popup-title" className="text-xl font-semibold">
              {scene.title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-300" data-testid="scene-popup-description">
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
            onClick={onClose}
            className="shrink-0 rounded-md border border-slate-500 px-3 py-1.5 text-sm hover:border-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
