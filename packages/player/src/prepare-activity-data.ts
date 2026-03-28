import {
  type MultipleChoiceStepContent,
  type StepContentByKind,
  type SupportedStepKind,
  isSupportedStepKind,
  parseStepContent,
} from "@zoonk/core/steps/content-contract";
import { normalizeDistractorKey } from "@zoonk/utils/distractors";
import { shuffle } from "@zoonk/utils/shuffle";
import {
  type ActivityDistractorWordInput,
  type ActivityStepInput,
  type DistractorWordDataInput,
  type LessonSentenceInput,
  type LessonWordInput,
  type SentenceDataInput,
  type StepDataInput,
  type WordDataInput,
  attachTranslationsToSteps,
  toDistractorWordInputs,
  toLessonSentenceInputs,
  toLessonWordInputs,
  toSentenceWordInputs,
} from "./_utils/activity-data-mappers";
import { buildSentenceWordOptions, buildWordBankOptions } from "./build-word-bank-options";
import {
  type TranslationOption,
  buildDistractorWordLookup,
  buildTranslationOptions,
  serializeDistractorWord,
} from "./translation-options";
export type { TranslationOption } from "./translation-options";

export type SerializedWord = {
  id: string;
  word: string;
  translation: string;
  distractors: string[];
  pronunciation: string | null;
  romanization: string | null;
  audioUrl: string | null;
};

export type SerializedSentence = {
  id: string;
  sentence: string;
  distractors: string[];
  translation: string;
  translationDistractors: string[];
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
  translationOptions: TranslationOption[];
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

type PrepareLessonActivitySource = {
  description: string | null;
  id: bigint;
  kind: string;
  language: string;
  organizationId: number | null;
  steps: ActivityStepInput[];
  title: string | null;
};

type PrepareLessonActivityInput = {
  activity: PrepareLessonActivitySource;
  distractorWords?: ActivityDistractorWordInput[];
  lessonSentences: LessonSentenceInput[];
  lessonWords: LessonWordInput[];
  sentenceWords?: LessonWordInput[];
  steps?: ActivityStepInput[];
};

/**
 * Canonical lesson words travel through the player with lesson-scoped translations and
 * distractor arrays. This serializer converts bigint IDs and copies arrays defensively.
 */
function serializeWord(word: WordDataInput): SerializedWord {
  return {
    audioUrl: word.audioUrl,
    distractors: [...word.distractors],
    id: String(word.id),
    pronunciation: word.pronunciation,
    romanization: word.romanization,
    translation: word.translation,
    word: word.word,
  };
}

/**
 * Lesson-level word serialization is shared by steps, review payloads, and the visible
 * lesson word list.
 */
function serializeWords(words: WordDataInput[]): SerializedWord[] {
  return words.map((word) => serializeWord(word));
}

/**
 * Sentences carry the canonical translation plus the direct distractor arrays used by
 * reading and listening activities.
 */
function serializeSentence(sentence: SentenceDataInput): SerializedSentence {
  return {
    audioUrl: sentence.audioUrl,
    distractors: [...sentence.distractors],
    explanation: sentence.explanation,
    id: String(sentence.id),
    romanization: sentence.romanization,
    sentence: sentence.sentence,
    translation: sentence.translation,
    translationDistractors: [...sentence.translationDistractors],
  };
}

function shuffleMultipleChoiceContent(
  content: MultipleChoiceStepContent,
): MultipleChoiceStepContent {
  return content.kind === "core" ? { ...content, options: shuffle(content.options) } : content;
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
 * Only supported step kinds reach the player. Invalid content still gets dropped so the
 * rest of the page can render instead of failing the whole activity.
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

function prepareActivityData(
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
  distractorWords: DistractorWordDataInput[] = [],
): SerializedActivity {
  const serializedLessonWords = serializeWords(lessonWords);
  const serializedDistractorWords = distractorWords.map((word) => serializeDistractorWord(word));
  const distractorLookup = buildDistractorWordLookup(serializedDistractorWords);
  const sentenceWordMap = new Map(
    sentenceWords.map((word) => [normalizeDistractorKey(word.word), word]),
  );

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
          ? buildSentenceWordOptions(
              step.sentence.sentence,
              serializedLessonWords,
              serializedDistractorWords,
              sentenceWordMap,
            )
          : [],
        sortOrderItems: buildSortOrderItems(step),
        translationOptions: buildTranslationOptions({
          distractorLookup,
          kind: step.kind,
          word: step.word,
        }),
        wordBankOptions: buildWordBankOptions(
          step,
          serializedLessonWords,
          serializedDistractorWords,
          sentenceWordMap,
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

/**
 * The app should only fetch the raw lesson activity inputs. This helper keeps the entire
 * preparation pipeline inside the player package so the app does not need to know about
 * translation attachment, mapper ordering, or the serializer's internal input shapes.
 */
export function prepareLessonActivityData(params: PrepareLessonActivityInput): SerializedActivity {
  const steps = params.steps ?? params.activity.steps;

  return prepareActivityData(
    {
      ...params.activity,
      steps: attachTranslationsToSteps(steps, params.lessonWords, params.lessonSentences),
    },
    toLessonWordInputs(params.lessonWords),
    toLessonSentenceInputs(params.lessonSentences),
    toSentenceWordInputs(params.sentenceWords ?? []),
    toDistractorWordInputs(params.distractorWords ?? []),
  );
}
