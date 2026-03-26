import { describe, expect, test } from "vitest";
import { mergeReadingSentenceVariants } from "./merge-reading-sentence-variants";

describe(mergeReadingSentenceVariants, () => {
  test("derives alternative sentences from shared source-side vocabulary mappings", () => {
    const [sentence] = mergeReadingSentenceVariants(
      [
        {
          alternativeSentences: [],
          alternativeTranslations: [],
          explanation: null,
          sentence: "Guten Morgen, Anna!",
          translation: "Bom dia, Anna!",
        },
        {
          alternativeSentences: [],
          alternativeTranslations: [],
          explanation: null,
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
    const [sentence] = mergeReadingSentenceVariants(
      [
        {
          alternativeSentences: [],
          alternativeTranslations: [],
          explanation: null,
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

  test("keeps AI sentence variants even when they introduce a different lesson phrase", () => {
    const [sentence] = mergeReadingSentenceVariants(
      [
        {
          alternativeSentences: ["Guten Morgen, Herr Weber."],
          alternativeTranslations: [],
          explanation: null,
          sentence: "Guten Tag, Herr Weber.",
          translation: "Boa tarde, senhor Weber.",
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
          translation: "senhor",
          word: "Herr",
        },
      ],
    );

    expect(sentence).toMatchObject({
      alternativeSentences: ["Guten Morgen, Herr Weber."],
      alternativeTranslations: ["Bom dia, senhor Weber."],
      sentence: "Guten Tag, Herr Weber.",
      translation: "Boa tarde, senhor Weber.",
    });
  });

  test("keeps AI translation variants even when they introduce a different lesson phrase", () => {
    const [sentence] = mergeReadingSentenceVariants(
      [
        {
          alternativeSentences: [],
          alternativeTranslations: ["Boa tarde, Anna!"],
          explanation: null,
          sentence: "Guten Morgen, Anna!",
          translation: "Bom dia, Anna!",
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
      ],
    );

    expect(sentence).toMatchObject({
      alternativeSentences: ["Guten Tag, Anna!"],
      alternativeTranslations: ["Boa tarde, Anna!"],
      sentence: "Guten Morgen, Anna!",
      translation: "Bom dia, Anna!",
    });
  });

  test("keeps AI sentence-form variants that do not depend on lesson phrase swaps", () => {
    const [sentence] = mergeReadingSentenceVariants(
      [
        {
          alternativeSentences: ["Soy Lara."],
          alternativeTranslations: ["I'm Lara."],
          explanation: null,
          sentence: "Yo soy Lara.",
          translation: "I am Lara.",
        },
      ],
      [
        {
          alternativeTranslations: [],
          translation: "I",
          word: "Yo",
        },
        {
          alternativeTranslations: [],
          translation: "am",
          word: "soy",
        },
      ],
    );

    expect(sentence).toMatchObject({
      alternativeSentences: ["Soy Lara."],
      alternativeTranslations: ["I'm Lara."],
      sentence: "Yo soy Lara.",
      translation: "I am Lara.",
    });
  });
});
