import {
  type MultipleChoiceStepContent,
  type StepContentByKind,
  type SupportedStepKind,
  isSupportedStepKind,
  parseStepContent,
} from "@zoonk/core/steps/content-contract";
import { shuffle } from "@zoonk/utils/shuffle";
import { buildSentenceWordOptions, buildWordBankOptions } from "./build-word-bank-options";
import { getDistractorWords } from "./get-distractor-words";

const VOCABULARY_DISTRACTOR_COUNT = 3;

export type SerializedWord = {
  id: string;
  word: string;
  translation: string;
  alternativeTranslations: string[];
  pronunciation: string | null;
  romanization: string | null;
  audioUrl: string | null;
};

export type SerializedSentence = {
  id: string;
  sentence: string;
  alternativeSentences: string[];
  translation: string;
  alternativeTranslations: string[];
  romanization: string | null;
  explanation: string | null;
  audioUrl: string | null;
};

export type WordBankOption = {
  word: string;
  translation: string | null;
  romanization: string | null;
  audioUrl: string | null;
};

export type SerializedStep<Kind extends SupportedStepKind = SupportedStepKind> = {
  id: string;
  kind: Kind;
  position: number;
  content: StepContentByKind[Kind];
  word: SerializedWord | null;
  sentence: SerializedSentence | null;
  translationOptions: SerializedWord[];
  vocabularyOptions: SerializedWord[];
  wordBankOptions: WordBankOption[];
  sentenceWordOptions: WordBankOption[];
  sortOrderItems: string[];
  fillBlankOptions: WordBankOption[];
  matchColumnsRightItems: string[];
};

export type SerializedActivity = {
  id: string;
  kind: string;
  title: string | null;
  description: string | null;
  language: string;
  organizationId: number | null;
  steps: SerializedStep[];
  lessonWords: SerializedWord[];
  lessonSentences: SerializedSentence[];
};

type WordTranslationInput = {
  userLanguage: string;
  translation: string;
  alternativeTranslations: string[];
  pronunciation: string | null;
};

type SentenceTranslationInput = {
  userLanguage: string;
  translation: string;
  alternativeTranslations: string[];
  explanation: string | null;
};

type StepDataInput = {
  id: bigint;
  content: unknown;
  kind: string;
  position: number;
  word: WordDataInput | null;
  sentence: SentenceDataInput | null;
};

type WordDataInput = {
  id: bigint;
  word: string;
  romanization: string | null;
  audioUrl: string | null;
  translations: WordTranslationInput[];
};

type SentenceDataInput = {
  id: bigint;
  sentence: string;
  alternativeSentences: string[];
  romanization: string | null;
  audioUrl: string | null;
  translations: SentenceTranslationInput[];
};

/**
 * Finds the translation matching the user's language from the translations array.
 * Falls back to the first translation if no exact match exists, because a word
 * always has at least one translation in practice.
 */
function findWordTranslation(
  translations: WordTranslationInput[],
  userLanguage: string,
): WordTranslationInput | undefined {
  return translations.find((t) => t.userLanguage === userLanguage) ?? translations[0];
}

/**
 * Same as findWordTranslation but for sentence translations which carry
 * explanation instead of pronunciation.
 */
function findSentenceTranslation(
  translations: SentenceTranslationInput[],
  userLanguage: string,
): SentenceTranslationInput | undefined {
  return translations.find((t) => t.userLanguage === userLanguage) ?? translations[0];
}

function serializeWord(word: WordDataInput, userLanguage: string): SerializedWord {
  const translation = findWordTranslation(word.translations, userLanguage);

  return {
    alternativeTranslations: translation ? [...translation.alternativeTranslations] : [],
    audioUrl: word.audioUrl,
    id: String(word.id),
    pronunciation: translation?.pronunciation ?? null,
    romanization: word.romanization,
    translation: translation?.translation ?? "",
    word: word.word,
  };
}

/**
 * The player consumes serialized words from multiple sources, so this helper keeps
 * lesson words and fallback distractor words aligned on one serialization rule.
 */
function serializeWords(words: WordDataInput[], userLanguage: string): SerializedWord[] {
  return words.map((word) => serializeWord(word, userLanguage));
}

function serializeSentence(sentence: SentenceDataInput, userLanguage: string): SerializedSentence {
  const translation = findSentenceTranslation(sentence.translations, userLanguage);

  return {
    alternativeSentences: [...sentence.alternativeSentences],
    alternativeTranslations: translation ? [...translation.alternativeTranslations] : [],
    audioUrl: sentence.audioUrl,
    explanation: translation?.explanation ?? null,
    id: String(sentence.id),
    romanization: sentence.romanization,
    sentence: sentence.sentence,
    translation: translation?.translation ?? "",
  };
}

function shuffleMultipleChoiceContent(
  content: MultipleChoiceStepContent,
): MultipleChoiceStepContent {
  switch (content.kind) {
    case "core":
      return { ...content, options: shuffle(content.options) };
    case "challenge":
      return content;
    default:
      return content;
  }
}

function buildTranslationOptions(
  step: SerializedStep,
  serializedLessonWords: SerializedWord[],
  serializedFallbackWords: SerializedWord[],
): SerializedWord[] {
  if (step.kind !== "translation" || !step.word) {
    return [];
  }

  const distractors = getDistractorWords(
    step.word,
    serializedLessonWords,
    VOCABULARY_DISTRACTOR_COUNT,
    serializedFallbackWords,
  );
  return shuffle([step.word, ...distractors]).map((word) => ({
    ...word,
    alternativeTranslations: [...word.alternativeTranslations],
  }));
}

function buildSortOrderItems(step: SerializedStep): string[] {
  if (step.kind !== "sortOrder") {
    return [];
  }

  const content = parseStepContent("sortOrder", step.content);
  return shuffle(content.items);
}

function buildFillBlankOptions(step: SerializedStep): WordBankOption[] {
  if (step.kind !== "fillBlank") {
    return [];
  }

  const content = parseStepContent("fillBlank", step.content);
  const words = shuffle([...content.answers, ...content.distractors]);

  return words.map((word) => ({
    audioUrl: null,
    romanization: content.romanizations?.[word] ?? null,
    translation: null,
    word,
  }));
}

function buildMatchColumnsRightItems(step: SerializedStep): string[] {
  if (step.kind !== "matchColumns") {
    return [];
  }

  const content = parseStepContent("matchColumns", step.content);
  return shuffle(content.pairs.map((pair) => pair.right));
}

function serializeStep(step: StepDataInput, userLanguage: string): SerializedStep | null {
  if (!isSupportedStepKind(step.kind)) {
    return null;
  }

  try {
    const content =
      step.kind === "multipleChoice"
        ? shuffleMultipleChoiceContent(parseStepContent("multipleChoice", step.content))
        : parseStepContent(step.kind, step.content);

    return {
      content,
      fillBlankOptions: [],
      id: String(step.id),
      kind: step.kind,
      matchColumnsRightItems: [],
      position: step.position,
      sentence: step.sentence ? serializeSentence(step.sentence, userLanguage) : null,
      sentenceWordOptions: [],
      sortOrderItems: [],
      translationOptions: [],
      vocabularyOptions: [],
      word: step.word ? serializeWord(step.word, userLanguage) : null,
      wordBankOptions: [],
    };
  } catch {
    return null;
  }
}

export function prepareActivityData(
  activity: {
    id: bigint;
    kind: string;
    title: string | null;
    description: string | null;
    language: string;
    organizationId: number | null;
    steps: StepDataInput[];
  },
  lessonWords: WordDataInput[],
  lessonSentences: SentenceDataInput[],
  sentenceWords: WordDataInput[] = [],
  fallbackDistractorWords: WordDataInput[] = [],
): SerializedActivity {
  const userLanguage = activity.language;
  const serializedLessonWords = serializeWords(lessonWords, userLanguage);
  const serializedFallbackWords = serializeWords(fallbackDistractorWords, userLanguage);

  const sentenceWordMap = new Map(sentenceWords.map((sw) => [sw.word.toLowerCase(), sw]));

  const steps = activity.steps.flatMap((raw) => {
    const step = serializeStep(raw, userLanguage);

    if (!step) {
      return [];
    }

    return [
      {
        ...step,
        fillBlankOptions: buildFillBlankOptions(step),
        matchColumnsRightItems: buildMatchColumnsRightItems(step),
        sentenceWordOptions: step.sentence
          ? buildSentenceWordOptions(step.sentence.sentence, serializedLessonWords, sentenceWordMap)
          : [],
        sortOrderItems: buildSortOrderItems(step),
        translationOptions: buildTranslationOptions(
          step,
          serializedLessonWords,
          serializedFallbackWords,
        ),
        wordBankOptions: buildWordBankOptions(
          step,
          serializedLessonWords,
          sentenceWordMap,
          serializedFallbackWords,
        ),
      },
    ];
  });

  return {
    description: activity.description,
    id: String(activity.id),
    kind: activity.kind,
    language: activity.language,
    lessonSentences: lessonSentences.map((sentence) => serializeSentence(sentence, userLanguage)),
    lessonWords: serializedLessonWords,
    organizationId: activity.organizationId,
    steps,
    title: activity.title,
  };
}
