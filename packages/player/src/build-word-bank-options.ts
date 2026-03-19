import { shuffle } from "@zoonk/utils/shuffle";
import {
  escapeRegExp,
  normalizePunctuation,
  segmentWords,
  stripPunctuation,
} from "@zoonk/utils/string";
import {
  buildAcceptedArrangeWordSequences,
  getAcceptedArrangeWordSet,
} from "./arrange-words-answers";
import { isSemanticMatch } from "./get-distractor-words";
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

function createPhrasePattern(phrase: string): RegExp {
  const normalizedPhrase = normalizePunctuation(phrase).trim();
  const escapedPhrase = escapeRegExp(normalizedPhrase).replaceAll(String.raw`\ `, String.raw`\s+`);

  return new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedPhrase})(?=$|[^\\p{L}\\p{N}])`, "iu");
}

function hasPhrase(text: string, phrase: string): boolean {
  return createPhrasePattern(phrase).test(normalizePunctuation(text));
}

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

function getWordBankConfig(step: SerializedStep): {
  acceptedTexts: string[];
  acceptedWordSequences: string[][];
  primaryText: string;
  distractorField: "word" | "translation";
} | null {
  if (step.kind === "reading" && step.sentence) {
    return {
      acceptedTexts: [step.sentence.sentence, ...step.sentence.alternativeSentences],
      acceptedWordSequences: buildAcceptedArrangeWordSequences(
        step.sentence.sentence,
        step.sentence.alternativeSentences,
      ),
      distractorField: "word",
      primaryText: step.sentence.sentence,
    };
  }

  if (step.kind === "listening" && step.sentence) {
    return {
      acceptedTexts: [step.sentence.translation, ...step.sentence.alternativeTranslations],
      acceptedWordSequences: buildAcceptedArrangeWordSequences(
        step.sentence.translation,
        step.sentence.alternativeTranslations,
      ),
      distractorField: "translation",
      primaryText: step.sentence.translation,
    };
  }

  return null;
}

function getAcceptedLessonWords(
  serializedLessonWords: SerializedWord[],
  acceptedTexts: string[],
  distractorField: "word" | "translation",
): SerializedWord[] {
  return serializedLessonWords.filter((lessonWord) => {
    const candidatePhrases =
      distractorField === "word"
        ? [lessonWord.word]
        : [lessonWord.translation, ...lessonWord.alternativeTranslations];

    return candidatePhrases.some(
      (phrase) => phrase && acceptedTexts.some((acceptedText) => hasPhrase(acceptedText, phrase)),
    );
  });
}

function filterEquivalentLessonWords(
  serializedLessonWords: SerializedWord[],
  acceptedTexts: string[],
  distractorField: "word" | "translation",
): SerializedWord[] {
  const acceptedLessonWords = getAcceptedLessonWords(
    serializedLessonWords,
    acceptedTexts,
    distractorField,
  );

  if (acceptedLessonWords.length === 0) {
    return serializedLessonWords;
  }

  return serializedLessonWords.filter(
    (lessonWord) =>
      !acceptedLessonWords.some((acceptedLessonWord) =>
        isSemanticMatch(acceptedLessonWord, lessonWord),
      ),
  );
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

  const { acceptedTexts, acceptedWordSequences, distractorField, primaryText } = config;
  const isReading = step.kind === "reading";
  const acceptedWordSet = getAcceptedArrangeWordSet(acceptedWordSequences);
  const distractorLessonWords = filterEquivalentLessonWords(
    serializedLessonWords,
    acceptedTexts,
    distractorField,
  );

  const correctOptions: WordBankOption[] = segmentWords(primaryText).map((word) =>
    isReading ? enrichWord(word, serializedLessonWords, sentenceWordMap) : emptyWordOption(word),
  );

  const allDistractorWords = distractorLessonWords.flatMap((lessonWord) =>
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
