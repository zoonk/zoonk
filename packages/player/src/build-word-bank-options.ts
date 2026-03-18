import { shuffle } from "@zoonk/utils/shuffle";
import { segmentWords, stripPunctuation } from "@zoonk/utils/string";
import {
  buildAcceptedArrangeWordSequences,
  buildAcceptedWordBankWords,
  getAcceptedArrangeWordSet,
} from "./arrange-words-answers";
import {
  type SerializedStep,
  type SerializedWord,
  type WordBankOption,
} from "./prepare-activity-data";

const WORD_BANK_DISTRACTOR_COUNT = 8;

type WordDataInput = {
  romanization: string | null;
  translation: string;
  word: string;
  wordAudio: { audioUrl: string } | null;
};

function enrichWord(
  word: string,
  serializedLessonWords: SerializedWord[],
  sentenceWordMap: Map<string, WordDataInput>,
): WordBankOption {
  const key = stripPunctuation(word).toLowerCase();
  const fromSentenceWords = sentenceWordMap.get(key);
  const fromLessonWords = serializedLessonWords.find(
    (lw) => stripPunctuation(lw.word).toLowerCase() === key,
  );

  return {
    audioUrl: fromSentenceWords?.wordAudio?.audioUrl ?? fromLessonWords?.audioUrl ?? null,
    romanization: fromSentenceWords?.romanization ?? fromLessonWords?.romanization ?? null,
    translation: fromSentenceWords?.translation ?? fromLessonWords?.translation ?? null,
    word,
  };
}

function emptyWordOption(word: string): WordBankOption {
  return { audioUrl: null, romanization: null, translation: null, word };
}

function getWordBankConfig(
  step: SerializedStep,
): { acceptedWordSequences: string[][]; distractorField: "word" | "translation" } | null {
  if (step.kind === "reading" && step.sentence) {
    return {
      acceptedWordSequences: buildAcceptedArrangeWordSequences(
        step.sentence.sentence,
        step.sentence.alternativeSentences,
      ),
      distractorField: "word",
    };
  }

  if (step.kind === "listening" && step.sentence) {
    return {
      acceptedWordSequences: buildAcceptedArrangeWordSequences(
        step.sentence.translation,
        step.sentence.alternativeTranslations,
      ),
      distractorField: "translation",
    };
  }

  return null;
}

export function buildSentenceWordOptions(
  sentence: string,
  serializedLessonWords: SerializedWord[],
  sentenceWordMap: Map<string, WordDataInput>,
): WordBankOption[] {
  return segmentWords(sentence).map((word) =>
    enrichWord(word, serializedLessonWords, sentenceWordMap),
  );
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

  const { acceptedWordSequences, distractorField } = config;
  const isReading = step.kind === "reading";
  const acceptedWords = buildAcceptedWordBankWords(acceptedWordSequences);
  const acceptedWordSet = getAcceptedArrangeWordSet(acceptedWordSequences);

  const correctOptions: WordBankOption[] = acceptedWords.map((word) =>
    isReading ? enrichWord(word, serializedLessonWords, sentenceWordMap) : emptyWordOption(word),
  );

  const allDistractorWords = serializedLessonWords.flatMap((lessonWord) =>
    lessonWord[distractorField].split(" "),
  );

  const uniqueDistractors = [
    ...new Map(
      allDistractorWords.flatMap((word) => {
        const key = stripPunctuation(word).toLowerCase();
        return acceptedWordSet.has(key) ? [] : [[key, word] as const];
      }),
    ).values(),
  ];

  const distractorOptions: WordBankOption[] = shuffle(uniqueDistractors)
    .slice(0, WORD_BANK_DISTRACTOR_COUNT)
    .map((word) => {
      if (!isReading) {
        return emptyWordOption(word);
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
