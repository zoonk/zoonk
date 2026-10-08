import { describe, expect, it } from "vitest";
import { getTileRomanization } from "./tile-romanization";

describe(getTileRomanization, () => {
  it("keeps the romanization of a word in a non-Latin script", () => {
    expect(getTileRomanization({ romanization: "konnichiwa", word: "こんにちは" })).toBe(
      "konnichiwa",
    );

    expect(getTileRomanization({ romanization: "privet", word: "привет" })).toBe("privet");
  });

  it("shows nothing under a word already in Latin letters", () => {
    expect(getTileRomanization({ romanization: "BÉ-frum", word: "bathroom" })).toBeNull();
    expect(getTileRomanization({ romanization: null, word: "olá" })).toBeNull();
  });
});
