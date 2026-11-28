import { describe, expect, it } from "vitest";
import { definitionNamesWord, writesNumberInDigits } from "./language-lesson-rules";

describe(definitionNamesWord, () => {
  it("flags a definition that is the word itself", () => {
    expect(definitionNamesWord({ definition: "Need", word: "need" })).toBe(true);
  });

  it("flags a definition that uses the word or a form of it", () => {
    expect(definitionNamesWord({ definition: "to get bigger as you grow", word: "grow" })).toBe(
      true,
    );

    expect(definitionNamesWord({ definition: "to keep growing over time", word: "grow" })).toBe(
      true,
    );

    expect(
      definitionNamesWord({ definition: "how much is it, asking a price", word: "How much is" }),
    ).toBe(true);
  });

  it("accepts a definition in other words", () => {
    expect(definitionNamesWord({ definition: "a stick used to hit a ball", word: "bat" })).toBe(
      false,
    );

    expect(
      definitionNamesWord({
        definition: "to have to have something because it is necessary",
        word: "need",
      }),
    ).toBe(false);
  });

  it("doesn't take a longer word for a form of a short one", () => {
    expect(definitionNamesWord({ definition: "a pattern of light taps", word: "pat" })).toBe(false);
  });
});

describe(writesNumberInDigits, () => {
  it("flags a number written in digits, in any script", () => {
    expect(writesNumberInDigits("Abito in via Roma, numero 12")).toBe(true);
    expect(writesNumberInDigits("الساعة ٣")).toBe(true);
  });

  it("accepts a number written in words", () => {
    expect(writesNumberInDigits("Abito in via Roma, numero dodici")).toBe(false);
  });

  it("accepts a code that joins digits to letters", () => {
    expect(writesNumberInDigits("Imprima isto em papel A4")).toBe(false);
    expect(writesNumberInDigits("Il telefono ha il 4G?")).toBe(false);
  });
});
