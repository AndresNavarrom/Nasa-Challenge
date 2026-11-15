import { describe, expect, it } from "vitest";
import { createSoundEngine } from "./engine";
import { TEMPO_STYLES } from "./tempo";
import { FakeAudioContext } from "./testing/fakeAudioContext";

describe("tempo marks", () => {
  it("plays a marked square tick for lightning and nothing for other layers", async () => {
    const context = new FakeAudioContext();
    const engine = createSoundEngine({ context: context.asAudioContext(), lightningSampleUrl: null });
    await engine.start();
    expect(context.oscillators).toHaveLength(6);

    engine.playTempoBeat("lightning");
    expect(context.oscillators).toHaveLength(7);
    const tick = context.oscillators[6]!;
    expect(tick.type).toBe("square");
    expect(tick.frequency.value).toBe(TEMPO_STYLES.lightning!.frequencyHz);

    engine.playTempoBeat("smoke");
    engine.playTempoBeat("co2");
    engine.playTempoBeat("forest");
    expect(context.oscillators).toHaveLength(7);
    engine.dispose();
  });

  it("stops active tempo marks on dispose", async () => {
    const context = new FakeAudioContext();
    const engine = createSoundEngine({ context: context.asAudioContext(), lightningSampleUrl: null });
    await engine.start();
    engine.playTempoBeat("co2");
    const mark = context.oscillators.at(-1)!;
    engine.dispose();
    expect(mark.stop).toHaveBeenCalled();
  });
});
