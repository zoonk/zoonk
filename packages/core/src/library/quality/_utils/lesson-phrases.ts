import { getBaseLanguage } from "@zoonk/utils/languages";
import { normalizeString } from "@zoonk/utils/string";

/**
 * Lessons open with the idea, so they never talk about "this lesson" or look
 * back at the last one. Phrases are compared without accents or case.
 */
const LESSON_FRAMING: Readonly<Record<string, readonly string[]>> = {
  de: ["in dieser lektion", "in der letzten lektion", "am ende dieser lektion"],
  en: [
    "in this lesson",
    "in today's lesson",
    "in the previous lesson",
    "in the last lesson",
    "by the end of this lesson",
    "let's dive",
  ],
  es: [
    "en esta leccion",
    "en la leccion anterior",
    "al final de esta leccion",
    "vamos a sumergirnos",
  ],
  fr: ["dans cette lecon", "dans la lecon precedente", "a la fin de cette lecon"],
  pt: [
    "nesta licao",
    "nessa licao",
    "nesta aula",
    "na licao anterior",
    "na aula anterior",
    "ao final desta licao",
    "vamos mergulhar",
  ],
};

/** Throat-clearing and textbook filler that never teaches anything. */
const FILLER: Readonly<Record<string, readonly string[]>> = {
  de: ["es ist wichtig zu beachten", "seit anbeginn der zeit", "in der heutigen welt"],
  en: [
    "it is important to note",
    "it's important to note",
    "it is worth noting",
    "it's worth noting",
    "since the dawn of time",
    "in today's world",
    "in today's fast-paced world",
    "as we all know",
    "needless to say",
  ],
  es: [
    "es importante destacar",
    "es importante senalar",
    "cabe destacar",
    "vale la pena destacar",
    "desde tiempos inmemoriales",
    "en el mundo actual",
    "como todos sabemos",
  ],
  fr: [
    "il est important de noter",
    "il convient de noter",
    "depuis la nuit des temps",
    "dans le monde d'aujourd'hui",
  ],
  pt: [
    "e importante ressaltar",
    "e importante destacar",
    "e importante notar",
    "vale ressaltar",
    "vale destacar",
    "desde os primordios",
    "no mundo atual",
    "nos dias de hoje",
    "como todos sabemos",
  ],
};

function getPhrases(
  lists: Readonly<Record<string, readonly string[]>>,
  language: string,
): readonly string[] {
  return lists[getBaseLanguage(language)] ?? lists.en ?? [];
}

/** Matches whole words, so "vale destacar" never matches inside "equivale destacar". */
function containsPhrase(normalizedText: string, phrase: string): boolean {
  return ` ${normalizedText.replaceAll(/[^\p{L}\p{N}'-]+/gu, " ")} `.includes(` ${phrase} `);
}

/** The framing and filler phrases a text uses, in the lesson's language. */
export function findLessonPhrases({ language, text }: { language: string; text: string }): {
  filler: string[];
  framing: string[];
} {
  const normalized = normalizeString(text.replaceAll("’", "'"));

  return {
    filler: getPhrases(FILLER, language).filter((phrase) => containsPhrase(normalized, phrase)),
    framing: getPhrases(LESSON_FRAMING, language).filter((phrase) =>
      containsPhrase(normalized, phrase),
    ),
  };
}
