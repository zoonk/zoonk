import {
  type LessonPlayerAnswer,
  type PlayableLanguageStep,
  type PlayableLibraryStep,
} from "../lesson-player-types";

type StepKind = PlayableLibraryStep["kind"];

/** Screens the learner reads and moves past, with Previous and Next. */
const READ_KINDS = new Set<StepKind>([
  "alphabet",
  "explanation",
  "summary",
  "vocabulary",
  "workedExample",
]);

/** Screens that return at the end of the lesson after a wrong answer, so the idea gets a second try. */
const RETRY_KINDS = new Set<StepKind>(["activity", "check"]);

/** Screens "Explain first" can bring forward: the explanation of the idea a question asks about. */
const EXPLAINING_KINDS = new Set<StepKind>(["explanation", "workedExample"]);

/** Questions that may come before their explanation, where "Explain first" helps. */
const QUESTION_KINDS = new Set<StepKind>(["activity", "check", "typedAnswer"]);

/**
 * Language answers the learner builds (a sentence from a word bank, a blank, an order): a wrong
 * one gets a prompt to fix it first, since self-correcting beats being told the right form.
 */
const SELF_CORRECT_KINDS = new Set<StepKind>(["fillBlank", "listening", "reading"]);

/** A hook with text reads like any screen; a hook with a guess waits for a pick. */
export function isReadStep(step: PlayableLibraryStep): boolean {
  if (step.kind === "hook") {
    return step.content.variant === "text";
  }

  return READ_KINDS.has(step.kind);
}

/** Language exercises carry today's exercise shape instead of step contract content. */
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

/**
 * Typed and spoken answers wait for the server's grade; everything else is graded on the device,
 * including a spoken screen answered as its listening exercise ("I can't talk now").
 */
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

/** Screens of two different skills: when either doesn't say, they may be about the same idea. */
function isOtherSkill(a: PlayableLibraryStep, b: PlayableLibraryStep): boolean {
  return a.skillId !== null && b.skillId !== null && a.skillId !== b.skillId;
}

/**
 * The explanation screens right after a question, up to the next question or the first one about
 * another skill: what "Explain first" moves in front of it.
 */
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

/**
 * "I know this" asks every check the learner hasn't answered right yet, in lesson order, once
 * each. Passing them all skips the rest of the lesson.
 */
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
