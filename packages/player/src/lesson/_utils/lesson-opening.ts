import { type LessonSupport } from "@zoonk/core/lesson-player/contract";
import { type PlayableLibraryStep } from "../lesson-player-types";
import {
  getExplanationsAfter,
  isExplainingStep,
  isQuestionStep,
  isRetryStep,
} from "./lesson-steps";

type Opening = { queue: string[]; steps: Record<string, PlayableLibraryStep> };

function moveBefore({ ids, queue, target }: { ids: string[]; queue: string[]; target: number }) {
  const rest = queue.filter((id) => !ids.includes(id));
  return [...rest.slice(0, target), ...ids, ...rest.slice(target)];
}

/** A lesson that opens with a question gets the explanations right after it first. */
function openWithExplanation({ queue, start, steps }: Opening & { start: number }): string[] {
  const opening = steps[queue[start] ?? ""];

  if (!opening || !isQuestionStep(opening)) {
    return queue;
  }

  const ids = getExplanationsAfter({ position: start, queue, steps });
  return ids.length === 0 ? queue : moveBefore({ ids, queue, target: start });
}

/**
 * A lesson that opens with explanations gets the check (or activity) that follows them first, when
 * it asks about the same skill: the learner tries what they know, then reads.
 */
function openWithQuestion({ queue, start, steps }: Opening & { start: number }): string[] {
  const opening = steps[queue[start] ?? ""];

  if (!opening || !isExplainingStep(opening)) {
    return queue;
  }

  const questionIndex = queue.findIndex((id, index) => {
    const step = steps[id];
    return index > start && step !== undefined && !isExplainingStep(step);
  });

  const question = steps[queue[questionIndex] ?? ""];

  const asksSameSkill =
    question !== undefined &&
    isRetryStep(question) &&
    (question.skillId === null || opening.skillId === null || question.skillId === opening.skillId);

  return asksSameSkill ? moveBefore({ ids: [question.id], queue, target: start }) : queue;
}

/**
 * Orders only the lesson's opening (the screens after its hook) for this learner: a new skill
 * starts with its explanation, a partly known one with a question. The rest of the lesson keeps
 * its order, and "Explain first" stays available on a question that comes first.
 */
export function orderLessonOpening({
  queue,
  steps,
  support,
}: Opening & { support: LessonSupport | null }): string[] {
  const start = queue.findIndex((id) => steps[id]?.kind !== "hook");

  if (!support || start === -1) {
    return queue;
  }

  return support === "explanationFirst"
    ? openWithExplanation({ queue, start, steps })
    : openWithQuestion({ queue, start, steps });
}
