import { type LessonPlayerState, getCurrentStep } from "../lesson-player-state";
import { type PlayableLibraryStep } from "../lesson-player-types";

type Miss = LessonPlayerState["misses"][number];

export type ExplainingStep = Extract<
  PlayableLibraryStep,
  { kind: "explanation" | "workedExample" }
>;

const MISSES_TO_STRUGGLE = 2;

const MIN_STRUGGLE_PAUSE_MS = 45_000;

const READING_WORDS_PER_MINUTE = 150;

const PAUSE_READING_FACTOR = 3;

const MS_PER_MINUTE = 60_000;

function isExplaining(step: PlayableLibraryStep | undefined): step is ExplainingStep {
  return step?.kind === "explanation" || step?.kind === "workedExample";
}

function isSameSkill(a: string | null, b: string | null): boolean {
  return a === null || b === null || a === b;
}

function isSameIdea(first: Miss, last: Miss): boolean {
  return first.stepId === last.stepId || isSameSkill(first.skillId, last.skillId);
}

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

export function getStrugglePauseMs(step: PlayableLibraryStep): number | null {
  if (!isExplaining(step)) {
    return null;
  }

  const words = getReadingText(step).split(/\s+/u).filter(Boolean).length;
  const readingMs = (words / READING_WORDS_PER_MINUTE) * MS_PER_MINUTE;

  return Math.max(MIN_STRUGGLE_PAUSE_MS, Math.round(readingMs * PAUSE_READING_FACTOR));
}
