import { describe, expect, test } from "vitest";
import { mergeReadingSentenceDistractorUnsafeVariants } from "./merge-reading-sentence-distractor-unsafe-variants";

describe(mergeReadingSentenceDistractorUnsafeVariants, () => {
  test("derives distractor-unsafe sentences from shared source-side vocabulary mappings", () => {
    const [sentence] = mergeReadingSentenceDistractorUnsafeVariants(
      [
        {
          distractorUnsafeSentences: [],
          distractorUnsafeTranslations: [],
          explanation: null,
          sentence: "Guten Morgen, Anna!",
          translation: "Bom dia, Anna!",
        },
        {
          distractorUnsafeSentences: [],
          distractorUnsafeTranslations: [],
          explanation: null,
          sentence: "Gute Nacht, Mama.",
          translation: "Boa noite, mãe.",
        },
      ],
      [
        {
          distractorUnsafeTranslations: [],
          translation: "Bom dia",
          word: "Guten Morgen",
        },
        {
          distractorUnsafeTranslations: ["Bom dia"],
          translation: "Boa tarde",
          word: "Guten Tag",
        },
        {
          distractorUnsafeTranslations: [],
          translation: "Boa noite",
          word: "Guten Abend",
        },
        {
          distractorUnsafeTranslations: [],
          translation: "Boa noite",
          word: "Gute Nacht",
        },
      ],
    );

    expect(sentence).toMatchObject({
      distractorUnsafeSentences: ["Guten Tag, Anna!"],
      sentence: "Guten Morgen, Anna!",
      translation: "Bom dia, Anna!",
    });
  });

  test("derives distractor-unsafe translations from a matched word's distractor metadata", () => {
    const [sentence] = mergeReadingSentenceDistractorUnsafeVariants(
      [
        {
          distractorUnsafeSentences: [],
          distractorUnsafeTranslations: [],
          explanation: null,
          sentence: "Hallo, Lara!",
          translation: "Olá, Lara!",
        },
      ],
      [
        {
          distractorUnsafeTranslations: ["Oi"],
          translation: "Olá",
          word: "Hallo",
        },
      ],
    );

    expect(sentence).toMatchObject({
      distractorUnsafeTranslations: ["Oi, Lara!"],
      sentence: "Hallo, Lara!",
      translation: "Olá, Lara!",
    });
  });

  test("keeps AI distractor-unsafe sentences even when they introduce a different lesson phrase", () => {
    const [sentence] = mergeReadingSentenceDistractorUnsafeVariants(
      [
        {
          distractorUnsafeSentences: ["Guten Morgen, Herr Weber."],
          distractorUnsafeTranslations: [],
          explanation: null,
          sentence: "Guten Tag, Herr Weber.",
          translation: "Boa tarde, senhor Weber.",
        },
      ],
      [
        {
          distractorUnsafeTranslations: [],
          translation: "Bom dia",
          word: "Guten Morgen",
        },
        {
          distractorUnsafeTranslations: ["Bom dia"],
          translation: "Boa tarde",
          word: "Guten Tag",
        },
        {
          distractorUnsafeTranslations: [],
          translation: "senhor",
          word: "Herr",
        },
      ],
    );

    expect(sentence).toMatchObject({
      distractorUnsafeSentences: ["Guten Morgen, Herr Weber."],
      distractorUnsafeTranslations: ["Bom dia, senhor Weber."],
      sentence: "Guten Tag, Herr Weber.",
      translation: "Boa tarde, senhor Weber.",
    });
  });

  test("keeps AI distractor-unsafe translations even when they introduce a different lesson phrase", () => {
    const [sentence] = mergeReadingSentenceDistractorUnsafeVariants(
      [
        {
          distractorUnsafeSentences: [],
          distractorUnsafeTranslations: ["Boa tarde, Anna!"],
          explanation: null,
          sentence: "Guten Morgen, Anna!",
          translation: "Bom dia, Anna!",
        },
      ],
      [
        {
          distractorUnsafeTranslations: [],
          translation: "Bom dia",
          word: "Guten Morgen",
        },
        {
          distractorUnsafeTranslations: ["Bom dia"],
          translation: "Boa tarde",
          word: "Guten Tag",
        },
      ],
    );

    expect(sentence).toMatchObject({
      distractorUnsafeSentences: ["Guten Tag, Anna!"],
      distractorUnsafeTranslations: ["Boa tarde, Anna!"],
      sentence: "Guten Morgen, Anna!",
      translation: "Bom dia, Anna!",
    });
  });

  test("keeps AI sentence-form distractor blocks that do not depend on lesson phrase swaps", () => {
    const [sentence] = mergeReadingSentenceDistractorUnsafeVariants(
      [
        {
          distractorUnsafeSentences: ["Soy Lara."],
          distractorUnsafeTranslations: ["I'm Lara."],
          explanation: null,
          sentence: "Yo soy Lara.",
          translation: "I am Lara.",
        },
      ],
      [
        {
          distractorUnsafeTranslations: [],
          translation: "I",
          word: "Yo",
        },
        {
          distractorUnsafeTranslations: [],
          translation: "am",
          word: "soy",
        },
      ],
    );

    expect(sentence).toMatchObject({
      distractorUnsafeSentences: ["Soy Lara."],
      distractorUnsafeTranslations: ["I'm Lara."],
      sentence: "Yo soy Lara.",
      translation: "I am Lara.",
    });
  });
});
