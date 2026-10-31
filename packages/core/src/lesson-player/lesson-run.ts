import { type PlayableLibraryStep } from "./playable-lesson";

const READ_ONLY_KINDS = new Set<PlayableLibraryStep["kind"]>([
  "alphabet",
  "explanation",
  "hook",
  "summary",
  "vocabulary",
  "workedExample",
]);

/** Every answerable step is required to finish unless an explicit completion exception applies. */
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

/** Passing every check permits I know this to skip the other screens. */
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

/** Attempts must be oldest first; count each screen's first answer once. Optional screens count when answered but never block completion. */
export function tallyLessonRun({
  attempts,
  optionalStepIds = new Set(),
  steps,
}: {
  attempts: RunAttempt[];
  optionalStepIds?: ReadonlySet<string>;
  steps: RunStep[];
}): LessonRunTally {
  const answerable = steps.filter((step) => isAnswerableStep(step)).map((step) => step.id);
  const answerableIds = new Set(answerable);
  const required = steps.filter((step) => !optionalStepIds.has(step.id));

  const counted = attempts
    .filter((attempt) => isStepAttempt(attempt))
    .filter((attempt) => answerableIds.has(attempt.stepId));

  const firstVerdicts = new Map(
    counted.toReversed().map((attempt) => [attempt.stepId, attempt.isCorrect]),
  );

  const verdicts = [...firstVerdicts.values()];

  return {
    correctCount: verdicts.filter(Boolean).length,
    incorrectCount: verdicts.filter((isCorrect) => !isCorrect).length,
    isComplete:
      answerable.every((stepId) => optionalStepIds.has(stepId) || firstVerdicts.has(stepId)) ||
      passedEveryCheck({ attempts: counted, steps: required }),
  };
}
