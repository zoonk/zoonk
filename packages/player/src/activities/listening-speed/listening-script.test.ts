import { describe, expect, it } from "vitest";
import { splitSentences, waveformBars } from "./listening-script";

describe(splitSentences, () => {
  it("splits a message into its sentences", () => {
    expect(
      splitSentences("¡Hola! Soy Lucía. Ya tengo la mesa para el sábado. ¡Nos vemos!", "es"),
    ).toStrictEqual(["¡Hola!", "Soy Lucía.", "Ya tengo la mesa para el sábado.", "¡Nos vemos!"]);

    expect(splitSentences("One line only", "en")).toStrictEqual(["One line only"]);
  });
});

describe(waveformBars, () => {
  it("draws the same bars for the same script, within range", () => {
    const bars = waveformBars("Hola", 20);

    expect(bars).toHaveLength(20);
    expect(waveformBars("Hola", 20)).toStrictEqual(bars);
    expect(bars.every((bar) => bar >= 0.25 && bar <= 1)).toBe(true);
  });
});
