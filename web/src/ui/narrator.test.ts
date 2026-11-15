import { describe, expect, it, vi } from "vitest";
import appSource from "../App.tsx?raw";
import planetHudSource from "./PlanetHud.tsx?raw";
import {
  NARRATOR_ON_KEY,
  Narrator,
  isTypingTarget,
  type SpeechSynth,
  type SpeechUtteranceLike,
} from "./narrator";
import type { FlagStore } from "./tourSteps";

/** A fake speechSynthesis: keeps what was said; `finish` ends the current utterance like the browser. */
function fakeSynth(voices: { lang: string; default: boolean; localService: boolean }[] = []) {
  const spoken: SpeechUtteranceLike[] = [];
  let current: SpeechUtteranceLike | null = null;
  const synth: SpeechSynth & { spoken: SpeechUtteranceLike[]; finish: () => void; cancels: number } = {
    spoken,
    cancels: 0,
    speak(utterance) {
      spoken.push(utterance);
      current = utterance;
    },
    cancel() {
      synth.cancels += 1;
      const cut = current;
      current = null;
      // Browsers end the cut-off utterance with an "interrupted" error.
      cut?.onerror?.(undefined as never);
    },
    getVoices: () => voices as unknown as SpeechSynthesisVoice[],
    finish() {
      const done = current;
      current = null;
      done?.onend?.(undefined as never);
    },
  };
  return synth;
}

function utterance(text: string): SpeechUtteranceLike {
  return { text, lang: "", voice: null, rate: 0, onend: null, onerror: null };
}

function memoryStore(initial: Record<string, string> = {}): FlagStore & { values: Map<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

const brokenStore: FlagStore = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

function narrator(options: { store?: FlagStore | null; synth?: SpeechSynth | null } = {}) {
  const synth = options.synth === undefined ? fakeSynth() : options.synth;
  const speaking = vi.fn();
  const enabled = vi.fn();
  const instance = new Narrator({
    synth,
    createUtterance: utterance,
    store: options.store === undefined ? memoryStore() : options.store,
    onSpeakingChange: speaking,
    onEnabledChange: enabled,
  });
  return { instance, synth, speaking, enabled };
}

describe("Narrator", () => {
  it("starts off and stays silent until switched on", () => {
    const { instance, synth } = narrator();
    expect(instance.enabled).toBe(false);
    instance.speak("Wildfire smoke.");
    expect((synth as ReturnType<typeof fakeSynth>).spoken).toHaveLength(0);
  });

  it("speaks a forced request even while off (the I and H keys)", () => {
    const { instance, synth } = narrator();
    instance.speak("You are on the planet view.", { force: true });
    expect((synth as ReturnType<typeof fakeSynth>).spoken.map((u) => u.text)).toEqual(["You are on the planet view."]);
  });

  it("remembers being switched on, and says so", () => {
    const store = memoryStore();
    const { instance, synth, enabled } = narrator({ store });
    instance.setEnabled(true, "Narrator on.");
    expect(instance.enabled).toBe(true);
    expect(enabled).toHaveBeenCalledWith(true);
    expect(store.values.get(NARRATOR_ON_KEY)).toBe("1");
    expect((synth as ReturnType<typeof fakeSynth>).spoken.at(-1)?.text).toBe("Narrator on.");
    expect(narrator({ store }).instance.enabled).toBe(true);
  });

  it("cuts off what it was saying for the latest change, and reports speaking once", () => {
    const synth = fakeSynth();
    const { instance, speaking } = narrator({ store: memoryStore({ [NARRATOR_ON_KEY]: "1" }), synth });
    instance.speak("Forest height.");
    instance.speak("Wildfire smoke.");
    expect(synth.cancels).toBe(2);
    expect(synth.spoken.map((u) => u.text)).toEqual(["Forest height.", "Wildfire smoke."]);
    // The cut-off one ending does not count as the narrator going quiet.
    expect(speaking.mock.calls).toEqual([[true]]);
    expect(instance.speaking).toBe(true);
    synth.finish();
    expect(speaking.mock.calls).toEqual([[true], [false]]);
    expect(instance.speaking).toBe(false);
  });

  it("uses the interface language and a matching voice", () => {
    const voices = [
      { lang: "es-ES", default: true, localService: true },
      { lang: "en-US", default: false, localService: true },
    ];
    const synth = fakeSynth(voices);
    const { instance } = narrator({ synth });
    instance.speak("Hello.", { force: true });
    expect(synth.spoken[0]?.lang).toBe("en");
    expect(synth.spoken[0]?.voice).toBe(voices[1]);
  });

  it("stops at once when switched off without an announcement", () => {
    const synth = fakeSynth();
    const { instance, speaking } = narrator({ store: memoryStore({ [NARRATOR_ON_KEY]: "1" }), synth });
    instance.speak("Forest height.");
    instance.setEnabled(false);
    expect(instance.enabled).toBe(false);
    expect(instance.speaking).toBe(false);
    expect(speaking.mock.calls).toEqual([[true], [false]]);
  });

  it("does nothing, without throwing, where the browser cannot speak or storage is blocked", () => {
    const silent = narrator({ synth: null }).instance;
    expect(silent.supported).toBe(false);
    expect(() => silent.speak("Hello.", { force: true })).not.toThrow();
    silent.setEnabled(true, "Narrator on.");
    expect(silent.enabled).toBe(false);

    const blocked = narrator({ store: brokenStore });
    expect(blocked.instance.enabled).toBe(false);
    expect(() => blocked.instance.setEnabled(true, "Narrator on.")).not.toThrow();
    expect(blocked.instance.enabled).toBe(true);
  });

  it("recovers when the browser throws while speaking", () => {
    const synth = fakeSynth();
    synth.speak = () => {
      throw new Error("speech failed");
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { instance, speaking } = narrator({ synth });
    expect(() => instance.speak("Hello.", { force: true })).not.toThrow();
    expect(instance.speaking).toBe(false);
    expect(speaking).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("isTypingTarget", () => {
  it("leaves the letters to lists and text boxes", () => {
    expect(isTypingTarget({ tagName: "SELECT" } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "INPUT", type: "text" } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget)).toBe(true);
  });

  it("lets the keys work on buttons, switches and the page", () => {
    expect(isTypingTarget({ tagName: "BUTTON" } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget({ tagName: "INPUT", type: "checkbox" } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget({ tagName: "BODY" } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("narrator wiring", () => {
  it("has a Voice button that says whether it is on", () => {
    expect(planetHudSource).toContain('data-testid="planet-hud-narrator-button"');
    expect(planetHudSource).toContain("aria-pressed={narratorOn}");
  });

  it("answers the V, I and H keys and lowers the data voices while speaking", () => {
    for (const key of ['case "v"', 'case "i"', 'case "h"']) expect(appSource).toContain(key);
    expect(appSource).toContain("NARRATION_DATA_DUCK");
  });
});
