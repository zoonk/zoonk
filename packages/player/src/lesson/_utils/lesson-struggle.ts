import { type LessonPlayerState, getCurrentStep } from "../lesson-player-state";
import { type PlayableLibraryStep } from "../lesson-player-types";

type Miss = LessonPlayerState["misses"][number];

/** The screens that explain an idea, which a struggling learner gets help with. */
export type ExplainingStep = Extract<
  PlayableLibraryStep,
  { kind: "explanation" | "workedExample" }
>;

/** Two answers missed in a row on the same idea: the moment help is worth offering. */
const MISSES_TO_STRUGGLE = 2;

/**
 * A pause on an explanation counts as struggling only well past its reading time, and never
 * before this: people read at their own pace, and a short pause is thinking, not being stuck.
 */
const MIN_STRUGGLE_PAUSE_MS = 45_000;

/** Unhurried reading speed, in words per minute, to size a screen's reading time. */
const READING_WORDS_PER_MINUTE = 150;

/** How many times the reading time a pause must last before help is offered. */
const PAUSE_READING_FACTOR = 3;

const MS_PER_MINUTE = 60_000;

function isExplaining(step: PlayableLibraryStep | undefined): step is ExplainingStep {
  return step?.kind === "explanation" || step?.kind === "workedExample";
}

/** Screens that don't say which skill they're about may be about the same idea. */
function isSameSkill(a: string | null, b: string | null): boolean {
  return a === null || b === null || a === b;
}

function isSameIdea(first: Miss, last: Miss): boolean {
  return first.stepId === last.stepId || isSameSkill(first.skillId, last.skillId);
}

/** The explanation of a missed idea: the last one read before the question, else the next one. */
function findExplanationOf({
  miss,
  state,
}: {
  miss: Miss;
  state: LessonPlayerState;
}): ExplainingStep | null {
  const ids = [...new Set(state.queue)];
  const questionIndex = ids.indexOf(miss.stepId);

  const explanations = ids.flatMap((id, index) => {
    const step = state.steps[id];
    return isExplaining(step) && isSameSkill(step.skillId, miss.skillId) ? [{ index, step }] : [];
  });

  const before = explanations.findLast(({ index }) => index < questionIndex);
  return (before ?? explanations.find(({ index }) => index > questionIndex))?.step ?? null;
}

/**
 * The explanation to offer help with, right after the second answer in a row missed on the same
 * idea (or the same question twice). Never during "I know this", where a miss already
 * brings the learner back to the lesson.
 */
export function getStruggleOffer(state: LessonPlayerState): ExplainingStep | null {
  const recent = state.misses.slice(-MISSES_TO_STRUGGLE);
  const [first, last] = recent;

  if (state.phase !== "feedback" || state.quickCheck || !first || !last) {
    return null;
  }

  if (getCurrentStep(state)?.id !== last.stepId || !isSameIdea(first, last)) {
    return null;
  }

  return findExplanationOf({ miss: last, state });
}

function getReadingText(step: ExplainingStep): string {
  if (step.kind === "explanation") {
    return `${step.content.title ?? ""} ${step.content.text}`;
  }

  const { problem, result, steps } = step.content;
  return [problem, ...steps.map((item) => item.text), result].join(" ");
}

/**
 * How long a learner can stay on an explanation or worked example without touching anything
 * before help is offered: three times its reading time, and at least 45 seconds. Null for other
 * screens.
 */
export function getStrugglePauseMs(step: PlayableLibraryStep): number | null {
  if (!isExplaining(step)) {
    return null;
  }

  const words = getReadingText(step).split(/\s+/u).filter(Boolean).length;
  const readingMs = (words / READING_WORDS_PER_MINUTE) * MS_PER_MINUTE;

  return Math.max(MIN_STRUGGLE_PAUSE_MS, Math.round(readingMs * PAUSE_READING_FACTOR));
}
