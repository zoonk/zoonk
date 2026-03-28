import { describe, expect, test } from "vitest";
import { sanitizeDistractors } from "./distractors";

describe(sanitizeDistractors, () => {
  test("keeps only unique single-word distractors by default", () => {
    expect(
      sanitizeDistractors({
        distractors: [" gato ", "GATO", "cão", "", "bom dia"],
        input: "gato",
      }),
    ).toEqual(["cão"]);
  });

  test("removes exact canonical collisions after punctuation normalization", () => {
    expect(
      sanitizeDistractors({
        distractors: ["Guten Morgen!", "Guten Morgen", "Abend"],
        input: "Guten Morgen",
      }),
    ).toEqual(["Abend"]);
  });

  test("keeps words and phrases for translation distractors", () => {
    expect(
      sanitizeDistractors({
        distractors: ["please", "sure thing", "no problem", "you're welcome"],
        input: "you're welcome",
        shape: "any",
      }),
    ).toEqual(["please", "sure thing", "no problem"]);
  });

  test("dedupes normalized translation distractors without enforcing token count", () => {
    expect(
      sanitizeDistractors({
        distractors: ["boa tarde", "Boa tarde!", "bom dia", "até amanhã"],
        input: "boa noite",
        shape: "any",
      }),
    ).toEqual(["boa tarde", "bom dia", "até amanhã"]);
  });

  test("drops phrase distractors for sentence word-bank inputs", () => {
    expect(
      sanitizeDistractors({
        distractors: ["Guten Tag", "Abend", "Fenster"],
        input: "Guten Morgen, Anna!",
        shape: "single-word",
      }),
    ).toEqual(["Abend", "Fenster"]);
  });
});
