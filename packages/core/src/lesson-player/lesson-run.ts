import { type PlayableLibraryStep } from "./contract";

/** Screens with nothing to answer: reading, a guess that never counts and an alphabet card. */
const READ_ONLY_KINDS = new Set<PlayableLibraryStep["kind"]>([
  "alphabet",
  "explanation",
  "hook",
  "summary",
  "vocabulary",
  "workedExample",
]);

/** Whether a screen takes an answer that counts: every one must be answered to finish a run. */
export function isAnswerableStep(step: Pick<PlayableLibraryStep, "kind">): boolean {
  return !READ_ONLY_KINDS.has(step.kind);
}

export type RunAttempt = { isCorrect: boolean; stepId: string | null };

type RunStep = Pick<PlayableLibraryStep, "id" | "kind">;

type StepAttempt = { isCorrect: boolean; stepId: string };

export type LessonRunTally = {
  correctCount: number;
  incorrectCount: number;
  /** Every answerable screen was answered, or "I know this" passed every check. */
  isComplete: boolean;
};

function isStepAttempt(attempt: RunAttempt): attempt is StepAttempt {
  return attempt.stepId !== null;
}

/**
 * "I know this" skips the rest of a lesson when the learner gets every check right, so a run is
 * also complete when each check has a right answer, whatever else was skipped.
 */
function passedEveryCheck({
  attempts,
  steps,
}: {
  attempts: StepAttempt[];
  steps: RunStep[];
}): boolean {
  const rightStepIds = new Set(
    attempts.filter((attempt) => attempt.isCorrect).map((attempt) => attempt.stepId),
  );

  const checks = steps.filter((step) => step.kind === "check");

  return checks.length > 0 && checks.every((step) => rightStepIds.has(step.id));
}

/**
 * Tallies the answers of one run, given oldest first. A screen counts once, with its first answer,
 * so a question that comes back at the end of the lesson never adds a second right or wrong.
 */
export function tallyLessonRun({
  attempts,
  steps,
}: {
  attempts: RunAttempt[];
  steps: RunStep[];
}): LessonRunTally {
  const answerable = steps.filter((step) => isAnswerableStep(step)).map((step) => step.id);
  const answerableIds = new Set(answerable);

  const counted = attempts
    .filter((attempt) => isStepAttempt(attempt))
    .filter((attempt) => answerableIds.has(attempt.stepId));

  /** Later entries overwrite earlier ones, so reading the attempts newest first keeps the first. */
  const firstVerdicts = new Map(
    counted.toReversed().map((attempt) => [attempt.stepId, attempt.isCorrect]),
  );

  const verdicts = [...firstVerdicts.values()];

  return {
    correctCount: verdicts.filter(Boolean).length,
    incorrectCount: verdicts.filter((isCorrect) => !isCorrect).length,
    isComplete:
      answerable.every((stepId) => firstVerdicts.has(stepId)) ||
      passedEveryCheck({ attempts: counted, steps }),
  };
}
