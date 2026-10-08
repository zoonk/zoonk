import { isAnswerableStep } from "@zoonk/core/lesson-player/run";
import { type LessonPlayerState } from "../lesson-player-state";
import { type LessonRunAnswers } from "../lesson-player-types";
import { isRetryStep } from "./lesson-steps";

/** Each answered screen's first verdict, in the order the learner answered them. */
export function getRunVerdicts(answers: LessonRunAnswers): Record<string, boolean> {
  return Object.fromEntries(
    answers
      .filter(
        (answer, index) => answers.findIndex((other) => other.stepId === answer.stepId) === index,
      )
      .map((answer) => [answer.stepId, answer.isCorrect]),
  );
}

/** Checks missed the first time and not answered again: they come back at the end of the lesson. */
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

/** Screens answered more than once: their one retry is used. */
function getRetried(answers: LessonRunAnswers): string[] {
  const stepIds = answers.map((answer) => answer.stepId);
  return [...new Set(stepIds.filter((stepId, index) => stepIds.indexOf(stepId) !== index))];
}

/**
 * Where a resumed lesson opens: the first screen still to answer (a missed check's second try
 * counts as one), after the reading that leads to it. The end of the queue when nothing is left.
 */
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

/**
 * A lesson the learner comes back to (a reload, or closing it and opening it again while its run is
 * still open) continues where they left off: the screens they answered count with their first
 * answer, a check they missed once comes back at the end, and the lesson opens at the first screen
 * still to answer. A run with every screen answered is ready to finish.
 */
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
      completion: { result: null, status: "saving", testedOut: false },
      phase: "completed",
      position: queue.length - 1,
    };
  }

  return { ...resumed, position };
}
