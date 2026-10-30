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
import { getExploreExpected } from "../../library/activities/activity-expected";
import { getActivityTemplate } from "../../library/activities/activity-templates";
import { safeParseStepContent } from "../../library/steps/contract/step-contract";
import { type ExerciseKind, isExerciseKind } from "../../player/contracts/exercise-content";
import {
  type ExerciseResources,
  type SerializedStep,
  serializeExerciseSteps,
} from "../../player/contracts/prepare-lesson-data";
import {
  type PlayableActivityStep,
  type PlayableExplanationStep,
  type PlayableLanguageStep,
  type PlayableLibraryStep,
  type PlayableSpokenAnswerStep,
  type PlayableTeachingStep,
  type PlayableTeachingStepOf,
  type PlayableWordHints,
  type TeachingStepKind,
} from "../playable-lesson";
import { getScreenPictures } from "./screen-pictures";
import { getStepCitation, markExplanationsNotInMaterial } from "./step-citation";

export type PlayableStepRow = Step & {
  mediaAsset: MediaAsset | null;
  optionPictures?: (StepOptionPicture & { mediaAsset: MediaAsset })[];
  source: Pick<
    Source,
    "fetchedAt" | "kind" | "mimeType" | "publisher" | "title" | "url" | "visibility"
  > | null;
};

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

  const { content, image, imagePending, optionPictures, pictureWaitStartedAt } = getScreenPictures({
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
    pictureWaitStartedAt,
    ...(Object.keys(optionPictures).length > 0 ? { optionPictures } : {}),
    kind,
    position: row.position,
    skillId: row.skillId,
  };
}

function buildActivityStep(row: PlayableStepRow): PlayableActivityStep | null {
  const step = buildTeachingStep("activity", row);

  return (
    step && {
      ...step,
      minTolerance: getActivityTemplate(step.content.template)?.minTolerance ?? null,
    }
  );
}

/** The explore's solved end state follows the explanation's content, a learner's own version included. */
export function withExploreExpected(
  step: PlayableTeachingStepOf<"explanation">,
): PlayableExplanationStep {
  const { explore } = step.content;
  const exploreExpected = explore ? getExploreExpected(explore) : null;

  return { ...step, exploreExpected: exploreExpected ?? undefined };
}

function buildExplanationStep(row: PlayableStepRow): PlayableExplanationStep | null {
  const step = buildTeachingStep("explanation", row);
  return step && withExploreExpected(step);
}

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
      return buildActivityStep(row);
    case "challenge":
      return buildTeachingStep("challenge", row);
    case "check":
      return buildTeachingStep("check", row);
    case "explanation":
      return buildExplanationStep(row);
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

/** Omits unservable screens; reads, checks, and completion must share this selection. */
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
