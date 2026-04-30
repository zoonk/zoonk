import { describe, expect, test } from "vitest";
import { collectTargetWords } from "./collect-target-words";

describe(collectTargetWords, () => {
  test("keeps the first canonical spelling when canonical words normalize to the same key", () => {
    expect(
      collectTargetWords({
        canonicalWords: ["Água", "Agua", "Mizu"],
        generatedWords: ["agua", "mizu", "fogo"],
      }),
    ).toEqual(["Água", "Mizu", "fogo"]);
  });
});
