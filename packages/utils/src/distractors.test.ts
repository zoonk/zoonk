import { describe, expect, it } from "vitest";
import { normalizeDistractorKey, sanitizeDistractors } from "./distractors";

describe(normalizeDistractorKey, () => {
  it("normalizes punctuation, case, spacing and Unicode composition into one lookup key", () => {
    expect(normalizeDistractorKey("  Café!  ")).toBe(normalizeDistractorKey("cafe\u0301"));
  });

  it("keeps words that differ only by accents or tone marks apart", () => {
    const keys = ["ma", "má", "mà", "mả", "mã", "mạ"].map((word) => normalizeDistractorKey(word));

    expect(new Set(keys).size).toBe(keys.length);
    expect(normalizeDistractorKey("tú")).not.toBe(normalizeDistractorKey("tu"));
  });
});

describe(sanitizeDistractors, () => {
  it("keeps only unique single-word distractors by default", () => {
    expect(
      sanitizeDistractors({ distractors: [" gato ", "GATO", "cão", "", "bom dia"], input: "gato" }),
    ).toStrictEqual(["cão"]);
  });

  it("removes exact canonical collisions after punctuation normalization", () => {
    expect(
      sanitizeDistractors({
        distractors: ["Guten Morgen!", "Guten Morgen", "Abend"],
        input: "Guten Morgen",
      }),
    ).toStrictEqual(["Abend"]);
  });

  it("keeps words and phrases for translation distractors", () => {
    expect(
      sanitizeDistractors({
        distractors: ["please", "sure thing", "no problem", "you're welcome"],
        input: "you're welcome",
        shape: "any",
      }),
    ).toStrictEqual(["please", "sure thing", "no problem"]);
  });

  it("dedupes normalized translation distractors without enforcing token count", () => {
    expect(
      sanitizeDistractors({
        distractors: ["boa tarde", "Boa tarde!", "bom dia", "até amanhã"],
        input: "boa noite",
        shape: "any",
      }),
    ).toStrictEqual(["boa tarde", "bom dia", "até amanhã"]);
  });

  it("drops phrase distractors for sentence word-bank inputs", () => {
    expect(
      sanitizeDistractors({
        distractors: ["Guten Tag", "Abend", "Fenster"],
        input: "Guten Morgen, Anna!",
        shape: "single-word",
      }),
    ).toStrictEqual(["Abend", "Fenster"]);
  });
});
