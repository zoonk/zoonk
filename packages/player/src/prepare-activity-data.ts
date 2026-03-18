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
  wordAudio: { audioUrl: string } | null;
};

type SentenceDataInput = {
  id: bigint;
  sentence: string;
  alternativeSentences: string[];
  translation: string;
  alternativeTranslations: string[];
  romanization: string | null;
  explanation: string | null;
  sentenceAudio: { audioUrl: string } | null;
};

function serializeWord(word: WordDataInput): SerializedWord {
  return {
    alternativeTranslations: [...word.alternativeTranslations],
    audioUrl: word.wordAudio?.audioUrl ?? null,
    id: String(word.id),
    pronunciation: word.pronunciation,
    romanization: word.romanization,
    translation: word.translation,
    word: word.word,
  };
}

function serializeSentence(sentence: SentenceDataInput): SerializedSentence {
  return {
    alternativeSentences: [...sentence.alternativeSentences],
    alternativeTranslations: [...sentence.alternativeTranslations],
    audioUrl: sentence.sentenceAudio?.audioUrl ?? null,
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
): SerializedActivity {
  const serializedLessonWords = lessonWords.map((word) => ({
    alternativeTranslations: [...word.alternativeTranslations],
    audioUrl: word.wordAudio?.audioUrl ?? null,
    id: String(word.id),
    pronunciation: word.pronunciation,
    romanization: word.romanization,
    translation: word.translation,
    word: word.word,
  }));

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
        translationOptions: buildTranslationOptions(step, serializedLessonWords),
        wordBankOptions: buildWordBankOptions(step, serializedLessonWords, sentenceWordMap),
      },
    ];
  });

  return {
    description: activity.description,
    id: String(activity.id),
    kind: activity.kind,
    language: activity.language,
    lessonSentences: lessonSentences.map((sentence) => ({
      alternativeSentences: [...sentence.alternativeSentences],
      alternativeTranslations: [...sentence.alternativeTranslations],
      audioUrl: sentence.sentenceAudio?.audioUrl ?? null,
      explanation: sentence.explanation,
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
