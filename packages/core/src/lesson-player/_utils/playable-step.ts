import { type MediaAsset, type Source, type Step, type StepKind } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { safeParseStepContent } from "../../library/steps/contract/step-contract";
import { isExerciseKind } from "../../player/contracts/exercise-content";
import {
  type ExerciseResources,
  type SerializedStep,
  serializeExerciseSteps,
} from "../../player/contracts/prepare-lesson-data";
import {
  type PlayableLanguageStep,
  type PlayableLibraryStep,
  type PlayableSpokenAnswerStep,
  type PlayableStepImage,
  type PlayableTeachingStep,
  type PlayableTeachingStepOf,
  type PlayableWordHints,
  type TeachingStepKind,
} from "../contract";
import { getStepCitation, markExplanationsNotInMaterial } from "./step-citation";

/**
 * A stored step with what the player needs to show it: its image and the learner's material or
 * the public source it cites. Its depth versions are added per read (`withDepthVersions`).
 */
export type PlayableStepRow = Step & {
  mediaAsset: MediaAsset | null;
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

/** The image file is linked through the step; its alt text comes from the step's image request. */
function getStepImage({
  content,
  mediaAsset,
}: {
  content: object;
  mediaAsset: MediaAsset | null;
}): PlayableStepImage | null {
  if (!mediaAsset || mediaAsset.kind !== "image" || !("image" in content) || !content.image) {
    return null;
  }

  const request = content.image;
  const alt = typeof request === "object" && "alt" in request ? request.alt : null;

  return typeof alt === "string"
    ? {
        alt,
        height: mediaAsset.height,
        id: mediaAsset.id,
        url: mediaAsset.url,
        width: mediaAsset.width,
      }
    : null;
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

  return {
    citation: getStepCitation(row),
    content: parsed.data,
    id: row.id,
    image: getStepImage({ content: parsed.data, mediaAsset: row.mediaAsset }),
    kind,
    position: row.position,
    skillId: row.skillId,
    variants: { deeper: null, simpler: null },
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

/**
 * Word and sentence exercises read their text and translation from the lesson's pair links, so
 * one without its link can't be shown.
 */
function toExerciseInput({
  resources,
  row,
}: {
  resources: ExerciseResources;
  row: PlayableStepRow;
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

  return [
    { content: row.content, id: row.id, kind: row.kind, position: row.position, sentence, word },
  ];
}

/** Language exercises play through today's serializer, with the lesson's pair as their word bank. */
function toExerciseSteps({
  resources,
  rows,
}: {
  resources: LessonPairResources;
  rows: PlayableStepRow[];
}): Map<string, PlayableLanguageStep> {
  const exerciseRows = rows.filter((row) => isExerciseKind(row.kind));
  const inputs = exerciseRows.flatMap((row) => toExerciseInput({ resources, row }));
  const serialized = serializeExerciseSteps({ resources, steps: inputs });
  const rowsById = new Map(exerciseRows.map((row) => [row.id, row]));

  return new Map(
    serialized.flatMap((exercise) => {
      const row = rowsById.get(exercise.id);

      if (!row || !isExerciseKind(row.kind)) {
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
}: {
  resources: LessonPairResources;
  rows: PlayableStepRow[];
}): Map<string, SerializedStep> {
  const inputs = rows.flatMap((row) => {
    const sentence = resources.lessonSentences.find((item) => item.id === row.sentenceId);

    return row.kind === "spokenAnswer" && sentence
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
}: {
  resources: LessonPairResources;
  rows: PlayableStepRow[];
}): PlayableLibraryStep[] {
  const exercises = toExerciseSteps({ resources, rows });
  const listening = toListeningFallbacks({ resources, rows });

  const steps = rows.flatMap((row) => {
    const step = isTeachingKind(row.kind)
      ? toTeachingStep({ kind: row.kind, listening, row })
      : exercises.get(row.id);

    return step ? [step] : [];
  });

  return markExplanationsNotInMaterial({ rows, steps });
}
