import { shuffle } from "@zoonk/utils/shuffle";
import { segmentWords, stripPunctuation } from "@zoonk/utils/string";
import {
  type SerializedStep,
  type SerializedWord,
  type WordBankOption,
} from "./prepare-activity-data";

const WORD_BANK_DISTRACTOR_COUNT = 8;

type WordDataInput = {
  audioUrl: string | null;
  romanization: string | null;
  translation: string;
  word: string;
};

function getWordBankConfig(
  step: SerializedStep,
): { correctWords: string[]; distractorField: "word" | "translation" } | null {
  if (step.kind === "reading" && step.sentence) {
    return { correctWords: segmentWords(step.sentence.sentence), distractorField: "word" };
  }

  if (step.kind === "listening" && step.sentence) {
    return {
      correctWords: segmentWords(step.sentence.translation),
      distractorField: "translation",
    };
  }

  return null;
}

export function buildWordBankOptions(
  step: SerializedStep,
  serializedLessonWords: SerializedWord[],
  sentenceWordMap: Map<string, WordDataInput>,
): WordBankOption[] {
  const config = getWordBankConfig(step);

  if (!config) {
    return [];
  }

  const { correctWords, distractorField } = config;
  const isReading = step.kind === "reading";
  const correctSet = new Set(correctWords.map((word) => stripPunctuation(word).toLowerCase()));

  const correctOptions: WordBankOption[] = correctWords.map((word) => {
    if (!isReading) {
      return { audioUrl: null, romanization: null, translation: null, word };
    }

    const lookup = sentenceWordMap.get(stripPunctuation(word).toLowerCase());

    return {
      audioUrl: lookup?.audioUrl ?? null,
      romanization: lookup?.romanization ?? null,
      translation: lookup?.translation ?? null,
      word,
    };
  });

  const allDistractorWords = serializedLessonWords.flatMap((lessonWord) =>
    lessonWord[distractorField].split(" "),
  );

  const uniqueDistractors = [
    ...new Map(
      allDistractorWords
        .filter((word) => !correctSet.has(stripPunctuation(word).toLowerCase()))
        .map((word) => [stripPunctuation(word).toLowerCase(), word] as const),
    ).values(),
  ];

  const distractorOptions: WordBankOption[] = shuffle(uniqueDistractors)
    .slice(0, WORD_BANK_DISTRACTOR_COUNT)
    .map((word) => {
      if (!isReading) {
        return { audioUrl: null, romanization: null, translation: null, word };
      }

      const lessonWord = serializedLessonWords.find(
        (lw) => stripPunctuation(lw.word).toLowerCase() === stripPunctuation(word).toLowerCase(),
      );
      return {
        audioUrl: lessonWord?.audioUrl ?? null,
        romanization: lessonWord?.romanization ?? null,
        translation: lessonWord?.translation ?? null,
        word,
      };
    });

  return shuffle([...correctOptions, ...distractorOptions]);
}
