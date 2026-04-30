import { describe, expect, it } from "vitest";
import { normalizeDistractorKey, sanitizeDistractors } from "./distractors";

describe(normalizeDistractorKey, () => {
  it("normalizes punctuation, accents, and spacing into one lookup key", () => {
    expect(normalizeDistractorKey("  Café!  ")).toBe(normalizeDistractorKey("cafe"));
  });
});

describe(sanitizeDistractors, () => {
  it("keeps only unique single-word distractors by default", () => {
    expect(
      sanitizeDistractors({ distractors: [" gato ", "GATO", "cão", "", "bom dia"], input: "gato" }),
    ).toEqual(["cão"]);
  });

  it("removes exact canonical collisions after punctuation normalization", () => {
    expect(
      sanitizeDistractors({
        distractors: ["Guten Morgen!", "Guten Morgen", "Abend"],
        input: "Guten Morgen",
      }),
    ).toEqual(["Abend"]);
  });

  it("keeps words and phrases for translation distractors", () => {
    expect(
      sanitizeDistractors({
        distractors: ["please", "sure thing", "no problem", "you're welcome"],
        input: "you're welcome",
        shape: "any",
      }),
    ).toEqual(["please", "sure thing", "no problem"]);
  });

  it("dedupes normalized translation distractors without enforcing token count", () => {
    expect(
      sanitizeDistractors({
        distractors: ["boa tarde", "Boa tarde!", "bom dia", "até amanhã"],
        input: "boa noite",
        shape: "any",
      }),
    ).toEqual(["boa tarde", "bom dia", "até amanhã"]);
  });

  it("drops phrase distractors for sentence word-bank inputs", () => {
    expect(
      sanitizeDistractors({
        distractors: ["Guten Tag", "Abend", "Fenster"],
        input: "Guten Morgen, Anna!",
        shape: "single-word",
      }),
    ).toEqual(["Abend", "Fenster"]);
  });
});
