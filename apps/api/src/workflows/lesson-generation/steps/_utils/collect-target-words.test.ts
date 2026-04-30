import { describe, expect, it } from "vitest";
import { collectTargetWords } from "./collect-target-words";

describe(collectTargetWords, () => {
  it("keeps the first canonical spelling when canonical words normalize to the same key", () => {
    expect(
      collectTargetWords({
        canonicalWords: ["Água", "Agua", "Mizu"],
        generatedWords: ["agua", "mizu", "fogo"],
      }),
    ).toStrictEqual(["Água", "Mizu", "fogo"]);
  });
});
