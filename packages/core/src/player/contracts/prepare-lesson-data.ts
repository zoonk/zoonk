import {
  type StepContentByKind,
  type SupportedStepKind,
  isSupportedStepKind,
  parseStepContent,
} from "@zoonk/core/steps/contract/content";
import { type LessonKind } from "@zoonk/db";
import { normalizeDistractorKey } from "@zoonk/utils/distractors";
import { shuffle } from "@zoonk/utils/shuffle";
import {
  type ChapterSentenceInput,
  type ChapterWordInput,
  type DistractorWordDataInput,
  type LessonDistractorWordInput,
  type LessonStepInput,
  type SentenceDataInput,
  type StepDataInput,
  type WordDataInput,
  attachResourcesToSteps,
  toChapterSentenceInputs,
  toChapterWordInputs,
  toDistractorWordInputs,
  toSentenceWordInputs,
} from "./_utils/lesson-data-mappers";
import { buildSentenceWordOptions, buildWordBankOptions } from "./build-word-bank-options";
import { getPlayableLessonSteps } from "./playable-lesson-steps";
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

type SerializedSentence = {
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
  pronunciation: string | null;
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

export type SerializedLesson = {
  id: string;
  kind: LessonKind;
  title: string | null;
  description: string | null;
  language: string;
  organizationId: string | null;
  steps: SerializedStep[];
  lessonWords: SerializedWord[];
  lessonSentences: SerializedSentence[];
};

type PreparePlayerLessonSource = {
  description: string | null;
  id: string;
  kind: LessonKind;
  language: string;
  organizationId: string | null;
  steps: LessonStepInput[];
  title: string | null;
};

type PreparePlayerLessonInput = {
  lesson: PreparePlayerLessonSource;
  chapterSentences: ChapterSentenceInput[];
  chapterWords: ChapterWordInput[];
  distractorWords?: LessonDistractorWordInput[];
  sentenceWords?: ChapterWordInput[];
  steps?: LessonStepInput[];
};

type OptionsContent = { options: readonly unknown[] };

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
 * reading and listening lessons.
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

/**
 * Option-based lesson payloads share the same stored field name, so the
 * serializer can randomize them without repeating object-copying code.
 */
function shuffleOptions<Content extends OptionsContent>(content: Content): Content {
  return { ...content, options: shuffle(content.options) };
}

/**
 * Parses step content and applies server-side shuffling where needed.
 *
 * Multiple choice and select-image options are shuffled during serialization
 * so the client receives a randomized order.
 * This avoids client-side shuffling which can cause hydration errors.
 */
function parseAndShuffleContent(kind: SupportedStepKind, content: unknown) {
  if (kind === "multipleChoice") {
    return shuffleOptions(parseStepContent("multipleChoice", content));
  }

  if (kind === "selectImage") {
    return shuffleOptions(parseStepContent("selectImage", content));
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
    pronunciation: null,
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
 * rest of the page can render instead of failing the whole lesson.
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

function buildSerializedLesson(
  lesson: {
    id: string;
    kind: LessonKind;
    title: string | null;
    description: string | null;
    language: string;
    organizationId: string | null;
    steps: StepDataInput[];
  },
  chapterWords: WordDataInput[],
  chapterSentences: SentenceDataInput[],
  sentenceWords: WordDataInput[],
  distractorWords: DistractorWordDataInput[],
): SerializedLesson {
  const serializedLessonWords = serializeWords(chapterWords);
  const serializedLessonSentences = chapterSentences.map((sentence) => serializeSentence(sentence));
  const serializedDistractorWords = distractorWords.map((word) => serializeDistractorWord(word));
  const distractorLookup = buildDistractorWordLookup(serializedDistractorWords);

  const sentenceWordMap = new Map(
    sentenceWords.map((word) => [normalizeDistractorKey(word.word), word]),
  );

  const steps = lesson.steps.flatMap((raw) => {
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
    description: lesson.description,
    id: lesson.id,
    kind: lesson.kind,
    language: lesson.language,
    lessonSentences: serializedLessonSentences,
    lessonWords: serializedLessonWords,
    organizationId: lesson.organizationId,
    steps,
    title: lesson.title,
  };
}

/**
 * The app should only fetch the raw player inputs. This helper keeps the entire
 * preparation pipeline inside the shared player contract so apps do not need to know about
 * serialization, shuffling, or derived option building after ids were standardized to UUIDs.
 */
export function preparePlayerLessonData(params: PreparePlayerLessonInput): SerializedLesson {
  const steps = getPlayableLessonSteps({
    lesson: { kind: params.lesson.kind, steps: params.steps ?? params.lesson.steps },
  });

  return buildSerializedLesson(
    {
      ...params.lesson,
      steps: attachResourcesToSteps(steps, params.chapterWords, params.chapterSentences),
    },
    toChapterWordInputs(params.chapterWords),
    toChapterSentenceInputs(params.chapterSentences),
    toSentenceWordInputs(params.sentenceWords ?? []),
    toDistractorWordInputs(params.distractorWords ?? []),
  );
}
