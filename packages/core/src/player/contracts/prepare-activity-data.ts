import {
  type ActivityKind,
  type MultipleChoiceStepContent,
  type StepContentByKind,
  type SupportedStepKind,
  isSupportedStepKind,
  parseStepContent,
} from "@zoonk/core/steps/contract/content";
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
  kind: ActivityKind;
  title: string | null;
  description: string | null;
  language: string;
  organizationId: string | null;
  steps: SerializedStep[];
  lessonWords: SerializedWord[];
  lessonSentences: SerializedSentence[];
};

type PrepareLessonActivitySource = {
  description: string | null;
  id: string;
  kind: ActivityKind;
  language: string;
  organizationId: string | null;
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
 * distractor arrays. This serializer keeps string IDs stable and copies arrays defensively.
 */
function serializeWord(word: WordDataInput): SerializedWord {
  return {
    audioUrl: word.audioUrl,
    distractors: [...word.distractors],
    id: word.id,
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
    id: sentence.id,
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

/**
 * Parses step content and applies server-side shuffling where needed.
 *
 * Multiple choice options, investigation actions, and call explanations are shuffled
 * during serialization so the client receives a randomized order.
 * This avoids client-side shuffling which can cause hydration errors.
 */
function parseAndShuffleContent(kind: SupportedStepKind, content: unknown) {
  if (kind === "multipleChoice") {
    return shuffleMultipleChoiceContent(parseStepContent("multipleChoice", content));
  }

  if (kind === "investigation") {
    const parsed = parseStepContent("investigation", content);

    if (parsed.variant === "action") {
      return { ...parsed, actions: shuffle(parsed.actions) };
    }

    if (parsed.variant === "call") {
      return { ...parsed, explanations: shuffle(parsed.explanations) };
    }

    return parsed;
  }

  return parseStepContent(kind, content);
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
    const content = parseAndShuffleContent(step.kind, step.content);

    return {
      content,
      fillBlankOptions: [],
      id: step.id,
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
    id: string;
    kind: ActivityKind;
    title: string | null;
    description: string | null;
    language: string;
    organizationId: string | null;
    steps: StepDataInput[];
  },
  lessonWords: WordDataInput[],
  lessonSentences: SentenceDataInput[],
  sentenceWords: WordDataInput[],
  distractorWords: DistractorWordDataInput[],
): SerializedActivity {
  const serializedLessonWords = serializeWords(lessonWords);
  const serializedLessonSentences = lessonSentences.map((sentence) => serializeSentence(sentence));
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
        vocabularyOptions: serializedLessonWords,
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
    id: activity.id,
    kind: activity.kind,
    language: activity.language,
    lessonSentences: serializedLessonSentences,
    lessonWords: serializedLessonWords,
    organizationId: activity.organizationId,
    steps,
    title: activity.title,
  };
}

/**
 * The app should only fetch the raw lesson activity inputs. This helper keeps the entire
 * preparation pipeline inside the shared player contract so apps do not need to know about
 * serialization, shuffling, or derived option building after ids were standardized to UUIDs.
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
