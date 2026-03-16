import {
  type MultipleChoiceStepContent,
  type StepContentByKind,
  type SupportedStepKind,
  isSupportedStepKind,
  parseStepContent,
} from "@zoonk/core/steps/content-contract";
import { shuffle } from "@zoonk/utils/shuffle";
import { stripPunctuation } from "@zoonk/utils/string";
import { getDistractorWords } from "./get-distractor-words";

const VOCABULARY_DISTRACTOR_COUNT = 3;
const WORD_BANK_DISTRACTOR_COUNT = 8;

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
  translation: string;
  romanization: string | null;
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
  sortOrderItems: string[];
  fillBlankOptions: string[];
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
  translation: string;
  alternativeTranslations: string[];
  pronunciation: string | null;
  romanization: string | null;
  audioUrl: string | null;
};

type SentenceDataInput = {
  id: bigint;
  sentence: string;
  translation: string;
  romanization: string | null;
  audioUrl: string | null;
};

function serializeWord(word: WordDataInput): SerializedWord {
  return {
    alternativeTranslations: [...word.alternativeTranslations],
    audioUrl: word.audioUrl,
    id: String(word.id),
    pronunciation: word.pronunciation,
    romanization: word.romanization,
    translation: word.translation,
    word: word.word,
  };
}

function serializeSentence(sentence: SentenceDataInput): SerializedSentence {
  return {
    audioUrl: sentence.audioUrl,
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
    case "language":
      return { ...content, options: shuffle(content.options) };
    default:
      return content;
  }
}

function buildTranslationOptions(
  step: SerializedStep,
  serializedLessonWords: SerializedWord[],
): SerializedWord[] {
  if (step.kind !== "translation" || !step.word) {
    return [];
  }

  const distractors = getDistractorWords(
    step.word,
    serializedLessonWords,
    VOCABULARY_DISTRACTOR_COUNT,
  );
  return shuffle([step.word, ...distractors]).map((word) => ({
    ...word,
    alternativeTranslations: [...word.alternativeTranslations],
  }));
}

function getWordBankConfig(
  step: SerializedStep,
): { correctWords: string[]; distractorField: "word" | "translation" } | null {
  if (step.kind === "reading" && step.sentence) {
    return { correctWords: step.sentence.sentence.split(" "), distractorField: "word" };
  }

  if (step.kind === "listening" && step.sentence) {
    return { correctWords: step.sentence.translation.split(" "), distractorField: "translation" };
  }

  return null;
}

function buildWordBankOptions(
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

function buildSortOrderItems(step: SerializedStep): string[] {
  if (step.kind !== "sortOrder") {
    return [];
  }

  const content = parseStepContent("sortOrder", step.content);
  return shuffle(content.items);
}

function buildFillBlankOptions(step: SerializedStep): string[] {
  if (step.kind !== "fillBlank") {
    return [];
  }

  const content = parseStepContent("fillBlank", step.content);
  return shuffle([...content.answers, ...content.distractors]);
}

function buildMatchColumnsRightItems(step: SerializedStep): string[] {
  if (step.kind !== "matchColumns") {
    return [];
  }

  const content = parseStepContent("matchColumns", step.content);
  return shuffle(content.pairs.map((pair) => pair.right));
}

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
): SerializedActivity {
  const serializedLessonWords = lessonWords.map((word) => ({
    alternativeTranslations: [...word.alternativeTranslations],
    audioUrl: word.audioUrl,
    id: String(word.id),
    pronunciation: word.pronunciation,
    romanization: word.romanization,
    translation: word.translation,
    word: word.word,
  }));

  const sentenceWordMap = new Map(sentenceWords.map((sw) => [sw.word.toLowerCase(), sw]));

  const steps = activity.steps
    .map((step) => serializeStep(step))
    .filter((step): step is SerializedStep => step !== null)
    .map((step) => ({
      ...step,
      fillBlankOptions: buildFillBlankOptions(step),
      matchColumnsRightItems: buildMatchColumnsRightItems(step),
      sortOrderItems: buildSortOrderItems(step),
      translationOptions: buildTranslationOptions(step, serializedLessonWords),
      wordBankOptions: buildWordBankOptions(step, serializedLessonWords, sentenceWordMap),
    }));

  return {
    description: activity.description,
    id: String(activity.id),
    kind: activity.kind,
    language: activity.language,
    lessonSentences: lessonSentences.map((sentence) => ({
      audioUrl: sentence.audioUrl,
      id: String(sentence.id),
      romanization: sentence.romanization,
      sentence: sentence.sentence,
      translation: sentence.translation,
    })),
    lessonWords: serializedLessonWords,
    organizationId: activity.organizationId,
    steps,
    title: activity.title,
  };
}
