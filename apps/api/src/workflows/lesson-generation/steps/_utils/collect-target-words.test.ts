import { describe, expect, it } from "vitest";
import { collectTargetWords } from "./collect-target-words";

describe(collectTargetWords, () => {
  it("preserves case and accents for canonical words while filtering equivalent distractors", () => {
    expect(
      collectTargetWords({
        canonicalWords: ["Água", "Agua", "Mizu"],
        generatedWords: ["agua", "mizu", "fogo"],
      }),
    ).toStrictEqual(["Água", "Agua", "Mizu", "fogo"]);
  });
});
