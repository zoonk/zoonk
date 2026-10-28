import { isAnswerableStep } from "@zoonk/core/lesson-player/run";
import { type LessonPlayerState } from "../lesson-player-state";
import { type LessonRunAnswers } from "../lesson-player-types";
import { isRetryStep } from "./lesson-steps";

export function getRunVerdicts(answers: LessonRunAnswers): Record<string, boolean> {
  return Object.fromEntries(
    answers
      .filter(
        (answer, index) => answers.findIndex((other) => other.stepId === answer.stepId) === index,
      )
      .map((answer) => [answer.stepId, answer.isCorrect]),
  );
}

function getMissedOnce({
  answers,
  state,
}: {
  answers: LessonRunAnswers;
  state: LessonPlayerState;
}): string[] {
  return state.queue.filter((stepId) => {
    const step = state.steps[stepId];
    const tries = answers.filter((answer) => answer.stepId === stepId);

    return step && isRetryStep(step) && tries.length === 1 && tries[0]?.isCorrect === false;
  });
}

function getRetried(answers: LessonRunAnswers): string[] {
  const stepIds = answers.map((answer) => answer.stepId);
  return [...new Set(stepIds.filter((stepId, index) => stepIds.indexOf(stepId) !== index))];
}

function getResumePosition({
  answered,
  lessonLength,
  queue,
  steps,
}: {
  answered: ReadonlySet<string>;
  lessonLength: number;
  queue: string[];
  steps: LessonPlayerState["steps"];
}): number {
  const isAnswerable = (stepId: string) => {
    const step = steps[stepId];
    return step !== undefined && isAnswerableStep(step);
  };

  const open = queue.findIndex(
    (stepId, index) => isAnswerable(stepId) && (index >= lessonLength || !answered.has(stepId)),
  );

  if (open === -1) {
    return queue.length;
  }

  const readingBefore = queue
    .slice(0, open)
    .toReversed()
    .findIndex((stepId) => isAnswerable(stepId));

  return readingBefore === -1 ? 0 : open - readingBefore;
}

export function resumeLesson(
  state: LessonPlayerState,
  answers: LessonRunAnswers,
): LessonPlayerState {
  const known = answers.filter((answer) => answer.stepId in state.steps);

  if (known.length === 0) {
    return state;
  }

  const missedOnce = getMissedOnce({ answers: known, state });
  const queue = [...state.queue, ...missedOnce];
  const answered = new Set(known.map((answer) => answer.stepId));

  const position = getResumePosition({
    answered,
    lessonLength: state.queue.length,
    queue,
    steps: state.steps,
  });

  const resumed = {
    ...state,
    firstVerdicts: getRunVerdicts(known),
    queue,
    retried: [...getRetried(known), ...missedOnce],
  };

  if (position >= queue.length) {
    return {
      ...resumed,
      completion: { result: null, status: "ready", testedOut: false },
      phase: "completed",
      position: queue.length - 1,
    };
  }

  return { ...resumed, position };
}
