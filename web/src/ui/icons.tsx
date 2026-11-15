// Line icons of the HUD, drawn here so nothing is downloaded. Each takes the
// text colour of its button and is hidden from screen readers: the button it
// sits in carries the name.

import type { ReactNode } from "react";

function Icon({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function EarthIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
    </Icon>
  );
}

export function ForestIcon() {
  return (
    <Icon>
      <path d="M12 3l5 7h-3l4 6H6l4-6H7l5-7zM12 16v5" />
    </Icon>
  );
}

export function SmokeIcon() {
  return (
    <Icon>
      <path d="M12 21c-3.3 0-5.5-2.2-5.5-5 0-2.6 1.8-4 2.6-6 .4 1.3 1 2 1.9 2.4C10.6 9 11.6 5.6 14 3c.2 3.2 3.5 6.2 3.5 12 0 3.3-2.2 6-5.500 6z" />
    </Icon>
  );
}

export function Co2Icon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <text x="10" y="15.5" textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily="inherit">
        CO
      </text>
      <text x="20.5" y="18.5" textAnchor="middle" fontSize="7" fontWeight="700" fontFamily="inherit">
        2
      </text>
    </svg>
  );
}

export function LightningIcon() {
  return (
    <Icon>
      <path d="M13 2L5 13.5h6L10 22l8-11.500h-6L13 2z" />
    </Icon>
  );
}

/** A layer the HUD has no icon for. */
export function LayerIcon() {
  return (
    <Icon>
      <path d="M12 4l9 4.500-9 4.500-9-4.500L12 4zM3 13l9 4.500 9-4.500" />
    </Icon>
  );
}

export function RotateIcon() {
  return (
    <Icon>
      <path d="M20 12a8 8 0 1 1-2.600-5.900M20 4v4.500h-4.500" />
    </Icon>
  );
}

/** Fly to a region: a map pin. */
export function PinIcon() {
  return (
    <Icon>
      <path d="M12 21s-6.500-6.100-6.500-11a6.500 6.500 0 0 1 13 0c0 4.900-6.500 11-6.500 11z" />
      <circle cx="12" cy="10" r="2.300" />
    </Icon>
  );
}

/** Back to the planet: an arrow pointing back. */
export function BackIcon() {
  return (
    <Icon>
      <path d="M10 6l-6 6 6 6M4 12h16" />
    </Icon>
  );
}

export function SpeakerIcon({ muted = false }: { muted?: boolean }) {
  return (
    <Icon>
      <path d="M4 9.500v5h3.500L12 18.500v-13L7.500 9.500H4z" />
      {muted ? <path d="M16 9.500l5 5M21 9.500l-5 5" /> : <path d="M15.500 9a4.500 4.500 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11" />}
    </Icon>
  );
}

export function PlayIcon() {
  return (
    <Icon className="h-4 w-4">
      <path d="M8 5.500v13l10-6.500-10-6.500z" fill="currentColor" />
    </Icon>
  );
}

export function PauseIcon() {
  return (
    <Icon className="h-4 w-4">
      <path d="M8.500 5.500v13M15.500 5.500v13" strokeWidth="2.600" />
    </Icon>
  );
}

/** Points up while the panel is open (press to fold) and down while folded. */
export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <Icon className="h-4 w-4">
      <path d={open ? "M6 14.500l6-6 6 6" : "M6 9.500l6 6 6-6"} />
    </Icon>
  );
}
