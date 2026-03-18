import { describe, expect, test } from "vitest";
import { enrichReadingSentenceVariants } from "./enrich-reading-sentence-variants";

describe(enrichReadingSentenceVariants, () => {
  test("derives alternative sentences from shared source-side vocabulary mappings", () => {
    const [sentence] = enrichReadingSentenceVariants(
      [
        {
          alternativeSentences: [],
          alternativeTranslations: [],
          explanation: null,
          romanization: null,
          sentence: "Guten Morgen, Anna!",
          translation: "Bom dia, Anna!",
        },
        {
          alternativeSentences: [],
          alternativeTranslations: [],
          explanation: null,
          romanization: null,
          sentence: "Gute Nacht, Mama.",
          translation: "Boa noite, mãe.",
        },
      ],
      [
        {
          alternativeTranslations: [],
          translation: "Bom dia",
          word: "Guten Morgen",
        },
        {
          alternativeTranslations: ["Bom dia"],
          translation: "Boa tarde",
          word: "Guten Tag",
        },
        {
          alternativeTranslations: [],
          translation: "Boa noite",
          word: "Guten Abend",
        },
        {
          alternativeTranslations: [],
          translation: "Boa noite",
          word: "Gute Nacht",
        },
      ],
    );

    expect(sentence).toMatchObject({
      alternativeSentences: ["Guten Tag, Anna!"],
      sentence: "Guten Morgen, Anna!",
      translation: "Bom dia, Anna!",
    });
  });

  test("derives alternative translations from a matched word's alternative translations", () => {
    const [sentence] = enrichReadingSentenceVariants(
      [
        {
          alternativeSentences: [],
          alternativeTranslations: [],
          explanation: null,
          romanization: null,
          sentence: "Hallo, Lara!",
          translation: "Olá, Lara!",
        },
      ],
      [
        {
          alternativeTranslations: ["Oi"],
          translation: "Olá",
          word: "Hallo",
        },
      ],
    );

    expect(sentence).toMatchObject({
      alternativeTranslations: ["Oi, Lara!"],
      sentence: "Hallo, Lara!",
      translation: "Olá, Lara!",
    });
  });
});
