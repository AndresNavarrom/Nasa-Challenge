// The narrator: reads the app aloud with the browser's own voice (the Web
// Speech API, `speechSynthesis`). It is off until the person switches it on
// (the V key or the Voice button), because someone who already uses a screen
// reader would otherwise hear everything twice. The choice is remembered in
// this browser.
//
// The browser's speech API is passed in, so tests can use a fake.

import type { FlagStore } from "./tourSteps";
import { NARRATION_LANG, pickVoice } from "./narration";

/** Where this browser remembers that the narrator is on. */
export const NARRATOR_ON_KEY = "earth-jukebox:narrator-on";

/** The parts of `window.speechSynthesis` the narrator uses. */
export interface SpeechSynth {
  speak(utterance: SpeechUtteranceLike): void;
  cancel(): void;
  getVoices(): SpeechSynthesisVoice[];
}

/** The parts of `SpeechSynthesisUtterance` the narrator uses. */
export interface SpeechUtteranceLike {
  text: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  rate: number;
  onend: ((event: never) => void) | null;
  onerror: ((event: never) => void) | null;
}

export interface NarratorOptions {
  /** null where the browser has no speech synthesis: the narrator stays silent. */
  synth: SpeechSynth | null;
  createUtterance: (text: string) => SpeechUtteranceLike;
  store: FlagStore | null;
  /** Called when speaking starts and when it ends, to lower the data sound meanwhile. */
  onSpeakingChange?: (speaking: boolean) => void;
  /** Called when the narrator is switched on or off. */
  onEnabledChange?: (enabled: boolean) => void;
  lang?: string;
  rate?: number;
}

export interface SpeakOptions {
  /** Speak even while the narrator is off (an explicit request: the I and H keys). */
  force?: boolean;
}

export class Narrator {
  private readonly synth: SpeechSynth | null;
  private readonly createUtterance: (text: string) => SpeechUtteranceLike;
  private readonly store: FlagStore | null;
  private readonly onSpeakingChange?: (speaking: boolean) => void;
  private readonly onEnabledChange?: (enabled: boolean) => void;
  private readonly lang: string;
  private readonly rate: number;
  private on: boolean;
  private current: SpeechUtteranceLike | null = null;

  constructor(options: NarratorOptions) {
    this.synth = options.synth;
    this.createUtterance = options.createUtterance;
    this.store = options.store;
    this.onSpeakingChange = options.onSpeakingChange;
    this.onEnabledChange = options.onEnabledChange;
    this.lang = options.lang ?? NARRATION_LANG;
    this.rate = options.rate ?? 1;
    this.on = this.supported && readFlag(this.store);
  }

  /** False where the browser cannot speak. */
  get supported(): boolean {
    return this.synth !== null;
  }

  get enabled(): boolean {
    return this.on;
  }

  get speaking(): boolean {
    return this.current !== null;
  }

  /** Switches the narrator on or off, remembers it and says so. */
  setEnabled(on: boolean, announcement?: string): void {
    if (!this.supported || on === this.on) return;
    this.on = on;
    writeFlag(this.store, on);
    this.onEnabledChange?.(on);
    if (announcement) this.speak(announcement, { force: true });
    else if (!on) this.stop();
  }

  /**
   * Says `text`, cutting off whatever was being said, so the latest change is
   * the one heard. Does nothing while the narrator is off, unless forced.
   */
  speak(text: string, options: SpeakOptions = {}): void {
    const synth = this.synth;
    if (!synth || text.trim() === "") return;
    if (!this.on && !options.force) return;
    const wasSpeaking = this.current !== null;
    this.current = null;
    try {
      synth.cancel();
      const utterance = this.createUtterance(text);
      utterance.lang = this.lang;
      utterance.voice = pickVoice(synth.getVoices(), this.lang);
      utterance.rate = this.rate;
      const finish = (): void => {
        // The one cut off by `cancel` also ends: only the latest one counts.
        if (this.current !== utterance) return;
        this.current = null;
        this.onSpeakingChange?.(false);
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      this.current = utterance;
      synth.speak(utterance);
      if (!wasSpeaking) this.onSpeakingChange?.(true);
    } catch (cause) {
      console.error("Earth Jukebox: the narrator could not speak:", cause);
      this.current = null;
      if (wasSpeaking) this.onSpeakingChange?.(false);
    }
  }

  /** Stops speaking at once. */
  stop(): void {
    const wasSpeaking = this.current !== null;
    this.current = null;
    try {
      this.synth?.cancel();
    } catch (cause) {
      console.error("Earth Jukebox: the narrator could not stop:", cause);
    }
    if (wasSpeaking) this.onSpeakingChange?.(false);
  }
}

function readFlag(store: FlagStore | null): boolean {
  if (!store) return false;
  try {
    return store.getItem(NARRATOR_ON_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFlag(store: FlagStore | null, on: boolean): void {
  if (!store) return;
  try {
    store.setItem(NARRATOR_ON_KEY, on ? "1" : "0");
  } catch {
    // Private window or blocked storage: the narrator simply starts off next time.
  }
}

/** The browser's speech synthesis, or null where it has none. */
export function browserSpeech(): Pick<NarratorOptions, "synth" | "createUtterance"> {
  const available =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function";
  if (!available) {
    return { synth: null, createUtterance: () => { throw new Error("No speech synthesis."); } };
  }
  return {
    synth: window.speechSynthesis as unknown as SpeechSynth,
    createUtterance: (text) => new window.SpeechSynthesisUtterance(text) as unknown as SpeechUtteranceLike,
  };
}

/** True when a key press is typing into a control that needs its letters (a list, a text box). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as { tagName?: string; type?: string; isContentEditable?: boolean };
  if (element.isContentEditable) return true;
  const tag = element.tagName?.toUpperCase();
  if (tag === "SELECT" || tag === "TEXTAREA") return true;
  if (tag !== "INPUT") return false;
  const type = (element.type ?? "text").toLowerCase();
  return !["checkbox", "radio", "button", "submit", "reset", "range"].includes(type);
}
