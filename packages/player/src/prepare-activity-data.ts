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
  distractorUnsafeTranslations: string[];
  pronunciation: string | null;
  romanization: string | null;
  audioUrl: string | null;
};

export type SerializedSentence = {
  id: string;
  sentence: string;
  distractorUnsafeSentences: string[];
  translation: string;
  distractorUnsafeTranslations: string[];
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
  translation: string;
  distractorUnsafeTranslations: string[];
  pronunciation: string | null;
};

type SentenceDataInput = {
  id: bigint;
  sentence: string;
  distractorUnsafeSentences: string[];
  romanization: string | null;
  audioUrl: string | null;
  translation: string;
  distractorUnsafeTranslations: string[];
  explanation: string | null;
};

/**
 * Maps a flat WordDataInput (where translation fields live directly on the
 * object rather than in a nested translations array) to the player's
 * serialized format with string IDs.
 */
function serializeWord(word: WordDataInput): SerializedWord {
  return {
    audioUrl: word.audioUrl,
    distractorUnsafeTranslations: [...word.distractorUnsafeTranslations],
    id: String(word.id),
    pronunciation: word.pronunciation,
    romanization: word.romanization,
    translation: word.translation,
    word: word.word,
  };
}

/**
 * The player consumes serialized words from multiple sources, so this helper keeps
 * lesson words and fallback distractor words aligned on one serialization rule.
 */
function serializeWords(words: WordDataInput[]): SerializedWord[] {
  return words.map((word) => serializeWord(word));
}

/**
 * Maps a flat SentenceDataInput (where translation fields live directly on
 * the object rather than in a nested translations array) to the player's
 * serialized format with string IDs.
 */
function serializeSentence(sentence: SentenceDataInput): SerializedSentence {
  return {
    audioUrl: sentence.audioUrl,
    distractorUnsafeSentences: [...sentence.distractorUnsafeSentences],
    distractorUnsafeTranslations: [...sentence.distractorUnsafeTranslations],
    explanation: sentence.explanation,
    id: String(sentence.id),
    romanization: sentence.romanization,
    sentence: sentence.sentence,
    translation: sentence.translation,
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
    distractorUnsafeTranslations: [...word.distractorUnsafeTranslations],
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

/**
 * Converts a raw step from the database into the player's serialized
 * format. Returns null for unsupported step kinds or invalid content
 * so the caller can filter them out with flatMap.
 */
function serializeStep(step: StepDataInput): SerializedStep | null {
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
      sentence: step.sentence ? serializeSentence(step.sentence) : null,
      sentenceWordOptions: [],
      sortOrderItems: [],
      translationOptions: [],
      vocabularyOptions: [],
      word: step.word ? serializeWord(step.word) : null,
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
  const serializedLessonWords = serializeWords(lessonWords);
  const serializedFallbackWords = serializeWords(fallbackDistractorWords);

  const sentenceWordMap = new Map(sentenceWords.map((sw) => [sw.word.toLowerCase(), sw]));

  const steps = activity.steps.flatMap((raw) => {
    const step = serializeStep(raw);

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
    lessonSentences: lessonSentences.map((sentence) => serializeSentence(sentence)),
    lessonWords: serializedLessonWords,
    organizationId: activity.organizationId,
    steps,
    title: activity.title,
  };
}
