import { describe, expect, it } from "vitest";
import { definitionNamesWord } from "./language-lesson-rules";

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
