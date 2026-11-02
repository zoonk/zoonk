import { type LessonSupport } from "@zoonk/core/lesson-player/contract";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { isExplainingStep, isRetryStep } from "./lesson-steps";

type Opening = { queue: string[]; steps: Record<string, PlayableLibraryStep> };

function moveBefore({ ids, queue, target }: { ids: string[]; queue: string[]; target: number }) {
  const rest = queue.filter((id) => !ids.includes(id));
  return [...rest.slice(0, target), ...ids, ...rest.slice(target)];
}

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

export function orderLessonOpening({
  queue,
  steps,
  support,
}: Opening & { support: LessonSupport | null }): string[] {
  const start = queue.findIndex((id) => steps[id]?.kind !== "hook");

  if (support !== "questionFirst" || start === -1) {
    return queue;
  }

  return openWithQuestion({ queue, start, steps });
}
