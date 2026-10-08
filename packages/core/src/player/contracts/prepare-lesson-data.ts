import { normalizeDistractorKey } from "@zoonk/utils/distractors";
import { shuffle } from "@zoonk/utils/shuffle";
import {
  type StepContentByKind,
  parseStepContent,
} from "../../library/steps/contract/step-contract";
import { getTileRomanization } from "./_utils/tile-romanization";
import { buildSentenceWordOptions, buildWordBankOptions } from "./build-word-bank-options";
import { type ExerciseKind, isExerciseKind } from "./exercise-content";
import {
  type TranslationOption,
  buildDistractorWordLookup,
  buildTranslationOptions,
  serializeDistractorWord,
} from "./translation-options";

export type { TranslationOption } from "./translation-options";

type WordDataInput = {
  id: string;
  word: string;
  romanization: string | null;
  audioUrl: string | null;
  translation: string;
  distractors: string[];
  pronunciation: string | null;
};

type SentenceDataInput = {
  id: string;
  sentence: string;
  distractors: string[];
  romanization: string | null;
  audioUrl: string | null;
  translation: string;
  translationDistractors: string[];
  explanation: string | null;
};

type DistractorWordDataInput = {
  id: string;
  word: string;
  romanization: string | null;
  audioUrl: string | null;
};

type StepDataInput = {
  id: string;
  content: unknown;
  kind: string;
  position: number;
  word: WordDataInput | null;
  sentence: SentenceDataInput | null;
};

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

/** An answer tile: its word, translation and audio, and romanization only for non-Latin scripts. */
export type WordBankOption = {
  word: string;
  translation: string | null;
  romanization: string | null;
  audioUrl: string | null;
};

export type SerializedStep<Kind extends ExerciseKind = ExerciseKind> = {
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
  fillBlankOptions: WordBankOption[];
  matchColumnsRightItems: string[];
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

/** Every exercise offers the lesson's words as its vocabulary. */
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
 * Multiple choice options are shuffled during serialization so the client
 * receives a randomized order.
 * This avoids client-side shuffling which can cause hydration errors.
 */
function parseAndShuffleContent(kind: ExerciseKind, content: unknown) {
  if (kind === "multipleChoice") {
    return shuffleOptions(parseStepContent("multipleChoice", content));
  }

  return parseStepContent(kind, content);
}

function buildFillBlankOptions(step: SerializedStep): WordBankOption[] {
  if (step.kind !== "fillBlank") {
    return [];
  }

  const content = parseStepContent("fillBlank", step.content);
  const words = shuffle([...content.answers, ...content.distractors]);

  return words.map((word) => ({
    audioUrl: null,
    romanization: getTileRomanization({
      romanization: content.romanizations?.[word] ?? null,
      word,
    }),
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
 * Only exercises reach the language player. Invalid content still gets dropped so the rest of
 * the lesson can play instead of failing the whole lesson.
 */
function serializeStep(step: StepDataInput): SerializedStep | null {
  if (!isExerciseKind(step.kind)) {
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
      translationOptions: [],
      vocabularyOptions: [],
      word: step.word ? serializeWord(step.word) : null,
      wordBankOptions: [],
    };
  } catch {
    return null;
  }
}

/** The lesson's words and sentences with their translations, and the words behind the options. */
export type ExerciseResources = {
  distractorWords: DistractorWordDataInput[];
  lessonSentences: SentenceDataInput[];
  lessonWords: WordDataInput[];
  sentenceWords: WordDataInput[];
};

/**
 * Serializes a lesson's language exercises with their shuffled option pools: word banks,
 * translation options and the lesson's vocabulary.
 */
export function serializeExerciseSteps({
  resources,
  steps,
}: {
  resources: ExerciseResources;
  steps: StepDataInput[];
}): SerializedStep[] {
  const serializedLessonWords = serializeWords(resources.lessonWords);

  const serializedDistractorWords = resources.distractorWords.map((word) =>
    serializeDistractorWord(word),
  );

  const distractorLookup = buildDistractorWordLookup(serializedDistractorWords);

  const sentenceWordMap = new Map(
    resources.sentenceWords.map((word) => [normalizeDistractorKey(word.word), word]),
  );

  return steps.flatMap((raw) => {
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
}
