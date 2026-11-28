import { describe, expect, it } from "vitest";
import { findMissingLanguageBands } from "./language-bands";

describe(findMissingLanguageBands, () => {
  it("names each band an aim reaches that has no situation", () => {
    expect(
      findMissingLanguageBands([{ level: "beginner" }, { level: "intermediate" }]),
    ).toStrictEqual(["advanced"]);
  });

  it("finds nothing missing when every band has a situation", () => {
    expect(
      findMissingLanguageBands([
        { level: "beginner" },
        { level: "intermediate" },
        { level: "advanced" },
      ]),
    ).toStrictEqual([]);
  });
});
