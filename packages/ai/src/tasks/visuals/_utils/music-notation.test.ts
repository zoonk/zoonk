import { describe, expect, test } from "vitest";
import { normalizeVisualMusicOutput } from "./music-notation";

describe(normalizeVisualMusicOutput, () => {
  test("converts literal escaped newlines into actual ABC line breaks", () => {
    expect(
      normalizeVisualMusicOutput({
        abc: "X:1\\nM:4/4\\nL:1/4\\nK:C\\nC2 G2 |",
        description: "Ascending fifth",
      }),
    ).toEqual({
      abc: "X:1\nM:4/4\nL:1/4\nK:C\nC2 G2 |",
      description: "Ascending fifth",
    });
  });

  test("rejects ABC output when the required header block is incomplete", () => {
    expect(() =>
      normalizeVisualMusicOutput({
        abc: "X:1\nM:4/4\nL:1/4\nC2 G2 |",
        description: "Ascending fifth",
      }),
    ).toThrow("Missing required ABC headers");
  });
});
