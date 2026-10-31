import {
  type LessonPlayerAnswer,
  type PlayableLanguageStep,
  type PlayableLibraryStep,
} from "../lesson-player-types";

type StepKind = PlayableLibraryStep["kind"];

const READ_KINDS = new Set<StepKind>([
  "alphabet",
  "explanation",
  "summary",
  "vocabulary",
  "workedExample",
]);

const RETRY_KINDS = new Set<StepKind>(["activity", "check"]);

const EXPLAINING_KINDS = new Set<StepKind>(["explanation", "workedExample"]);

const QUESTION_KINDS = new Set<StepKind>(["activity", "check", "typedAnswer"]);

const SELF_CORRECT_KINDS = new Set<StepKind>(["fillBlank", "listening", "reading"]);

export function isReadStep(step: PlayableLibraryStep): boolean {
  if (step.kind === "hook") {
    return step.content.variant === "text";
  }

  return READ_KINDS.has(step.kind);
}

export function isLanguageStep(step: PlayableLibraryStep): step is PlayableLanguageStep {
  return "exercise" in step;
}

export function canSelfCorrect(step: PlayableLibraryStep): boolean {
  return isLanguageStep(step) && SELF_CORRECT_KINDS.has(step.kind);
}

export function isRetryStep(step: PlayableLibraryStep): boolean {
  return RETRY_KINDS.has(step.kind);
}

export function isQuestionStep(step: PlayableLibraryStep): boolean {
  return QUESTION_KINDS.has(step.kind);
}

export function isExplainingStep(step: PlayableLibraryStep): boolean {
  return EXPLAINING_KINDS.has(step.kind);
}

export function isServerGradedAnswer({
  answer,
  step,
}: {
  answer: LessonPlayerAnswer;
  step: PlayableLibraryStep;
}): boolean {
  return (
    step.kind === "typedAnswer" || (step.kind === "spokenAnswer" && answer.kind === "spokenAnswer")
  );
}

function isOtherSkill(a: PlayableLibraryStep, b: PlayableLibraryStep): boolean {
  return a.skillId !== null && b.skillId !== null && a.skillId !== b.skillId;
}

export function getExplanationsAfter({
  position,
  queue,
  steps,
}: {
  position: number;
  queue: string[];
  steps: Record<string, PlayableLibraryStep>;
}): string[] {
  const question = steps[queue[position] ?? ""];
  const following = queue.slice(position + 1);

  const firstOther = following.findIndex((id) => {
    const step = steps[id];
    return !step || !EXPLAINING_KINDS.has(step.kind) || (question && isOtherSkill(question, step));
  });

  return firstOther === -1 ? following : following.slice(0, firstOther);
}

export function getQuickCheckQueue({
  firstVerdicts,
  queue,
  steps,
}: {
  firstVerdicts: Record<string, boolean>;
  queue: string[];
  steps: Record<string, PlayableLibraryStep>;
}): string[] {
  const checks = queue.filter((id) => steps[id]?.kind === "check" && firstVerdicts[id] !== true);
  return [...new Set(checks)];
}
