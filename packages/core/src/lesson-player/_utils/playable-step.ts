import { definitionNamesWord } from "@zoonk/ai/tasks/v2/language/language-lesson-rules";
import {
  type MediaAsset,
  type Source,
  type Step,
  type StepKind,
  type StepOptionPicture,
} from "@zoonk/db";
import { normalizeDistractorKey } from "@zoonk/utils/distractors";
import { logError } from "@zoonk/utils/logger";
import { safeParseStepContent } from "../../library/steps/contract/step-contract";
import { type ExerciseKind, isExerciseKind } from "../../player/contracts/exercise-content";
import {
  type ExerciseResources,
  type SerializedStep,
  serializeExerciseSteps,
} from "../../player/contracts/prepare-lesson-data";
import {
  type PlayableLanguageStep,
  type PlayableLibraryStep,
  type PlayableSpokenAnswerStep,
  type PlayableTeachingStep,
  type PlayableTeachingStepOf,
  type PlayableWordHints,
  type TeachingStepKind,
} from "../contract";
import { getScreenPictures } from "./screen-pictures";
import { getStepCitation, markExplanationsNotInMaterial } from "./step-citation";

/**
 * A stored step with what the player needs to show it: its image and the learner's material or
 * the public source it cites.
 */
export type PlayableStepRow = Step & {
  mediaAsset: MediaAsset | null;
  /** The pictures of a question whose options are pictures; read with the lesson's screens. */
  optionPictures?: (StepOptionPicture & { mediaAsset: MediaAsset })[];
  source: Pick<
    Source,
    "fetchedAt" | "kind" | "mimeType" | "publisher" | "title" | "url" | "visibility"
  > | null;
};

/** The lesson's language pair: today's exercise resources plus each word's note and sound tip. */
export type LessonPairResources = ExerciseResources & {
  wordHints: ReadonlyMap<string, PlayableWordHints>;
};

const TEACHING_KINDS = new Set<StepKind>([
  "activity",
  "challenge",
  "check",
  "explanation",
  "hook",
  "spokenAnswer",
  "summary",
  "typedAnswer",
  "workedExample",
]);

/** Exercises that show a word or sentence from the lesson's language pair and can't play without it. */
const WORD_EXERCISE_KINDS = new Set<StepKind>(["translation", "vocabulary"]);
const SENTENCE_EXERCISE_KINDS = new Set<StepKind>(["listening", "reading"]);

function isTeachingKind(kind: StepKind): kind is TeachingStepKind {
  return TEACHING_KINDS.has(kind);
}

function buildTeachingStep<TKind extends TeachingStepKind>(
  kind: TKind,
  row: PlayableStepRow,
): PlayableTeachingStepOf<TKind> | null {
  const parsed = safeParseStepContent(kind, row.content);

  if (!parsed.success) {
    logError(`[lesson-player] Step ${row.id} has invalid ${kind} content.`, parsed.error);
    return null;
  }

  const { content, image, imagePending, optionPictures } = getScreenPictures({
    content: parsed.data,
    kind,
    row,
  });

  if (!content) {
    logError(`[lesson-player] Step ${row.id} asks about a numbered picture it no longer has.`);
    return null;
  }

  return {
    citation: getStepCitation(row),
    content,
    id: row.id,
    image,
    imagePending,
    ...(Object.keys(optionPictures).length > 0 ? { optionPictures } : {}),
    kind,
    position: row.position,
    skillId: row.skillId,
  };
}

/** A "say it out loud" screen, with its sentence as a listening exercise for "I can't talk now". */
function buildSpokenAnswerStep({
  listening,
  row,
}: {
  listening: ReadonlyMap<string, SerializedStep>;
  row: PlayableStepRow;
}): PlayableSpokenAnswerStep | null {
  const step = buildTeachingStep("spokenAnswer", row);
  return step && { ...step, listening: listening.get(row.id) ?? null };
}

/** One case per kind keeps each screen's content typed to its kind. */
function toTeachingStep({
  kind,
  listening,
  row,
}: {
  kind: TeachingStepKind;
  listening: ReadonlyMap<string, SerializedStep>;
  row: PlayableStepRow;
}): PlayableTeachingStep | null {
  switch (kind) {
    case "activity":
      return buildTeachingStep("activity", row);
    case "challenge":
      return buildTeachingStep("challenge", row);
    case "check":
      return buildTeachingStep("check", row);
    case "explanation":
      return buildTeachingStep("explanation", row);
    case "hook":
      return buildTeachingStep("hook", row);
    case "spokenAnswer":
      return buildSpokenAnswerStep({ listening, row });
    case "summary":
      return buildTeachingStep("summary", row);
    case "typedAnswer":
      return buildTeachingStep("typedAnswer", row);
    case "workedExample":
      return buildTeachingStep("workedExample", row);
    default:
      return null;
  }
}

type ExerciseText = {
  kind: ExerciseKind;
  /** The lesson is in the learner's own language (see `isSameLanguage`). */
  sameLanguage: boolean;
  sentence: ExerciseResources["lessonSentences"][number] | null;
  word: ExerciseResources["lessonWords"][number] | null;
};

/**
 * An exercise that shows its own answer tests nothing: a word to pick for a meaning that names it
 * ("rent" for "rent", a cognate or an English word for English readers), a sentence to build from
 * itself, or one to hear without a recording. In the learner's own language a word whose
 * definition names it teaches nothing either, so its card goes too. Lessons written before their
 * writer knew this still play without those screens.
 */
function showsOwnAnswer({ kind, sameLanguage, sentence, word }: ExerciseText): boolean {
  const namesItself = word
    ? definitionNamesWord({ definition: word.translation, word: word.word })
    : false;

  const readsItself = sentence
    ? normalizeDistractorKey(sentence.translation) === normalizeDistractorKey(sentence.sentence)
    : false;

  switch (kind) {
    case "vocabulary":
      return sameLanguage && namesItself;
    case "translation":
      return namesItself;
    case "reading":
      return readsItself;
    case "listening":
      return readsItself && !sentence?.audioUrl;
    case "alphabet":
    case "fillBlank":
    case "matchColumns":
    case "multipleChoice":
      return false;
    default:
      return false;
  }
}

type ExerciseRow = PlayableStepRow & { kind: ExerciseKind };

/**
 * Word and sentence exercises read their text and translation from the lesson's pair links, so
 * one without its link can't be shown, and one that shows its own answer isn't.
 */
function toExerciseInput({
  resources,
  row,
  sameLanguage,
}: {
  resources: ExerciseResources;
  row: ExerciseRow;
  sameLanguage: boolean;
}) {
  const word = resources.lessonWords.find((item) => item.id === row.wordId) ?? null;
  const sentence = resources.lessonSentences.find((item) => item.id === row.sentenceId) ?? null;

  if (
    (WORD_EXERCISE_KINDS.has(row.kind) && !word) ||
    (SENTENCE_EXERCISE_KINDS.has(row.kind) && !sentence)
  ) {
    logError(`[lesson-player] Step ${row.id} has no ${row.kind} word or sentence in its lesson.`);
    return [];
  }

  if (showsOwnAnswer({ kind: row.kind, sameLanguage, sentence, word })) {
    return [];
  }

  return [
    { content: row.content, id: row.id, kind: row.kind, position: row.position, sentence, word },
  ];
}

/** Language exercises play through today's serializer, with the lesson's pair as their word bank. */
function toExerciseSteps({
  resources,
  rows,
  sameLanguage,
}: {
  resources: LessonPairResources;
  rows: PlayableStepRow[];
  sameLanguage: boolean;
}): Map<string, PlayableLanguageStep> {
  const exerciseRows = rows.filter((row): row is ExerciseRow => isExerciseKind(row.kind));
  const inputs = exerciseRows.flatMap((row) => toExerciseInput({ resources, row, sameLanguage }));
  const serialized = serializeExerciseSteps({ resources, steps: inputs });
  const rowsById = new Map(exerciseRows.map((row) => [row.id, row]));

  return new Map(
    serialized.flatMap((exercise) => {
      const row = rowsById.get(exercise.id);

      if (!row) {
        return [];
      }

      const hints =
        WORD_EXERCISE_KINDS.has(row.kind) && row.wordId
          ? resources.wordHints.get(row.wordId)
          : null;

      const step: PlayableLanguageStep = {
        exercise,
        id: row.id,
        kind: row.kind,
        position: row.position,
        skillId: row.skillId,
        wordHints: hints ?? null,
      };

      return [[row.id, step]];
    }),
  );
}

/**
 * Each spoken sentence of the lesson as a listening exercise (hear it, build it from the word
 * bank), so a learner who can't talk now still practices it. Screens without a sentence of the
 * lesson have none.
 */
function toListeningFallbacks({
  resources,
  rows,
  sameLanguage,
}: {
  resources: LessonPairResources;
  rows: PlayableStepRow[];
  sameLanguage: boolean;
}): Map<string, SerializedStep> {
  const inputs = rows.flatMap((row) => {
    const sentence = resources.lessonSentences.find((item) => item.id === row.sentenceId);

    return row.kind === "spokenAnswer" &&
      sentence &&
      !showsOwnAnswer({ kind: "listening", sameLanguage, sentence, word: null })
      ? [
          {
            content: {},
            id: row.id,
            kind: "listening" as const,
            position: row.position,
            sentence,
            word: null,
          },
        ]
      : [];
  });

  const serialized = serializeExerciseSteps({ resources, steps: inputs });
  return new Map(serialized.map((exercise) => [exercise.id, exercise]));
}

/**
 * Turns stored steps into the screens the player shows, in order, leaving out any that can't be
 * served. The read, the check and the completion all use this, so they always agree on which
 * screens a lesson has.
 */
export function toPlayableSteps({
  resources,
  rows,
  sameLanguage,
}: {
  resources: LessonPairResources;
  rows: PlayableStepRow[];
  /** The lesson is in the learner's own language, such as English for English readers. */
  sameLanguage: boolean;
}): PlayableLibraryStep[] {
  const exercises = toExerciseSteps({ resources, rows, sameLanguage });
  const listening = toListeningFallbacks({ resources, rows, sameLanguage });

  const steps = rows.flatMap((row) => {
    const step = isTeachingKind(row.kind)
      ? toTeachingStep({ kind: row.kind, listening, row })
      : exercises.get(row.id);

    return step ? [step] : [];
  });

  return markExplanationsNotInMaterial({ rows, steps });
}
